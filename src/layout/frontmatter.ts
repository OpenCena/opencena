// Páginas de abertura: folha de rosto do roteiro/HQ e, no novel, capa, folha de rosto, créditos,
// dedicatória, epígrafe e sumário.

import { BookParts, CoverImage, DEFAULT_BOOK_PARTS, LoadedProject } from "@/types";
import { Layout, PT, pageLeftMargin, pageSettingsOf } from "./profiles";
import { TocEntry } from "./tocCache";
import { tt, tdoc } from "@/i18n";

export interface FrontItem {
  text: string;
  x: number; // px, âncora conforme align
  y: number; // px, topo da linha
  sizePt: number;
  lineHeight: number; // px
  bold?: boolean;
  italic?: boolean;
  align: "left" | "center" | "right";
  color?: "claro" | "escuro" | "suave";
  /** Pontilhado até a borda direita (sumário). */
  leaderTo?: number;
}

export interface FrontPage {
  key: string;
  label: string;
  /** Lado exigido no livro impresso (com margens espelhadas). */
  side: "recto" | "verso" | "any";
  items: FrontItem[];
  image?: CoverImage;
}

// medida de texto (canvas)
let ctx: CanvasRenderingContext2D | null = null;
function measure(text: string, fontCss: string, sizePt: number, bold = false, italic = false): number {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * sizePt * 0.6 * PT;
  ctx.font = `${italic ? "italic " : ""}${bold ? "700 " : ""}${sizePt}pt ${fontCss}`;
  return ctx.measureText(text).width;
}

