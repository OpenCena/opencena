// Importação de texto de fora (Word .docx, .txt, Markdown .md, Fountain).

import { ElementType, ProjectType, ScreenplayElement, TextMark } from "@/types";
import { readZip } from "./zip";
import { tt } from "@/i18n";

interface Para {
  text: string;
  marks: TextMark[];
  heading: boolean;
}

const el = (tipo: ElementType, texto: string, marcas?: TextMark[]): ScreenplayElement => ({
  id: crypto.randomUUID(),
  tipo,
  texto,
  ...(marcas && marcas.length ? { marcas } : {}),
});

// .docx
async function docxParagraphs(buf: ArrayBuffer): Promise<Para[]> {
  const files = await readZip(buf, (n) => n === "word/document.xml");
  const xml = files.get("word/document.xml");
  if (!xml) throw new Error(tt("Este .docx não tem o documento principal."));
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(xml), "application/xml");
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const out: Para[] = [];
  const ps = doc.getElementsByTagNameNS(W, "p");
  for (const p of Array.from(ps)) {
    const style = p.getElementsByTagNameNS(W, "pStyle")[0]?.getAttributeNS(W, "val") ?? "";
    const outline = p.getElementsByTagNameNS(W, "outlineLvl")[0];
    let text = "";
    const marks: TextMark[] = [];
    for (const r of Array.from(p.getElementsByTagNameNS(W, "r"))) {
      const rpr = r.getElementsByTagNameNS(W, "rPr")[0];
      const on = (tag: string) => {
        const e = rpr?.getElementsByTagNameNS(W, tag)[0];
        if (!e) return false;
        const v = e.getAttributeNS(W, "val");
        return v !== "0" && v !== "false";
      };
      const b = on("b");
      const i = on("i");
      let t = "";
      for (const c of Array.from(r.childNodes)) {
        const n = (c as Element).localName;
        if (n === "t") t += c.textContent ?? "";
        else if (n === "tab") t += " ";
        else if (n === "br" || n === "cr") t += "\n";
      }
      if (!t) continue;
      if (b) marks.push({ de: text.length, ate: text.length + t.length, tipo: "b" });
      if (i) marks.push({ de: text.length, ate: text.length + t.length, tipo: "i" });
      text += t;
    }
    out.push({ text, marks, heading: /^(heading|t[ií]tulo|title)/i.test(style) || !!outline });
  }
  return out;
}

// Markdown inline (**negrito**, *itálico*, _itálico_)
function mdInline(src: string): { text: string; marks: TextMark[] } {
  let text = "";
  const marks: TextMark[] = [];
  const re = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    text += src.slice(last, m.index);
    const inner = m[2] ?? m[4];
    marks.push({ de: text.length, ate: text.length + inner.length, tipo: m[2] ? "b" : "i" });
    text += inner;
    last = m.index + m[0].length;
  }
  text += src.slice(last);
  return { text, marks };
}

