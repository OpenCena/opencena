// Motor de layout: documento ProseMirror -> blocos medidos -> páginas.

import type { Node as PMNode } from "@tiptap/pm/model";
import { ElementType } from "@/types";
import { Layout } from "./profiles";
import { Measurer } from "./measure";
import { BlockSource, StaticAttrs, computeStatics } from "./statics";
import { PBlock, PageInfo, paginate } from "./paginate";
import { tdoc } from "@/i18n";

export interface DocLayout {
  layout: Layout;
  nodes: { node: PMNode; pos: number }[];
  sources: BlockSource[];
  statics: StaticAttrs[];
  blocks: PBlock[];
  pages: PageInfo[];
}

/** Texto do bloco como no modelo do app (quebra de linha = "\n"). */
export function nodeText(node: PMNode): string {
  let t = "";
  node.forEach((c) => {
    if (c.isText) t += c.text ?? "";
    else if (c.type.name === "hardBreak") t += "\n";
  });
  return t;
}

export function layoutDoc(
  doc: PMNode,
  layout: Layout,
  measurer: Measurer,
  opts: { contd: boolean }
): DocLayout {
  const nodes: DocLayout["nodes"] = [];
  const sources: BlockSource[] = [];
  doc.forEach((node, pos) => {
    if (node.type.name !== "linha") return;
    nodes.push({ node, pos });
    sources.push({
      id: (node.attrs.id as string) || "",
      tipo: node.attrs.tipo as ElementType,
      texto: nodeText(node),
    });
  });

  // Tipos que não pertencem a este perfil (ex.: documento antigo) caem no padrão.
  const fallback = Object.keys(layout.blocks)[0] as ElementType;
  const statics = computeStatics(sources, layout, opts);
  const measures = measurer.measureAll(nodes.map((n, i) => ({ node: n.node, attrs: statics[i] })));

  const blocks: PBlock[] = nodes.map((n, i) => {
    const tipo = sources[i].tipo;
    const style = layout.blocks[tipo] ?? layout.blocks[fallback]!;
    const m = measures[i];
    return {
      style,
      m,
      a: statics[i],
      size: n.node.content.size,
      starts: () => measurer.lineStarts(n.node, statics[i], m),
    };
  });

  const pages = paginate(blocks, layout);
  return { layout, nodes, sources, statics, blocks, pages };
}

// Quebras de página para o editor: onde inserir o espaçador e de que altura.
export interface PageBreak {
  page: number; // folha que termina
  next: number; // próxima folha com texto (pula folhas em branco)
  b: number; // bloco do último pedaço da folha
  inline: boolean; // quebra no meio do bloco (true) ou depois dele (false)
  ch: number; // offset do caractere onde a próxima folha começa (inline)
  height: number; // altura do espaçador (px)
  more: boolean;
  cont?: string;
}

export function computeBreaks(dl: DocLayout): PageBreak[] {
  const { layout, pages, blocks } = dl;
  const pitch = layout.pageH + layout.gap;
  const content = pages.filter((p) => !p.blank && p.segs.length > 0);
  const out: PageBreak[] = [];
  for (let k = 0; k < content.length - 1; k++) {
    const p = content[k];
    const n = content[k + 1];
    const last = p.segs[p.segs.length - 1];
    const blk = blocks[last.b];
    const inline = last.toLine < blk.m.lines;
    const ch = inline ? blk.starts()[last.toLine] : blk.size;
    const contH = n.cont ? layout.lineHeight : 0;
    out.push({
      page: p.index,
      next: n.index,
      b: last.b,
      inline,
      ch,
      height: Math.max(0, (n.index - p.index) * pitch - p.used + contH),
      more: !!p.more,
      cont: n.cont?.label,
    });
  }
  return out;
}

/** Espaço antes (px) que cada bloco realmente recebe (0/afundamento no topo da folha). */
export function effectiveSpaceBefore(dl: DocLayout): number[] {
  const sb = dl.statics.map((a) => a.sb);
  for (const p of dl.pages) {
    const first = p.segs[0];
    if (first && first.fromLine === 0) sb[first.b] = first.sb;
  }
  return sb;
}

export function countWords(dl: Pick<DocLayout, "sources">): number {
  let n = 0;
  for (const s of dl.sources) {
    const m = s.texto.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu);
    if (m) n += m.length;
  }
  return n;
}

/** Capítulos e a página (do texto) onde cada um começa. */
export function tocFromLayout(dl: DocLayout): { titulo: string; pagina: number }[] {
  const first = new Map<number, number>();
  dl.pages.forEach((p) => p.segs.forEach((s) => !first.has(s.b) && first.set(s.b, p.index)));
  const out: { titulo: string; pagina: number }[] = [];
  let n = 0;
  dl.sources.forEach((s, i) => {
    if (s.tipo !== "capitulo") return;
    n += 1;
    out.push({ titulo: s.texto.replace(/\n/g, " ").trim() || tdoc(dl.layout.lang, "Capítulo {n}", { n }), pagina: (first.get(i) ?? 0) + 1 });
  });
  return out;
}
