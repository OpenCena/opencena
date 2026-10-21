// PDF a partir do MESMO motor de layout do editor.

import { jsPDF } from "jspdf";
import type { ProjectDir } from "@/storage/dir";
import { getSchema } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { CoverImage, LoadedProject } from "@/types";
import { schemaExtensions } from "@/editor/schema";
import { elementosParaDoc } from "@/editor/convert";
import { Layout, MM, kindOf, pageLeftMargin, resolveLayout } from "@/layout/profiles";
import { Measurer } from "@/layout/measure";
import { DocLayout, countWords, layoutDoc, nodeText, tocFromLayout } from "@/layout/engine";
import { FrontItem, FrontPage, buildFrontMatter, coverImageRect, withBlanks } from "@/layout/frontmatter";
import { loadProjectImage } from "@/storage/images";
import { PdfStyle, ensureScreenFont, loadEmbedFont } from "@/fonts";

/** Embute no PDF a fonte do documento (a mesma da tela) e ajusta as métricas. */
async function embedFont(pdf: jsPDF, layout: Layout): Promise<Layout> {
  const fam = layout.fontInfo.embed;
  if (!fam) return layout;
  let metrics: { ascent: number; descent: number } | null = null;
  for (const style of ["normal", "bold", "italic", "bolditalic"] as PdfStyle[]) {
    const f = await loadEmbedFont(fam, style);
    const file = `${fam.replace(/\s+/g, "")}-${style}.ttf`;
    pdf.addFileToVFS(file, f.b64);
    pdf.addFont(file, fam, style);
    if (style === "normal") metrics = { ascent: f.ascent, descent: f.descent };
  }
  return metrics ? { ...layout, fontInfo: { ...layout.fontInfo, ...metrics } } : layout;
}
import { PageInfo } from "@/layout/paginate";
import { pageFurniture } from "@/layout/furniture";
import { prefixText } from "@/layout/statics";

export interface PdfOptions {
  mode: "paginas" | "livreto";
  /** Folha usada no livreto. */
  sheet: "a4" | "carta";
  /** Incluir folha de rosto (capa). */
  titlePage: boolean;
  /** Marcas de corte no livreto quando a página é menor que meia folha. */
  cropMarks: boolean;
}

export const DEFAULT_PDF_OPTIONS: PdfOptions = {
  mode: "paginas",
  sheet: "a4",
  titlePage: true,
  cropMarks: true,
};

const PX2PT = 0.75; // 1px (96 dpi) = 0.75pt

type FontStyle = "normal" | "bold" | "italic" | "bolditalic";

/** Transformação de uma página do documento para a folha do PDF (pt). */
interface Place {
  ox: number;
  oy: number;
  s: number;
}

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
}

function fontStyle(bold: boolean, italic: boolean): FontStyle {
  return bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal";
}

const isLetter = (c: string | undefined) => !!c && /\p{L}/u.test(c);

/** Trechos (com negrito/itálico) do bloco entre dois offsets, sem quebras. */
function runsOf(node: PMNode, from: number, to: number): Run[] {
  const out: Run[] = [];
  let off = 0;
  node.forEach((child) => {
    const len = child.isText ? child.text!.length : 1;
    const a = Math.max(from, off);
    const b = Math.min(to, off + len);
    if (child.isText && b > a) {
      const text = child.text!.slice(a - off, b - off);
      const bold = child.marks.some((m) => m.type.name === "bold");
      const italic = child.marks.some((m) => m.type.name === "italic");
      const last = out[out.length - 1];
      if (last && last.bold === bold && last.italic === italic) last.text += text;
      else out.push({ text, bold, italic });
    }
    off += len;
  });
  return out;
}

class Renderer {
  constructor(
    private pdf: jsPDF,
    private l: Layout,
    private dl: DocLayout,
    private info: { title: string; author: string }
  ) {}

  private font(bold: boolean, italic: boolean, pt: number, p: Place) {
    this.pdf.setFont(this.l.fontInfo.pdf, fontStyle(bold, italic));
    this.pdf.setFontSize(pt * p.s);
  }

