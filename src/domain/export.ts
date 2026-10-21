// Exportação em formatos de texto e de documento.

import { ElementType, LoadedProject, ScreenplayElement } from "@/types";
import { Layout, kindOf, pageLeftMargin, pageSettingsOf, resolveLayout } from "@/layout/profiles";
import { FrontItem, FrontPage, bookPartsOf, withBlanks } from "@/layout/frontmatter";
import { StaticAttrs, computeStatics } from "@/layout/statics";
import { makeZip } from "./zip";
import { tt, tdoc } from "@/i18n";

export function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "").trim() || "documento";
}

interface Run {
  text: string;
  b: boolean;
  i: boolean;
}

/** Texto do elemento em trechos com negrito/itálico. */
function runsOf(el: ScreenplayElement): Run[] {
  const t = el.texto;
  if (!el.marcas?.length) return t ? [{ text: t, b: false, i: false }] : [];
  const cuts = new Set([0, t.length]);
  el.marcas.forEach((m) => {
    cuts.add(Math.max(0, Math.min(t.length, m.de)));
    cuts.add(Math.max(0, Math.min(t.length, m.ate)));
  });
  const pts = [...cuts].sort((a, b) => a - b);
  const out: Run[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k];
    const z = pts[k + 1];
    if (z <= a) continue;
    const ms = el.marcas.filter((m) => m.de <= a && m.ate >= z);
    out.push({ text: t.slice(a, z), b: ms.some((m) => m.tipo === "b"), i: ms.some((m) => m.tipo === "i") });
  }
  return out;
}

function staticsOf(project: LoadedProject): { layout: Layout; statics: StaticAttrs[] } {
  const layout = resolveLayout(project.meta);
  const statics = computeStatics(project.screenplay.elementos, layout, {
    contd: project.meta.contdEnabled !== false,
  });
  return { layout, statics };
}

// Fountain
export function toFountain(project: LoadedProject): string {
  const { cover, screenplay } = project;
  const lines: string[] = [];

  if (cover.titulo) lines.push(`Title: ${cover.titulo}`);
  if (cover.subtitulo) lines.push(`Credit: ${cover.subtitulo}`);
  if (cover.autor) lines.push(`Author: ${cover.autor}`);
  if (cover.baseadoEm) lines.push(`Source: ${cover.baseadoEm}`);
  if (cover.contato) lines.push(`Contact: ${cover.contato}`);
  if (cover.data) lines.push(`Draft date: ${cover.data}`);
  if (lines.length) lines.push("");

  for (const el of screenplay.elementos) {
    const t = el.texto.trimEnd();
    switch (el.tipo) {
      case "cabecalho":
        lines.push("", t.toUpperCase());
        break;
      case "acao":
        lines.push("", t);
        break;
      case "personagem":
        lines.push("", t.toUpperCase());
        break;
      case "parentese":
        lines.push(t.startsWith("(") ? t : `(${t})`);
        break;
      case "dialogo":
        lines.push(t);
        break;
      case "transicao":
        lines.push("", `> ${t.toUpperCase()}`);
        break;
    }
  }
  return lines.join("\n").trim() + "\n";
}

// TXT
function pad(n: number): string {
  return " ".repeat(n);
}

function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      if ((line + " " + w).trim().length > width) {
        if (line) out.push(line);
        line = w;
      } else {
        line = (line + " " + w).trim();
      }
    }
    out.push(line);
  }
  return out.length ? out : [""];
}