// texto puro -> parágrafos
function textParagraphs(raw: string, markdown: boolean): Para[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const hasBlank = lines.some((l) => !l.trim());
  const out: Para[] = [];
  let buf: string[] = [];
  const push = (t: string) => {
    const heading = markdown && /^#{1,6}\s+/.test(t);
    let s = heading ? t.replace(/^#{1,6}\s+/, "") : t;
    let marks: TextMark[] = [];
    if (markdown && !SEPARATOR.test(s)) ({ text: s, marks } = mdInline(s));
    out.push({ text: s, marks, heading });
  };
  for (const l of lines) {
    if (!hasBlank) {
      if (l.trim()) push(l.trim());
      continue;
    }
    if (!l.trim()) {
      if (buf.length) push(buf.join(" ").trim());
      buf = [];
    } else if (markdown && /^#{1,6}\s+/.test(l)) {
      if (buf.length) push(buf.join(" ").trim());
      buf = [];
      push(l.trim());
    } else buf.push(l.trim());
  }
  if (buf.length) push(buf.join(" ").trim());
  return out;
}

// novel
const CHAPTER = /^(cap[ií]tulo|cap\.|parte|pr[oó]logo|ep[ií]logo|interl[uú]dio|chapter|part|prologue|epilogue|interlude)\b/i;
const SEPARATOR = /^\s*((\*\s*){3,}|(-\s*){3,}|#|~+|•\s*•\s*•)\s*$/;

function toNovel(paras: Para[]): ScreenplayElement[] {
  const out: ScreenplayElement[] = [];
  for (const p of paras) {
    const t = p.text.trim();
    if (!t) continue;
    if (SEPARATOR.test(t)) out.push(el("separador", ""));
    else if (p.heading || (CHAPTER.test(t) && t.length < 90)) out.push(el("capitulo", t));
    else {
      // marcas são relativas ao texto original; ajusta pelo trim do começo
      const shift = p.text.length - p.text.trimStart().length;
      const marks = p.marks
        .map((m) => ({ ...m, de: Math.max(0, m.de - shift), ate: Math.min(t.length, m.ate - shift) }))
        .filter((m) => m.ate > m.de);
      out.push(el("paragrafo", t, marks));
    }
  }
  return out;
}

// roteiro (Fountain simplificado + heurística por linha)
const HEADING = /^(\.(?!\.)|(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s])/i;
const TRANSITION = /^(>(?!.*<\s*$)|[A-ZÀ-Ü ]+(TO|PARA):$|FADE (IN|OUT)|CORTA PARA|FUSÃO)/;

function isUpperName(t: string): boolean {
  const base = t.replace(/\(.*?\)/g, "").replace(/^@/, "").trim();
  return base.length > 0 && base.length < 38 && base === base.toUpperCase() && /\p{L}/u.test(base);
}

export function parseFountain(raw: string): ScreenplayElement[] {
  let src = raw.replace(/\r\n?/g, "\n");
  src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\[\[[\s\S]*?\]\]/g, "");
  const lines = src.split("\n");
  // página de título (Chave: valor no começo)
  let i = 0;
  if (/^[A-Za-z ]+:/.test(lines[0] ?? "")) {
    while (i < lines.length && lines[i].trim()) i++;
  }
  const out: ScreenplayElement[] = [];
  let mode: "none" | "dialogo" = "none";
  let action: string[] = [];
  const flushAction = () => {
    if (action.length) out.push(el("acao", action.join("\n").trim()));
    action = [];
  };
  for (; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    const prevBlank = i === 0 || !lines[i - 1].trim();
    const nextBlank = i + 1 >= lines.length || !lines[i + 1].trim();
    if (!t) {
      flushAction();
      mode = "none";
      continue;
    }
    if (/^#|^=(?!=)/.test(t)) continue; // seções e sinopses
    if (mode === "dialogo") {
      if (/^\(.*\)$/.test(t)) out.push(el("parentese", t));
      else {
        const last = out[out.length - 1];
        if (last?.tipo === "dialogo") last.texto += "\n" + t;
        else out.push(el("dialogo", t));
      }
      continue;
    }
    if (prevBlank && HEADING.test(t)) {
      flushAction();
      out.push(el("cabecalho", t.replace(/^\./, "").toUpperCase()));
      continue;
    }
    if (prevBlank && nextBlank && TRANSITION.test(t)) {
      flushAction();
      out.push(el("transicao", t.replace(/^>\s*/, "").toUpperCase()));
      continue;
    }
    if (prevBlank && !nextBlank && (t.startsWith("@") || isUpperName(t))) {
      flushAction();
      out.push(el("personagem", t.replace(/^@/, "").toUpperCase()));
      mode = "dialogo";
      continue;
    }
    action.push(t.replace(/^!/, ""));
  }
  flushAction();
  return out;
}

/** Roteiro vindo do Word: um parágrafo por elemento, sem linhas em branco. */
function screenplayFromParas(paras: Para[]): ScreenplayElement[] {
  const out: ScreenplayElement[] = [];
  let prev: ElementType | null = null;
  for (const p of paras) {
    const t = p.text.trim();
    if (!t) {
      prev = null;
      continue;
    }
    let tipo: ElementType;
    if (HEADING.test(t)) tipo = "cabecalho";
    else if (TRANSITION.test(t) && t === t.toUpperCase()) tipo = "transicao";
    else if (/^\(.*\)$/.test(t) && (prev === "personagem" || prev === "dialogo")) tipo = "parentese";
    else if (prev === "personagem" || prev === "parentese") tipo = "dialogo";
    else if (isUpperName(t) && t.split(/\s+/).length <= 5) tipo = "personagem";
    else tipo = "acao";
    out.push(el(tipo, ["cabecalho", "personagem", "transicao"].includes(tipo) ? t.toUpperCase() : t));
    prev = tipo;
  }
  return out;
}

// quadrinhos
function comicFromParas(paras: Para[]): ScreenplayElement[] {
  const out: ScreenplayElement[] = [];
  // "PÁGINA 3 (4 QUADROS): splash" -> "splash"
  const rest = (t: string) =>
    t.replace(/^(P[ÁA]GINA|PAGE|QUADRO|PAINEL|PANEL|VIÑETA|VINETA)\s+[^\s:.(]+\s*(\([^)]*\))?\s*[:.\-–—]?\s*/i, "").trim();
  for (const p of paras) {
    for (const raw of p.text.split("\n")) {
      const t = raw.trim();
      if (!t) continue;
      if (/^(P[ÁA]GINA|PAGE)\s+\S+/i.test(t)) out.push(el("pagina", rest(t)));
      else if (/^(QUADRO|PAINEL|PANEL|VIÑETA|VINETA)\s+\S+/i.test(t)) out.push(el("quadro", rest(t)));
      else if (/^(LEGENDA|RECORDAT[ÓO]RIO|CAPTION|CARTUCHO)\s*:/i.test(t)) out.push(el("legenda", t.replace(/^[^:]+:\s*/, "")));
      else if (/^(SFX|ONOMATOPEIA|ONOMATOPEYA)\s*:/i.test(t)) out.push(el("sfx", t.replace(/^[^:]+:\s*/, "")));
      else if (/^(NOTA|NOTE)\s*:/i.test(t)) out.push(el("nota", t.replace(/^[^:]+:\s*/, "")));
      else {
        const m = t.match(/^\d*\.?\s*([A-ZÀ-Ü][A-ZÀ-Ü0-9 .'-]{0,30}(\([^)]*\))?)\s*:\s*(.+)$/);
        if (m && isUpperName(m[1])) {
          out.push(el("personagem", m[1].trim()));
          out.push(el("balao", m[3].trim()));
        } else out.push(el("descricao", t));
      }
    }
  }
  return out;
}

// entrada
export const IMPORT_ACCEPT: Record<ProjectType, string> = {
  roteiro: ".fountain,.txt,.docx,.md",
  quadrinhos: ".txt,.docx,.md",
  novel: ".docx,.txt,.md",
};

export async function importFile(file: File, tipo: ProjectType): Promise<ScreenplayElement[]> {
  const name = file.name.toLowerCase();
  let paras: Para[];
  if (name.endsWith(".docx")) {
    paras = await docxParagraphs(await file.arrayBuffer());
  } else {
    const raw = await file.text();
    if (tipo === "roteiro" && !name.endsWith(".md")) return parseFountain(raw);
    paras = textParagraphs(raw, name.endsWith(".md"));
  }
  if (tipo === "novel") return toNovel(paras);
  if (tipo === "quadrinhos") return comicFromParas(paras);
  return screenplayFromParas(paras);
}