  /** Linha de base (px a partir do topo da linha), igual ao navegador. */
  private baseline(lineHeight: number, pt: number): number {
    const fpx = pt * (96 / 72);
    const { ascent, descent } = this.l.fontInfo;
    return (lineHeight - (ascent + descent) * fpx) / 2 + ascent * fpx;
  }

  private width(runs: Run[], pt: number, baseBold: boolean, baseItalic: boolean, p: Place): number {
    let w = 0;
    for (const r of runs) {
      this.font(baseBold || r.bold, baseItalic || r.italic, pt, p);
      w += this.pdf.getTextWidth(r.text);
    }
    return w;
  }

  private text(t: string, xPx: number, yPx: number, p: Place) {
    if (!t) return;
    this.pdf.text(t, p.ox + xPx * PX2PT * p.s, p.oy + yPx * PX2PT * p.s, { baseline: "alphabetic" });
  }

  drawPage(page: PageInfo, p: Place) {
    const { l, dl } = this;
    this.pdf.setTextColor(0, 0, 0);
    const left = pageLeftMargin(l, page.index);

    for (const f of pageFurniture(l, page, this.info)) {
      this.font(false, f.italic, f.sizePt, p);
      const w = this.pdf.getTextWidth(f.text) / (PX2PT * p.s);
      const x = f.align === "left" ? f.x : f.align === "right" ? f.x - w : f.x - w / 2;
      this.text(f.text, x, f.y + this.baseline(f.lineHeight, f.sizePt), p);
    }

    const top = l.marginTop;
    const charLeft = l.blocks.personagem?.indentLeft ?? 0;
    if (page.cont) {
      this.font(l.kind === "roteiro", false, l.basePt, p);
      this.text(page.cont.label.toUpperCase(), left + charLeft, top + this.baseline(l.lineHeight, l.basePt), p);
    }
    if (page.more) {
      this.font(false, false, l.basePt, p);
      this.text(l.more, left + charLeft, top + page.more.y + this.baseline(l.lineHeight, l.basePt), p);
    }

    for (const seg of page.segs) {
      const b = dl.blocks[seg.b];
      const node = dl.nodes[seg.b].node;
      const a = dl.statics[seg.b];
      const st = b.style;
      const plain = nodeText(node);
      const starts = b.m.lines > 1 ? b.starts() : [0];
      const size = b.size;

      // números na margem (cena / balão)
      if (seg.fromLine === 0) {
        const y0 = top + seg.top + this.baseline(st.lineHeight, st.fontPt);
        if (a.scene) {
          this.font(true, false, st.fontPt, p);
          this.text(String(a.scene), left - 0.62 * 96, y0, p);
        }
        if (a.bn) {
          this.font(true, false, st.fontPt, p);
          this.text(String(a.bn), left + 4 * MM, y0, p);
        }
      }

      for (let ln = seg.fromLine; ln < seg.toLine; ln++) {
        const from = starts[ln] ?? 0;
        const to = ln + 1 < b.m.lines ? starts[ln + 1] ?? size : size;
        const yTop = top + seg.top + (b.m.tops[ln] - b.m.tops[seg.fromLine]);
        const y = yTop + this.baseline(st.lineHeight, st.fontPt);

        let runs = runsOf(node, from, to);
        const endsWithBreak = plain[to - 1] === "\n";
        // espaços no fim da linha "penduram" fora da margem: não contam
        const lastRun = runs[runs.length - 1];
        if (lastRun) lastRun.text = lastRun.text.replace(/\s+$/u, "");
        runs = runs.filter((r) => r.text.length > 0);

        if (ln === 0) {
          const pre = prefixText(l, node.attrs.tipo, a);
          if (pre) runs.unshift({ text: pre, bold: !!st.prefix || st.bold, italic: false });
        }
        if (ln === b.m.lines - 1 && a.contd) runs.push({ text: ` ${l.contd}`, bold: false, italic: false });
        if (l.hyphenate && to < size && isLetter(plain[to - 1]) && isLetter(plain[to])) {
          if (runs.length) runs[runs.length - 1].text += "-";
        }
        if (st.upper) runs = runs.map((r) => ({ ...r, text: r.text.toUpperCase() }));
        if (!runs.length) continue;

        const indent = ln === 0 && !a.noIndent ? st.firstIndent : 0;
        const x0 = left + st.indentLeft + indent;
        const avail = l.contentW - st.indentLeft - st.indentRight - indent;
        const wPt = this.width(runs, st.fontPt, st.bold, st.italic, p);
        const w = wPt / (PX2PT * p.s);

        const lastLine = ln === b.m.lines - 1 || endsWithBreak;
        if (st.align === "justify" && !lastLine) {
          this.drawJustified(runs, x0, y, avail, w, st, p);
          continue;
        }
        let x = x0;
        if (st.align === "right") x = x0 + avail - w;
        else if (st.align === "center") x = x0 + (avail - w) / 2;
        for (const r of runs) {
          this.font(st.bold || r.bold, st.italic || r.italic, st.fontPt, p);
          this.text(r.text, x, y, p);
          x += this.pdf.getTextWidth(r.text) / (PX2PT * p.s);
        }
      }
    }
  }