function wrap(text: string, maxW: number, fontCss: string, sizePt: number, bold = false, italic = false): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (line && measure(t, fontCss, sizePt, bold, italic) > maxW) {
        out.push(line);
        line = w;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

const lh = (pt: number, k = 1.3) => pt * PT * k;

/** Partes do livro ativas (com padrão para projetos antigos). */
export function bookPartsOf(p: LoadedProject): BookParts {
  return { ...DEFAULT_BOOK_PARTS, ...(p.meta.livro ?? {}) };
}

export function buildFrontMatter(p: LoadedProject, l: Layout, toc: TocEntry[], words = 0): FrontPage[] {
  const font = l.fontInfo.css;
  const c = p.cover;
  const title = (c.titulo || p.meta.nome || "").trim();
  const author = (c.autor || p.meta.autor || "").trim();
  const W = l.pageW;
  const H = l.pageH;

  // roteiro e quadrinhos: folha de rosto de indústria
  if (l.kind !== "novel") {
    const items: FrontItem[] = [];
    const cx = W / 2;
    const L = 12 * PT * 1.15;
    let y = H * 0.38;
    items.push({ text: title.toUpperCase(), x: cx, y, sizePt: 14, lineHeight: lh(14), bold: true, align: "center" });
    y += lh(14);
    if (c.subtitulo) {
      items.push({ text: c.subtitulo, x: cx, y: y + 6, sizePt: 12, lineHeight: L, align: "center" });
      y += L + 6;
    }
    y += 54;
    // "escrito por"/"roteiro de" só aparece quando há um autor para creditar
    if (author) {
      items.push({ text: l.kind === "quadrinhos" ? tdoc(l.lang, "roteiro de") : tdoc(l.lang, "escrito por"), x: cx, y, sizePt: 12, lineHeight: L, align: "center" });
      y += L + 6;
      items.push({ text: author, x: cx, y, sizePt: 12, lineHeight: L, align: "center" });
    }
    if (c.baseadoEm) items.push({ text: c.baseadoEm, x: cx, y: y + L + 48, sizePt: 12, lineHeight: L, align: "center" });
    const bottom = H - l.marginBottom - L;
    const contato = [c.contato, c.telefone, c.email].filter(Boolean);
    contato.forEach((t, i) =>
      items.push({ text: t, x: l.marginInner, y: bottom - (contato.length - 1 - i) * L, sizePt: 12, lineHeight: L, align: "left" })
    );
    if (c.data) items.push({ text: c.data, x: W - l.marginOuter, y: bottom, sizePt: 12, lineHeight: L, align: "right" });
    return [{ key: "titulo", label: tt("Folha de rosto"), side: "any", items }];
  }

  // novel
  const parts = bookPartsOf(p);
  const s = pageSettingsOf(p.meta);
  const base = l.basePt;
  const pages: FrontPage[] = [];
  // posição horizontal de cada página depende do lado (margens espelhadas)
  const box = (side: "recto" | "verso") => {
    const left = pageLeftMargin(l, side === "recto" ? 0 : 1);
    const right = W - (side === "recto" ? l.marginOuter : l.marginInner);
    return { left, right, cx: (left + right) / 2, w: right - left };
  };

  if (parts.capa) {
    const t = c.capaTexto ?? { mostrar: true, cor: "claro", posicao: "base" };
    const items: FrontItem[] = [];
    // sem imagem, o texto segue a cor normal da folha (preto no PDF, claro no tema escuro)
    const cor = c.imagem ? t.cor : undefined;
    if (t.mostrar || !c.imagem) {
      const tSize = Math.round(base * 2.6);
      const aSize = Math.round(base * 1.4);
      const maxW = W * 0.8;
      const tl = wrap(title, maxW, font, tSize, true);
      const block = tl.length * lh(tSize, 1.15) + 18 + lh(aSize);
      const y0 =
        t.posicao === "topo" ? H * 0.1 : t.posicao === "meio" ? (H - block) / 2 : H * 0.9 - block;
      const pos = c.imagem ? y0 : H * 0.3;
      tl.forEach((line, i) =>
        items.push({ text: line, x: W / 2, y: pos + i * lh(tSize, 1.15), sizePt: tSize, lineHeight: lh(tSize, 1.15), bold: true, align: "center", color: cor })
      );
      if (author)
        items.push({
          text: author,
          x: W / 2,
          y: c.imagem ? pos + tl.length * lh(tSize, 1.15) + 18 : H * 0.62,
          sizePt: aSize,
          lineHeight: lh(aSize),
          align: "center",
          color: cor,
        });
    }
    pages.push({ key: "capa", label: tt("Capa"), side: "recto", items, image: c.imagem });
  }

  if (parts.folhaRosto) {
    const b = box("recto");
    const items: FrontItem[] = [];
    if (s.modelo === "manuscrito") {
      // padrão de manuscrito: autor no alto à esquerda, contagem de palavras à
      // direita, título no meio da página
      const L = lh(12, 1.2);
      if (author) items.push({ text: author, x: b.left, y: l.marginTop, sizePt: 12, lineHeight: L, align: "left" });
      const approx = Math.max(100, Math.round(words / 100) * 100);
      items.push({ text: tdoc(l.lang, "aprox. {n} palavras", { n: approx.toLocaleString(l.lang) }), x: b.right, y: l.marginTop, sizePt: 12, lineHeight: L, align: "right" });
      items.push({ text: title.toUpperCase(), x: b.cx, y: H * 0.45, sizePt: 16, lineHeight: lh(16), bold: true, align: "center" });
      if (c.subtitulo) items.push({ text: c.subtitulo, x: b.cx, y: H * 0.45 + lh(16) + 4, sizePt: 12, lineHeight: L, align: "center" });
      if (author) items.push({ text: tdoc(l.lang, "por {autor}", { autor: author }), x: b.cx, y: H * 0.45 + lh(16) + L * 2.5, sizePt: 12, lineHeight: L, align: "center" });
    } else {
      const tSize = Math.round(base * 2.2);
      if (author) items.push({ text: author, x: b.cx, y: l.marginTop + H * 0.08, sizePt: base * 1.2, lineHeight: lh(base * 1.2), align: "center" });
      const tl = wrap(title, b.w, font, tSize, true);
      tl.forEach((line, i) =>
        items.push({ text: line, x: b.cx, y: H * 0.32 + i * lh(tSize, 1.15), sizePt: tSize, lineHeight: lh(tSize, 1.15), bold: true, align: "center" })
      );
      if (c.subtitulo)
        items.push({ text: c.subtitulo, x: b.cx, y: H * 0.32 + tl.length * lh(tSize, 1.15) + 10, sizePt: base * 1.2, lineHeight: lh(base * 1.2), italic: true, align: "center" });
      const foot = [c.editora, c.data].filter(Boolean) as string[];
      foot.forEach((t, i) =>
        items.push({ text: t, x: b.cx, y: H - l.marginBottom - (foot.length - i) * lh(base), sizePt: base, lineHeight: lh(base), align: "center" })
      );
    }
    pages.push({ key: "rosto", label: tt("Folha de rosto"), side: "recto", items });
  }

  if (parts.creditos) {
    const b = box("verso");
    const cr = c.creditos ?? { copyright: "", edicao: "", isbn: "", editora: "", ficha: "" };
    const size = Math.max(7, Math.round(base * 0.8 * 2) / 2);
    const L = lh(size, 1.35);
    const lines: { t: string; italic?: boolean }[] = [];
    const ano = new Date().getFullYear();
    lines.push({ t: cr.copyright || `© ${ano} ${author}`.trim() });
    lines.push({ t: tdoc(l.lang, "Todos os direitos reservados.") });
    if (cr.edicao) lines.push({ t: cr.edicao });
    if (cr.isbn) lines.push({ t: `ISBN ${cr.isbn}` });
    if (cr.editora) lines.push({ t: cr.editora });
    const ficha = cr.ficha ? wrap(cr.ficha, b.w, font, size) : [];
    const total = lines.length + (ficha.length ? ficha.length + 1 : 0);
    let y = H - l.marginBottom - total * L;
    const items: FrontItem[] = [];
    for (const ln of lines) {
      for (const w of wrap(ln.t, b.w, font, size)) {
        items.push({ text: w, x: b.left, y, sizePt: size, lineHeight: L, align: "left" });
        y += L;
      }
    }
    if (ficha.length) {
      y += L;
      ficha.forEach((t) => {
        items.push({ text: t, x: b.left, y, sizePt: size, lineHeight: L, align: "left", color: "suave" });
        y += L;
      });
    }
    pages.push({ key: "creditos", label: tt("Créditos"), side: "verso", items });
  }

  if (parts.dedicatoria) {
    const b = box("recto");
    const L = lh(base, 1.45);
    const lines = wrap((c.dedicatoria ?? "").trim(), b.w * 0.6, font, base, false, true);
    const items: FrontItem[] = lines.map((t, i) => ({
      text: t,
      x: b.right,
      y: H * 0.3 + i * L,
      sizePt: base,
      lineHeight: L,
      italic: true,
      align: "right",
    }));
    pages.push({ key: "dedicatoria", label: tt("Dedicatória"), side: "recto", items });
  }

  if (parts.epigrafe) {
    const b = box("recto");
    const L = lh(base, 1.45);
    const lines = wrap((c.epigrafe ?? "").trim(), b.w * 0.62, font, base, false, true);
    const items: FrontItem[] = lines.map((t, i) => ({
      text: t,
      x: b.right,
      y: H * 0.3 + i * L,
      sizePt: base,
      lineHeight: L,
      italic: true,
      align: "right",
    }));
    if (c.epigrafeAutor)
      items.push({ text: c.epigrafeAutor, x: b.right, y: H * 0.3 + lines.length * L + L * 0.6, sizePt: base * 0.9, lineHeight: L, align: "right" });
    pages.push({ key: "epigrafe", label: tt("Epígrafe"), side: "recto", items });
  }

  if (parts.sumario) {
    const L = lh(base, 1.8);
    const titleSize = Math.round(base * 1.6);
    let page: FrontItem[] = [];
    let n = 0;
    let side: "recto" | "verso" = "recto";
    let b = box(side);
    let y = l.marginTop + l.contentH * 0.12;
    page.push({ text: tdoc(l.lang, "Sumário"), x: b.cx, y, sizePt: titleSize, lineHeight: lh(titleSize), bold: true, align: "center" });
    y += lh(titleSize) + L;
    const flush = () => {
      pages.push({ key: `sumario-${n}`, label: n === 0 ? tt("Sumário") : tt("Sumário (continuação)"), side: n === 0 ? "recto" : "any", items: page });
      n++;
      side = side === "recto" ? "verso" : "recto";
      b = box(side);
      page = [];
      y = l.marginTop;
    };
    const entries = toc.length ? toc : [{ titulo: tdoc(l.lang, "Os capítulos aparecem aqui"), pagina: 0 }];
    for (const e of entries) {
      const num = e.pagina ? String(e.pagina) : "";
      const numW = measure(num, font, base) + 12;
      const tl = wrap(e.titulo, b.w - numW - 24, font, base);
      if (y + tl.length * L > H - l.marginBottom) flush();
      tl.forEach((t, i) => {
        const last = i === tl.length - 1;
        page.push({
          text: t,
          x: b.left,
          y,
          sizePt: base,
          lineHeight: L,
          align: "left",
          leaderTo: last && num ? b.right - numW : undefined,
          color: e.pagina ? undefined : "suave",
        });
        if (last && num) page.push({ text: num, x: b.right, y, sizePt: base, lineHeight: L, align: "right" });
        y += L;
      });
    }
    flush();
  }
  return pages;
}

/** Insere páginas em branco para cada página cair no lado certo (livro). */
export function withBlanks(pages: FrontPage[], l: Layout): (FrontPage | null)[] {
  if (!l.mirror) return pages;
  const out: (FrontPage | null)[] = [];
  for (const p of pages) {
    const recto = out.length % 2 === 0;
    if ((p.side === "recto" && !recto) || (p.side === "verso" && recto)) out.push(null);
    out.push(p);
  }
  // o texto começa numa página ímpar (direita)
  if (out.length % 2 === 1) out.push(null);
  return out;
}

/** Retângulo da imagem da capa (enquadramento estilo "cobrir" + zoom). */
export function coverImageRect(iw: number, ih: number, W: number, H: number, img: CoverImage) {
  const s = Math.max(W / iw, H / ih) * Math.max(1, img.zoom || 1);
  const w = iw * s;
  const h = ih * s;
  return { left: -(w - W) * clamp01(img.x), top: -(h - H) * clamp01(img.y), width: w, height: h };
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.5));
}

/** Largura do texto com a fonte do layout (para alinhar à direita/centro no PDF). */
export function measureFront(text: string, l: Layout, it: FrontItem): number {
  return measure(text, l.fontInfo.css, it.sizePt, it.bold, it.italic);
}