export function toPlainText(project: LoadedProject): string {
  const kind = kindOf(project.meta).id;
  const { statics } = staticsOf(project);
  const lines: string[] = [];
  const els = project.screenplay.elementos;

  if (kind === "novel") {
    els.forEach((el, i) => {
      const t = el.texto.trimEnd();
      if (el.tipo === "capitulo") lines.push("", "", t.toUpperCase(), "");
      else if (el.tipo === "separador") lines.push("", pad(20) + (t || "* * *"), "");
      else if (el.tipo === "citacao") lines.push(...wrap(t, 60).map((l) => pad(6) + l), "");
      else lines.push((statics[i].noIndent ? "" : pad(4)) + t);
    });
    return lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim() + "\n";
  }

  if (kind === "quadrinhos") {
    els.forEach((el, i) => {
      const a = statics[i];
      const t = el.texto.trimEnd();
      switch (el.tipo) {
        case "pagina":
          lines.push("", "", `${a.label ?? ""}${t}`.toUpperCase());
          break;
        case "quadro":
          lines.push("", `${a.label ?? ""}${t}`.toUpperCase());
          break;
        case "descricao":
          lines.push(...wrap(t, 70));
          break;
        case "personagem":
          lines.push("", pad(22) + t.toUpperCase());
          break;
        case "balao":
          lines.push(...wrap(t, 50).map((l, k) => (k === 0 ? `${String(a.bn ?? "").padStart(6)}. ` : pad(8)) + l));
          break;
        case "legenda":
          lines.push("", ...wrap(`LEGENDA: ${t}`, 50).map((l, k) => (k === 0 ? `${String(a.bn ?? "").padStart(6)}. ` : pad(8)) + l));
          break;
        case "sfx":
          lines.push("", pad(8) + `SFX: ${t.toUpperCase()}`);
          break;
        case "nota":
          lines.push("", ...wrap(`NOTA: ${t}`, 70));
          break;
      }
    });
    return lines.join("\n").trim() + "\n";
  }

  let scene = 0;
  for (const el of els) {
    const t = el.texto.trimEnd();
    switch (el.tipo) {
      case "cabecalho":
        scene += 1;
        lines.push("", `${scene}. ${t.toUpperCase()}`);
        break;
      case "acao":
        lines.push("", ...wrap(t, 60));
        break;
      case "personagem":
        lines.push("", pad(20) + t.toUpperCase());
        break;
      case "parentese":
        lines.push(pad(15) + (t.startsWith("(") ? t : `(${t})`));
        break;
      case "dialogo":
        lines.push(...wrap(t, 35).map((l) => pad(10) + l));
        break;
      case "transicao":
        lines.push("", pad(45) + t.toUpperCase());
        break;
    }
  }
  return lines.join("\n").trim() + "\n";
}