  private drawJustified(
    runs: Run[],
    x0: number,
    y: number,
    avail: number,
    w: number,
    st: { bold: boolean; italic: boolean; fontPt: number },
    p: Place
  ) {
    const spaces = runs.reduce((n, r) => n + (r.text.match(/ /g)?.length ?? 0), 0);
    const extra = spaces > 0 ? Math.max(0, avail - w) / spaces : 0;
    let x = x0;
    for (const r of runs) {
      this.font(st.bold || r.bold, st.italic || r.italic, st.fontPt, p);
      for (const tok of r.text.split(/( )/)) {
        if (!tok) continue;
        const tw = this.pdf.getTextWidth(tok) / (PX2PT * p.s);
        if (tok === " ") {
          x += tw + extra;
        } else {
          this.text(tok, x, y, p);
          x += tw;
        }
      }
    }
  }
}

// Páginas de abertura (mesmas linhas que a aba Capa mostra)
function drawFront(pdf: jsPDF, page: FrontPage, l: Layout, p: Place, coverJpeg: string | null) {
  if (page.image && coverJpeg) {
    pdf.addImage(coverJpeg, "JPEG", p.ox, p.oy, l.pageW * PX2PT * p.s, l.pageH * PX2PT * p.s);
  }
  const fpx = (pt: number) => pt * (96 / 72);
  for (const it of page.items) {
    pdf.setFont(l.fontInfo.pdf, fontStyle(!!it.bold, !!it.italic));
    pdf.setFontSize(it.sizePt * p.s);
    if (it.color === "claro") pdf.setTextColor(255, 255, 255);
    else if (it.color === "suave") pdf.setTextColor(90, 90, 90);
    else pdf.setTextColor(17, 17, 17);
    const wPx = pdf.getTextWidth(it.text) / (PX2PT * p.s);
    const xPx = it.align === "left" ? it.x : it.align === "right" ? it.x - wPx : it.x - wPx / 2;
    const { ascent, descent } = l.fontInfo;
    const base = it.y + (it.lineHeight - (ascent + descent) * fpx(it.sizePt)) / 2 + ascent * fpx(it.sizePt);
    const X = (v: number) => p.ox + v * PX2PT * p.s;
    const Y = (v: number) => p.oy + v * PX2PT * p.s;
    pdf.text(it.text, X(xPx), Y(base));
    if (it.leaderTo && it.leaderTo > xPx + wPx + 12) {
      pdf.setDrawColor(120, 120, 120);
      pdf.setLineWidth(0.5 * p.s);
      pdf.setLineDashPattern([0.6 * p.s, 2.6 * p.s], 0);
      pdf.line(X(xPx + wPx + 6), Y(base - 1), X(it.leaderTo - 6), Y(base - 1));
      pdf.setLineDashPattern([], 0);
    }
  }
  pdf.setTextColor(0, 0, 0);
}

/**
 * Recorta a imagem da capa no enquadramento escolhido (JPEG, ~300 dpi).
 * Com `items`, também escreve título/autor na imagem (para Word e EPUB, onde
 * a capa vira uma figura só).
 */
export async function renderCoverJpeg(
  root: ProjectDir | null,
  img: CoverImage,
  l: Layout,
  items?: FrontItem[],
  maxPx = 2400
): Promise<string | null> {
  const blob = await loadProjectImage(root, img.arquivo);
  if (!blob) return null;
  const bmp = await createImageBitmap(blob);
  const dpi300 = (l.pageW / 96) * 300;
  const scale = Math.min(maxPx, dpi300) / l.pageW;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(l.pageW * scale);
  canvas.height = Math.round(l.pageH * scale);
  const g = canvas.getContext("2d")!;
  const r = coverImageRect(bmp.width, bmp.height, l.pageW, l.pageH, img);
  g.drawImage(bmp, r.left * scale, r.top * scale, r.width * scale, r.height * scale);
  bmp.close();
  for (const it of items ?? []) {
    const fpx = it.sizePt * (96 / 72);
    const { ascent, descent } = l.fontInfo;
    const base = it.y + (it.lineHeight - (ascent + descent) * fpx) / 2 + ascent * fpx;
    g.font = `${it.italic ? "italic " : ""}${it.bold ? "700 " : ""}${fpx * scale}px ${l.fontInfo.css}`;
    g.textAlign = it.align;
    g.textBaseline = "alphabetic";
    g.fillStyle = it.color === "claro" ? "#ffffff" : "#111111";
    g.shadowColor = it.color === "claro" ? "rgba(0,0,0,0.45)" : "transparent";
    g.shadowBlur = it.color === "claro" ? 8 * scale : 0;
    g.fillText(it.text, it.x * scale, base * scale);
  }
  return canvas.toDataURL("image/jpeg", 0.92);
}

// Montagem
type PageDraw = ((pdf: jsPDF, p: Place) => void) | null; // null = página em branco

/** Calcula o layout do projeto fora do editor (mesmo motor da tela). */
export function layoutProject(project: LoadedProject, withStarts = true): { dl: DocLayout; layout: Layout } {
  const kind = kindOf(project.meta);
  const layout = resolveLayout(project.meta);
  const schema = getSchema(schemaExtensions(kind) as any);
  const json = elementosParaDoc(project.screenplay.elementos, kind.defaultType);
  const doc = schema.nodeFromJSON(json);
  const measurer = new Measurer(schema, layout);
  try {
    const dl = layoutDoc(doc, layout, measurer, { contd: project.meta.contdEnabled !== false });
    // força o cálculo das quebras de linha enquanto o medidor existe
    if (withStarts) dl.blocks.forEach((b) => b.m.lines > 1 && b.starts());
    return { dl, layout };
  } finally {
    measurer.destroy();
  }
}