// Markdown
function mdRuns(el: ScreenplayElement): string {
  return runsOf(el)
    .map((r) => {
      let t = r.text.replace(/([*_`\\])/g, "\\$1").replace(/\n/g, "  \n");
      if (!t.trim()) return t;
      if (r.i) t = `*${t}*`;
      if (r.b) t = `**${t}**`;
      return t;
    })
    .join("");
}

export function toMarkdown(project: LoadedProject): string {
  const { cover, screenplay } = project;
  const kind = kindOf(project.meta).id;
  const { statics } = staticsOf(project);
  const lines: string[] = [];
  if (cover.titulo) lines.push(`# ${cover.titulo}`, "");
  const lang = project.meta.idioma;
  const por = kind === "novel" ? "" : kind === "quadrinhos" ? `${tdoc(lang, "roteiro de")} ` : `${tdoc(lang, "escrito por")} `;
  if (cover.autor) lines.push(`_${por}${cover.autor}_`, "");
  const els = screenplay.elementos;

  els.forEach((el, i) => {
    const t = el.texto.trimEnd();
    const a = statics[i];
    switch (el.tipo as ElementType) {
      // novel
      case "capitulo":
        lines.push("", `## ${t}`, "");
        break;
      case "paragrafo":
        lines.push(mdRuns(el), "");
        break;
      case "separador":
        lines.push("", "* * *", "");
        break;
      case "citacao":
        lines.push(`> ${mdRuns(el)}`, "");
        break;
      // quadrinhos
      case "pagina":
        lines.push("", `## ${a.label ?? ""}${t}`.trimEnd(), "");
        break;
      case "quadro":
        lines.push("", `### ${a.label ?? ""}${t}`.trimEnd(), "");
        break;
      case "descricao":
        lines.push(mdRuns(el), "");
        break;
      case "balao": {
        const prev = els[i - 1];
        const quem = prev?.tipo === "personagem" ? `**${prev.texto.trim().toUpperCase()}:** ` : "";
        lines.push(`${a.bn ?? "-"}. ${quem}${mdRuns(el)}`);
        break;
      }
      case "legenda":
        lines.push(`${a.bn ?? "-"}. **LEGENDA:** ${mdRuns(el)}`);
        break;
      case "sfx":
        lines.push("", `**SFX:** ${t.toUpperCase()}`, "");
        break;
      case "nota":
        lines.push("", `_NOTA: ${t}_`, "");
        break;
      // roteiro
      case "cabecalho":
        lines.push("", `### ${t.toUpperCase()}`);
        break;
      case "acao":
        lines.push("", t);
        break;
      case "personagem":
        if (kind === "roteiro") lines.push("", `**${t.toUpperCase()}**  `);
        else if (els[i + 1]?.tipo !== "balao") lines.push("", `**${t.toUpperCase()}**`);
        break;
      case "parentese":
        lines.push(`_${t.startsWith("(") ? t : `(${t})`}_  `);
        break;
      case "dialogo":
        lines.push(`${t}  `);
        break;
      case "transicao":
        lines.push("", `> ${t.toUpperCase()}`);
        break;
    }
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// Word (.docx)
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TW = 15; // twips por px (1px = 1/96" = 15 twips)
const tw = (px: number) => Math.round(px * TW);

const DOCX_FONT: Record<string, string> = {
  courier: "Courier New",
  times: "Times New Roman",
  helvetica: "Arial",
};

function wRun(text: string, o: { b?: boolean; i?: boolean; caps?: boolean; sz?: number; color?: string }): string {
  if (!text) return "";
  const rpr = [
    o.b ? "<w:b/>" : "",
    o.i ? "<w:i/>" : "",
    o.caps ? "<w:caps/>" : "",
    o.color ? `<w:color w:val="${o.color}"/>` : "",
    o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : "",
  ].join("");
  return text
    .split("\n")
    .map((part, k) => `${k > 0 ? `<w:r><w:rPr>${rpr}</w:rPr><w:br/></w:r>` : ""}${part ? `<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${esc(part)}</w:t></w:r>` : ""}`)
    .join("");
}

function pageNumberPara(align: "left" | "center" | "right", sz: number, suffix: string, extra = ""): string {
  return `<w:p><w:pPr><w:jc w:val="${align}"/></w:pPr>${extra}<w:r><w:rPr><w:sz w:val="${sz}"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="${sz}"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:sz w:val="${sz}"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="${sz}"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="${sz}"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>${suffix ? wRun(suffix, { sz }) : ""}</w:p>`;
}

const W_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';

function hdrFtr(tag: "hdr" | "ftr", body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${tag} ${W_NS}>${body || "<w:p/>"}</w:${tag}>`;
}

/** Extras calculados fora (precisam de layout/canvas): páginas de abertura e capa. */
export interface DocExtras {
  front?: FrontPage[];
  /** Capa já recortada, com título/autor desenhados (data URL JPEG). */
  coverJpeg?: string | null;
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const EMU = 9525; // por px

function coverDrawing(l: Layout): string {
  const cx = Math.round(l.pageW * EMU);
  const cy = Math.round(l.pageH * EMU);
  return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="1" name="Capa"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="capa.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
}

/** Linhas de uma página de abertura viram parágrafos (mesma posição vertical). */
function frontParagraphs(page: FrontPage, l: Layout, physIndex: number, breakBefore: boolean): string {
  const left = pageLeftMargin(l, physIndex);
  const right = l.pageW - (left === l.marginInner ? l.marginOuter : l.marginInner);
  const lines: FrontItem[][] = [];
  for (const it of [...page.items].sort((a, b) => a.y - b.y)) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - it.y) < 0.5) last.push(it);
    else lines.push([it]);
  }
  const out: string[] = [];
  let cursor = l.marginTop;
  lines.forEach((group, gi) => {
    const first = group[0];
    const before = Math.max(0, first.y - cursor);
    const runs = (it: FrontItem) =>
      wRun(it.text, {
        b: it.bold,
        i: it.italic,
        sz: Math.round(it.sizePt * 2),
        color: it.color === "suave" ? "666666" : undefined,
      });
    // ordem exigida pelo Word: pageBreakBefore, tabs, spacing, ind, jc
    const brk = gi === 0 && breakBefore ? "<w:pageBreakBefore/>" : "";
    const spacing = `<w:spacing w:before="${tw(before)}" w:after="0" w:line="${tw(first.lineHeight)}" w:lineRule="exact"/>`;
    let ppr: string;
    let content: string;
    if (group.length > 1) {
      const lft = group.find((g) => g.align === "left") ?? group[0];
      const rgt = group.find((g) => g !== lft) ?? group[1];
      const leader = lft.leaderTo ? ' w:leader="dot"' : "";
      ppr = `${brk}<w:tabs><w:tab w:val="right" w:leader="${leader ? "dot" : "none"}" w:pos="${tw(right - left)}"/></w:tabs>${spacing}`;
      content = runs(lft) + "<w:r><w:tab/></w:r>" + runs(rgt);
    } else {
      const it = first;
      ppr = brk + spacing;
      if (it.align === "left") ppr += `<w:ind w:left="${tw(Math.max(0, it.x - left))}"/>`;
      else if (it.align === "right") ppr += `<w:ind w:right="${tw(Math.max(0, right - it.x))}"/><w:jc w:val="right"/>`;
      else ppr += `<w:jc w:val="center"/>`;
      content = runs(it);
    }
    out.push(`<w:p><w:pPr>${ppr}</w:pPr>${content}</w:p>`);
    cursor = first.y + first.lineHeight;
  });
  if (!out.length) out.push(`<w:p><w:pPr>${breakBefore ? "<w:pageBreakBefore/>" : ""}</w:pPr></w:p>`);
  return out.join("");
}

export function toDocx(project: LoadedProject, extras: DocExtras = {}): Blob {
  const { layout: l, statics } = staticsOf(project);
  const kind = kindOf(project.meta).id;
  const s = pageSettingsOf(project.meta);
  const els = project.screenplay.elementos;
  const font = DOCX_FONT[l.fontInfo.pdf] ?? l.fontInfo.pdf;
  const baseSz = Math.round(l.basePt * 2);
  const furnSz = kind === "novel" ? Math.round(Math.max(8, l.basePt * 0.85) * 2) : baseSz;
  const title = (project.cover.titulo || project.meta.nome || "").trim();
  const author = (project.cover.autor || project.meta.autor || "").trim();

  // cabeçalhos e rodapés
  const files: Record<string, string> = {};
  const isTopNum = l.numbering === "topo-direita" || l.numbering === "topo-externo";
  const numSuffix = l.numberFormat === "ponto" ? "." : "";
  const head = (text: string) =>
    text ? `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${wRun(text, { i: true, sz: furnSz })}</w:p>` : "";
  const num = (align: "left" | "center" | "right") => (l.numbering === "nenhuma" ? "" : pageNumberPara(align, furnSz, numSuffix));
  const outerOdd = "right";
  const outerEven = l.mirror ? "left" : "right";
  const posOdd = l.numbering === "rodape-centro" ? "center" : l.numbering === "topo-direita" ? "right" : outerOdd;
  const posEven = l.numbering === "rodape-centro" ? "center" : l.numbering === "topo-direita" ? "right" : outerEven;

  const hOdd = (l.runningHead ? head(title) : "") + (isTopNum ? num(posOdd) : "");
  const hEven = (l.runningHead ? head(author) : "") + (isTopNum ? num(posEven) : "");
  const fOdd = !isTopNum ? num(posOdd) : "";
  const fEven = !isTopNum ? num(posEven) : "";
  // primeira página de cada seção (abertura de capítulo / 1ª página do roteiro)
  const fFirst = kind === "novel" && !isTopNum ? fOdd : "";
  files["word/header1.xml"] = hdrFtr("hdr", hOdd);
  files["word/header2.xml"] = hdrFtr("hdr", hEven);
  files["word/header3.xml"] = hdrFtr("hdr", "");
  files["word/footer1.xml"] = hdrFtr("ftr", fOdd);
  files["word/footer2.xml"] = hdrFtr("ftr", fEven);
  files["word/footer3.xml"] = hdrFtr("ftr", fFirst);

  const sectPr = (o: { refs: boolean; titlePg: boolean; start?: boolean; type?: "nextPage" | "oddPage" }) =>
    `<w:sectPr>${
      o.refs
        ? '<w:headerReference w:type="default" r:id="rIdH1"/><w:headerReference w:type="even" r:id="rIdH2"/><w:headerReference w:type="first" r:id="rIdH3"/><w:footerReference w:type="default" r:id="rIdF1"/><w:footerReference w:type="even" r:id="rIdF2"/><w:footerReference w:type="first" r:id="rIdF3"/>'
        : ""
    }${o.type ? `<w:type w:val="${o.type}"/>` : ""}<w:pgSz w:w="${tw(l.pageW)}" w:h="${tw(l.pageH)}"/><w:pgMar w:top="${tw(l.marginTop)}" w:right="${tw(l.marginOuter)}" w:bottom="${tw(l.marginBottom)}" w:left="${tw(l.marginInner)}" w:header="${tw(l.marginTop / 2 - 8)}" w:footer="${tw(l.marginBottom / 2 - 8)}" w:gutter="0"/>${
      o.start ? '<w:pgNumType w:start="1"/>' : ""
    }${o.titlePg ? "<w:titlePg/>" : ""}</w:sectPr>`;

  const body: string[] = [];

  // páginas de abertura (seção própria, sem cabeçalho/rodapé)
  const front = extras.front ? withBlanks(extras.front, l) : [];
  let hasCoverImage = false;
  if (front.length) {
    front.forEach((pg, k) => {
      if (!pg) {
        body.push(`<w:p><w:pPr>${k > 0 ? "<w:pageBreakBefore/>" : ""}</w:pPr></w:p>`);
        return;
      }
      if (pg.image && extras.coverJpeg) {
        hasCoverImage = true;
        body.push(`<w:p><w:pPr>${k > 0 ? "<w:pageBreakBefore/>" : ""}<w:spacing w:before="0" w:after="0"/></w:pPr>${coverDrawing(l)}</w:p>`);
        return;
      }
      body.push(frontParagraphs(pg, l, k, k > 0));
    });
    body.push(`<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>${sectPr({ refs: false, titlePg: false })}</w:pPr></w:p>`);
  }

  // conteúdo
  // No novel, cada capítulo é uma seção do Word (abre página nova ou ímpar,
  // e a 1ª página não tem cabeçalho corrente). O tipo de quebra fica no sectPr
  // da seção que começa; a 1ª seção de texto recomeça a numeração em 1.
  const chapterSections = kind === "novel" && s.capituloNovaPagina;
  const typeFirst: "nextPage" | "oddPage" = "nextPage";
  const typeChapter: "nextPage" | "oddPage" = l.chapterOdd ? "oddPage" : "nextPage";
  let sectionsEmitted = 0;
  let first = true;
  els.forEach((el, i) => {
    const st = l.blocks[el.tipo];
    if (!st) return;
    const a = statics[i];
    // capítulo novo = seção nova (sem cabeçalho corrente na abertura)
    if (chapterSections && el.tipo === "capitulo" && !first) {
      body.push(
        `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>${sectPr({
          refs: true,
          titlePg: true,
          start: sectionsEmitted === 0,
          type: sectionsEmitted === 0 ? typeFirst : typeChapter,
        })}</w:pPr></w:p>`
      );
      sectionsEmitted++;
    }
    const opensPage = st.pageBreakBefore && !first;
    const before = st.pageBreakBefore ? st.sinkTop : first ? 0 : a.sb;
    const ppr = [
      st.keepWithNext ? "<w:keepNext/>" : "",
      opensPage && !chapterSections ? "<w:pageBreakBefore/>" : "",
      st.splittable ? "<w:widowControl/>" : "",
      `<w:spacing w:before="${tw(before)}" w:after="0" w:line="${tw(st.lineHeight)}" w:lineRule="exact"/>`,
      `<w:ind w:left="${tw(st.indentLeft)}" w:right="${tw(st.indentRight)}" ${
        st.firstIndent && !a.noIndent ? `w:firstLine="${tw(st.firstIndent)}"` : ""
      }/>`,
      `<w:jc w:val="${st.align === "justify" ? "both" : st.align}"/>`,
      el.tipo === "capitulo" || el.tipo === "cabecalho" || el.tipo === "pagina" ? '<w:outlineLvl w:val="0"/>' : "",
    ].join("");
    const sz = Math.round(st.fontPt * 2);
    const base = { caps: st.upper, sz, color: st.muted ? "666666" : undefined };
    let runs = "";
    const pre = (st.prefix ?? "") + (a.label ?? "");
    if (kind === "quadrinhos" && a.bn) runs += wRun(`${a.bn}. `, { ...base, b: true });
    if (pre) runs += wRun(pre, { ...base, b: !!st.prefix || st.bold });
    for (const r of runsOf(el)) runs += wRun(r.text, { ...base, b: st.bold || r.b, i: st.italic || r.i });
    if (a.contd) runs += wRun(` ${l.contd}`, { ...base, b: st.bold });
    body.push(`<w:p><w:pPr>${ppr}</w:pPr>${runs}</w:p>`);
    first = false;
  });
  if (first) body.push("<w:p/>");

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${body.join("")}${sectPr({
    refs: true,
    titlePg: kind === "roteiro" || chapterSections,
    start: sectionsEmitted === 0,
    type: sectionsEmitted === 0 ? typeFirst : typeChapter,
  })}</w:body></w:document>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/><w:sz w:val="${baseSz}"/><w:szCs w:val="${baseSz}"/><w:lang w:val="${project.meta.idioma ?? "pt-BR"}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${tw(l.lineHeight)}" w:lineRule="exact"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;

  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ${W_NS}>${
    l.mirror ? "<w:mirrorMargins/>" : ""
  }<w:defaultTabStop w:val="720"/>${l.hyphenate ? "<w:autoHyphenation/>" : ""}<w:evenAndOddHeaders/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdT" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${[1, 2, 3]
    .map(
      (n) =>
        `<Relationship Id="rIdH${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header${n}.xml"/><Relationship Id="rIdF${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer${n}.xml"/>`
    )
    .join("")}${hasCoverImage ? '<Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/capa.jpg"/>' : ""}</Relationships>`;

  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${[1, 2, 3]
    .map(
      (n) =>
        `<Override PartName="/word/header${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`
    )
    .join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>${esc(author)}</dc:creator><dc:language>pt-BR</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`;

  return makeZip([
    { name: "[Content_Types].xml", data: types },
    { name: "_rels/.rels", data: rootRels },
    { name: "docProps/core.xml", data: core },
    { name: "word/document.xml", data: document },
    { name: "word/styles.xml", data: styles },
    { name: "word/settings.xml", data: settings },
    { name: "word/_rels/document.xml.rels", data: rels },
    ...Object.entries(files).map(([name, data]) => ({ name, data })),
    ...(hasCoverImage && extras.coverJpeg ? [{ name: "word/media/capa.jpg", data: dataUrlBytes(extras.coverJpeg) }] : []),
  ]);
}

// EPUB (novel)
function xhtml(title: string, body: string, lang = "pt-BR"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head><meta charset="UTF-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="estilo.css"/></head>
<body>
${body}
</body>
</html>`;
}

function htmlRuns(el: ScreenplayElement): string {
  return runsOf(el)
    .map((r) => {
      let t = esc(r.text).replace(/\n/g, "<br/>");
      if (r.i) t = `<em>${t}</em>`;
      if (r.b) t = `<strong>${t}</strong>`;
      return t;
    })
    .join("");
}

export function toEpub(project: LoadedProject, extras: DocExtras = {}): Blob {
  const parts = bookPartsOf(project);
  const { statics } = staticsOf(project);
  const els = project.screenplay.elementos;
  const title = (project.cover.titulo || project.meta.nome || tdoc(project.meta.idioma, "Sem título")).trim();
  const author = (project.cover.autor || project.meta.autor || "").trim();
  const s = pageSettingsOf(project.meta);

  // Divide em capítulos (o que vem antes do 1º capítulo vira "Início").
  const chapters: { title: string; html: string[] }[] = [];
  let cur: { title: string; html: string[] } | null = null;
  els.forEach((el, i) => {
    if (el.tipo === "capitulo") {
      cur = { title: el.texto.trim() || tdoc(project.meta.idioma, "Capítulo {n}", { n: chapters.length + 1 }), html: [`<h1>${htmlRuns(el)}</h1>`] };
      chapters.push(cur);
      return;
    }
    if (!cur) {
      cur = { title: tt("Início"), html: [] };
      chapters.push(cur);
    }
    if (el.tipo === "separador") cur.html.push(`<p class="sep">${el.texto.trim() ? htmlRuns(el) : "* * *"}</p>`);
    else if (el.tipo === "citacao") cur.html.push(`<blockquote><p>${htmlRuns(el)}</p></blockquote>`);
    else if (el.texto.trim()) cur.html.push(`<p${statics[i].noIndent ? ' class="ni"' : ""}>${htmlRuns(el)}</p>`);
  });
  if (!chapters.length) chapters.push({ title: tt("Início"), html: ["<p></p>"] });

  const css = `body { font-family: serif; line-height: 1.5; margin: 0 5%; }
h1 { text-align: center; font-size: 1.6em; margin: 3em 0 2em; page-break-before: always; font-weight: bold; }
p { margin: 0; text-indent: ${Math.max(1, s.recuo / 4.2).toFixed(1)}em; text-align: ${s.justificar ? "justify" : "left"}; }
p.ni, .sep + p { text-indent: 0; }
p.sep { text-align: center; text-indent: 0; margin: 1.2em 0; }
blockquote { margin: 1em 2em; font-style: italic; }
blockquote p { text-indent: 0; }
.titulo { text-align: center; margin-top: 30%; }
.titulo h1 { page-break-before: avoid; margin: 0 0 0.5em; font-size: 2em; }
.titulo .autor { font-size: 1.2em; margin-top: 3em; text-indent: 0; text-align: center; }
.titulo .sub { text-indent: 0; text-align: center; }
.capa { margin: 0; padding: 0; text-align: center; }
.capa img { max-width: 100%; max-height: 100vh; }
.rosto-pe { margin-top: 6em; }
.creditos { margin-top: 40%; font-size: 0.8em; }
.creditos p { text-indent: 0; }
.creditos .ficha { margin-top: 1.5em; color: #555; }
.dedicatoria { margin: 30% 0 0 35%; font-style: italic; }
.dedicatoria p { text-indent: 0; text-align: right; }
.dedicatoria .ep-autor { font-style: normal; font-size: 0.9em; margin-top: 0.6em; }`;

  const files: { name: string; data: string | Uint8Array }[] = [];
  const c = project.cover;
  // páginas de abertura marcadas na aba Capa, na ordem do livro
  const fronts: { id: string; file: string; html: string; title: string }[] = [];
  const coverImg = parts.capa && c.imagem && extras.coverJpeg ? dataUrlBytes(extras.coverJpeg) : null;
  if (parts.capa) {
    fronts.push({
      id: "capa",
      file: "capa.xhtml",
      title: tt("Capa"),
      html: coverImg
        ? `<section class="capa" epub:type="cover"><img src="imagens/capa.jpg" alt="${esc(title)}"/></section>`
        : `<section class="titulo" epub:type="cover"><h1>${esc(title)}</h1>${author ? `<p class="autor">${esc(author)}</p>` : ""}</section>`,
    });
  }
  if (parts.folhaRosto) {
    const foot = [c.editora, c.data].filter(Boolean).map((t) => `<p class="sub">${esc(t!)}</p>`).join("");
    fronts.push({
      id: "rosto",
      file: "rosto.xhtml",
      title: tt("Folha de rosto"),
      html: `<section class="titulo" epub:type="titlepage">${author ? `<p class="sub">${esc(author)}</p>` : ""}<h1>${esc(title)}</h1>${
        c.subtitulo ? `<p class="sub"><em>${esc(c.subtitulo)}</em></p>` : ""
      }<div class="rosto-pe">${foot}</div></section>`,
    });
  }
  if (parts.creditos) {
    const cr = c.creditos ?? { copyright: "", edicao: "", isbn: "", editora: "", ficha: "" };
    const lines = [
      cr.copyright || `© ${new Date().getFullYear()} ${author}`.trim(),
      tdoc(project.meta.idioma, "Todos os direitos reservados."),
      cr.edicao,
      cr.isbn ? `ISBN ${cr.isbn}` : "",
      cr.editora,
    ].filter(Boolean);
    fronts.push({
      id: "creditos",
      file: "creditos.xhtml",
      title: tt("Créditos"),
      html: `<section class="creditos" epub:type="copyright-page">${lines.map((t) => `<p>${esc(t)}</p>`).join("")}${
        cr.ficha ? `<p class="ficha">${esc(cr.ficha).replace(/\n/g, "<br/>")}</p>` : ""
      }</section>`,
    });
  }
  if (parts.dedicatoria && c.dedicatoria?.trim())
    fronts.push({
      id: "dedicatoria",
      file: "dedicatoria.xhtml",
      title: tt("Dedicatória"),
      html: `<section class="dedicatoria" epub:type="dedication"><p>${esc(c.dedicatoria.trim()).replace(/\n/g, "<br/>")}</p></section>`,
    });
  if (parts.epigrafe && c.epigrafe?.trim())
    fronts.push({
      id: "epigrafe",
      file: "epigrafe.xhtml",
      title: tt("Epígrafe"),
      html: `<section class="dedicatoria" epub:type="epigraph"><p>${esc(c.epigrafe.trim()).replace(/\n/g, "<br/>")}</p>${
        c.epigrafeAutor ? `<p class="ep-autor">${esc(c.epigrafeAutor)}</p>` : ""
      }</section>`,
    });

  if (coverImg) files.push({ name: "OEBPS/imagens/capa.jpg", data: coverImg });
  fronts.forEach((f) => files.push({ name: `OEBPS/${f.file}`, data: xhtml(f.title, f.html, project.meta.idioma) }));
  chapters.forEach((ch, k) =>
    files.push({ name: `OEBPS/cap${k + 1}.xhtml`, data: xhtml(ch.title, `<section epub:type="chapter">\n${ch.html.join("\n")}\n</section>`, project.meta.idioma) })
  );

  const nav = xhtml(
    tdoc(project.meta.idioma, "Sumário"),
    `<nav epub:type="toc" id="toc"><h1>${tdoc(project.meta.idioma, "Sumário")}</h1><ol>${chapters
      .map((ch, k) => `<li><a href="cap${k + 1}.xhtml">${esc(ch.title)}</a></li>`)
      .join("")}</ol></nav>`,
    project.meta.idioma
  );

  const id = `urn:uuid:${project.meta.id}`;
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${project.meta.idioma ?? "pt-BR"}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${id}</dc:identifier>
<dc:title>${esc(title)}</dc:title>
${author ? `<dc:creator>${esc(author)}</dc:creator>` : ""}
<dc:language>pt-BR</dc:language>
<meta property="dcterms:modified">${modified}</meta>
${coverImg ? '<meta name="cover" content="capa-img"/>' : ""}
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="css" href="estilo.css" media-type="text/css"/>
${coverImg ? '<item id="capa-img" href="imagens/capa.jpg" media-type="image/jpeg" properties="cover-image"/>' : ""}
${fronts.map((f) => `<item id="${f.id}" href="${f.file}" media-type="application/xhtml+xml"/>`).join("\n")}
${chapters.map((_, k) => `<item id="cap${k + 1}" href="cap${k + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("\n")}
</manifest>
<spine>
${fronts.map((f) => `<itemref idref="${f.id}"/>`).join("\n")}
<itemref idref="nav"${parts.sumario ? "" : ' linear="no"'}/>
${chapters.map((_, k) => `<itemref idref="cap${k + 1}"/>`).join("\n")}
</spine>
</package>`;

  return makeZip([
    { name: "mimetype", data: "application/epub+zip" },
    {
      name: "META-INF/container.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    },
    { name: "OEBPS/content.opf", data: opf },
    { name: "OEBPS/nav.xhtml", data: nav },
    { name: "OEBPS/estilo.css", data: css },
    ...files,
  ]);
}

// Web (novel): página HTML pronta para publicar e trecho para colar
const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function webRuns(el: ScreenplayElement): string {
  return runsOf(el)
    .map((r) => {
      let t = escHtml(r.text).replace(/\n/g, "<br>");
      if (r.i) t = `<em>${t}</em>`;
      if (r.b) t = `<strong>${t}</strong>`;
      return t;
    })
    .join("");
}

export interface WebChapter {
  titulo: string;
  html: string;
}

/** Capítulos do livro em HTML simples (p, em, strong, blockquote, hr). */
export function webChapters(project: LoadedProject): WebChapter[] {
  const out: WebChapter[] = [];
  let cur: WebChapter | null = null;
  const abrir = (titulo: string) => {
    cur = { titulo, html: "" };
    out.push(cur);
  };
  project.screenplay.elementos.forEach((el) => {
    if (el.tipo === "capitulo") {
      abrir(el.texto.trim() || tdoc(project.meta.idioma, "Capítulo {n}", { n: out.length + 1 }));
      return;
    }
    if (!cur) abrir("");
    const c = cur as unknown as WebChapter;
    if (el.tipo === "separador") c.html += `<p class="sep">* * *</p>\n`;
    else if (el.tipo === "citacao") c.html += `<blockquote><p>${webRuns(el)}</p></blockquote>\n`;
    else if (el.texto.trim()) c.html += `<p>${webRuns(el)}</p>\n`;
  });
  return out.filter((c) => c.titulo || c.html.trim());
}

/** Página HTML completa, legível no celular e no computador, com sumário. */
export function toWebPage(project: LoadedProject): string {
  const { cover } = project;
  const titulo = cover.titulo || project.meta.nome;
  const autor = cover.autor || project.meta.autor;
  const caps = webChapters(project);
  const comSumario = caps.filter((c) => c.titulo).length > 1;
  const corpo = caps
    .map((c, i) => `<section id="cap-${i + 1}">${c.titulo ? `\n<h2>${escHtml(c.titulo)}</h2>` : ""}\n${c.html}</section>`)
    .join("\n");
  return `<!doctype html>
<html lang="${project.meta.idioma ?? "pt-BR"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(titulo)}</title>
<meta name="author" content="${escHtml(autor)}">
<style>
  :root { color-scheme: light dark; --bg:#fbfaf7; --text:#1d1c19; --muted:#6b6962; --line:#e3e0d8; }
  @media (prefers-color-scheme: dark) { :root { --bg:#141413; --text:#e9e7e0; --muted:#9c998f; --line:#2c2b28; } }
  body { margin:0; background:var(--bg); color:var(--text); font:19px/1.75 Georgia, "Times New Roman", serif; }
  main { max-width: 38em; margin: 0 auto; padding: 56px 22px 120px; }
  header { text-align:center; margin-bottom: 48px; }
  h1 { font-size: 2em; line-height:1.2; margin: 0 0 .3em; }
  .autor { color: var(--muted); font-style: italic; }
  nav { border-top:1px solid var(--line); border-bottom:1px solid var(--line); padding: 14px 0; margin-bottom: 40px; font-size:.85em; }
  nav ol { margin:0; padding-left: 1.4em; }
  nav a { color: inherit; }
  h2 { font-size: 1.35em; margin: 2.6em 0 1em; text-align:center; }
  p { margin: 0 0 1em; }
  p.sep { text-align:center; color: var(--muted); letter-spacing:.4em; margin: 1.6em 0; }
  blockquote { margin: 1.2em 0; padding-left: 1em; border-left: 3px solid var(--line); color: var(--muted); font-style: italic; }
</style>
</head>
<body>
<main>
<header>
<h1>${escHtml(titulo)}</h1>
${autor ? `<div class="autor">${escHtml(autor)}</div>` : ""}
</header>
${comSumario ? `<nav><ol>${caps.map((c, i) => (c.titulo ? `<li><a href="#cap-${i + 1}">${escHtml(c.titulo)}</a></li>` : "")).join("")}</ol></nav>` : ""}
${corpo}
</main>
</body>
</html>
`;
}

/** Trecho para colar no Wattpad, Medium, WordPress, Blogger etc. (HTML + texto). */
export function webClipboard(project: LoadedProject, capitulo: number | "todos"): { html: string; text: string } {
  const caps = webChapters(project);
  const sel = capitulo === "todos" ? caps : caps.slice(capitulo, capitulo + 1);
  const html = sel.map((c) => `${c.titulo ? `<h2>${escHtml(c.titulo)}</h2>\n` : ""}${c.html}`).join("\n");
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = Array.from(div.children)
    .map((n) => (n.classList.contains("sep") ? "* * *" : (n as HTMLElement).innerText))
    .join("\n\n");
  return { html, text };
}