export async function buildPdf(
  project: LoadedProject,
  opts: PdfOptions = DEFAULT_PDF_OPTIONS,
  root: ProjectDir | null = null
): Promise<jsPDF> {
  const fam = resolveLayout(project.meta).fontInfo.embed;
  if (fam) await ensureScreenFont(fam);
  if (document.fonts?.ready) await document.fonts.ready;
  const { dl, layout: baseLayout } = layoutProject(project);
  let layout = baseLayout;
  const info = {
    title: (project.cover.titulo || project.meta.nome || "").trim(),
    author: (project.cover.autor || project.meta.autor || "").trim(),
  };
  const words = countWords(dl);

  const pages: PageDraw[] = [];
  if (opts.titlePage) {
    const front = withBlanks(buildFrontMatter(project, layout, tocFromLayout(dl), words), layout);
    const capa = front.find((f) => f?.image);
    const coverJpeg = capa?.image ? await renderCoverJpeg(root, capa.image, layout) : null;
    for (const f of front) pages.push(f ? (pdf, p) => drawFront(pdf, f, layout, p, coverJpeg) : null);
  }
  const pdfRef: { r?: Renderer } = {};
  for (const page of dl.pages) {
    if (page.blank) pages.push(null);
    else pages.push((_pdf, p) => pdfRef.r!.drawPage(page, p));
  }

  const pw = layout.pageW * PX2PT;
  const ph = layout.pageH * PX2PT;

  if (opts.mode === "paginas") {
    const pdf = new jsPDF({ unit: "pt", format: [pw, ph], orientation: pw > ph ? "landscape" : "portrait" });
    layout = await embedFont(pdf, layout);
    pdfRef.r = new Renderer(pdf, layout, dl, info);
    pages.forEach((draw, i) => {
      if (i > 0) pdf.addPage([pw, ph], pw > ph ? "landscape" : "portrait");
      draw?.(pdf, { ox: 0, oy: 0, s: 1 });
    });
    setProps(pdf, info);
    return pdf;
  }

  // livreto: 2 páginas por lado, folha deitada
  const sheetMm = opts.sheet === "carta" ? { w: 279.4, h: 215.9 } : { w: 297, h: 210 };
  const SW = sheetMm.w * (72 / 25.4);
  const SH = sheetMm.h * (72 / 25.4);
  const half = SW / 2;
  const s = Math.min(1, half / pw, SH / ph);
  const n = Math.ceil(pages.length / 4) * 4;
  while (pages.length < n) pages.push(null);

  const pdf = new jsPDF({ unit: "pt", format: [SW, SH], orientation: "landscape" });
  layout = await embedFont(pdf, layout);
  pdfRef.r = new Renderer(pdf, layout, dl, info);
  const w = pw * s;
  const h = ph * s;
  const oy = (SH - h) / 2;
  const place = (side: "left" | "right"): Place => ({ ox: side === "left" ? half - w : half, oy, s });

  // Marcas de corte nos cantos externos (só se a página for menor que meia folha)
  // e marcas da dobra no meio, em cima e embaixo.
  const marks = (pdf: jsPDF) => {
    if (!opts.cropMarks) return;
    const g = 4;
    const L = 12;
    const roomX = half - w;
    const roomY = oy;
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.3);
    for (const x of [half - w, half + w]) {
      const dir = x < half ? -1 : 1;
      for (const y of [oy, oy + h]) {
        const vdir = y === oy ? -1 : 1;
        if (roomX > g + 2) pdf.line(x + dir * g, y, x + dir * Math.min(g + L, roomX), y);
        if (roomY > g + 2) pdf.line(x, y + vdir * g, x, y + vdir * Math.min(g + L, roomY));
      }
    }
    if (roomY > g + 2) {
      pdf.line(half, oy - g, half, oy - Math.min(g + L, roomY));
      pdf.line(half, oy + h + g, half, oy + h + Math.min(g + L, roomY));
    }
  };

  for (let i = 0; i < n / 4; i++) {
    const faces: [number, number][] = [
      [n - 1 - 2 * i, 2 * i], // frente: última à esquerda, primeira à direita
      [2 * i + 1, n - 2 - 2 * i], // verso
    ];
    faces.forEach(([lp, rp], fi) => {
      if (i > 0 || fi > 0) pdf.addPage([SW, SH], "landscape");
      pages[lp]?.(pdf, place("left"));
      pages[rp]?.(pdf, place("right"));
      marks(pdf);
    });
  }
  setProps(pdf, info);
  return pdf;
}

function setProps(pdf: jsPDF, info: { title: string; author: string }) {
  pdf.setProperties({ title: info.title, author: info.author, creator: "OpenCena" });
}

export function pdfFileName(project: LoadedProject, opts: PdfOptions): string {
  const base = (project.cover.titulo || project.meta.nome || "documento").replace(/[<>:"/\\|?*]/g, "").trim() || "documento";
  return opts.mode === "livreto" ? `${base} - livreto.pdf` : `${base}.pdf`;
}

/** Gera e baixa o PDF com as opções padrão (atalho da busca/command palette). */
export async function exportPdf(
  project: LoadedProject,
  opts: PdfOptions = DEFAULT_PDF_OPTIONS,
  root: ProjectDir | null = null
): Promise<void> {
  const pdf = await buildPdf(project, opts, root);
  pdf.save(pdfFileName(project, opts));
}
