// "Mobília" da página: número da página e cabeçalho corrente (autor nas páginas pares, título nas
// ímpares).

import { Layout, pageLeftMargin, pageNumberText } from "./profiles";
import { PageInfo } from "./paginate";

export interface FurnitureItem {
  text: string;
  x: number; // px a partir da borda esquerda da página (âncora conforme align)
  y: number; // px do topo da página até o topo da linha
  align: "left" | "right" | "center";
  sizePt: number;
  lineHeight: number;
  italic: boolean;
}

export function pageFurniture(
  l: Layout,
  page: PageInfo,
  info: { title: string; author: string }
): FurnitureItem[] {
  if (page.blank) return [];
  const items: FurnitureItem[] = [];
  const left = pageLeftMargin(l, page.index);
  const right = l.pageW - (left === l.marginInner ? l.marginOuter : l.marginInner);
  const center = (left + right) / 2;
  const recto = page.index % 2 === 0; // página ímpar (direita)
  const sizePt = l.kind === "novel" ? Math.max(8, Math.round(l.basePt * 0.85 * 2) / 2) : l.basePt;
  const lh = sizePt * (96 / 72) * 1.2;
  const topY = Math.max(4, l.marginTop / 2 - lh / 2);
  const bottomY = l.pageH - l.marginBottom / 2 - lh / 2;
  const n = page.index + 1;

  const num = l.numbering;
  const isTop = num === "topo-direita" || num === "topo-externo";
  const showNumber =
    num !== "nenhuma" && (n > 1 || l.numberFirstPage) && !(page.opener && isTop && l.kind === "novel");
  if (showNumber) {
    const text = pageNumberText(l, n);
    const outer = l.mirror ? (recto ? "right" : "left") : "right";
    if (num === "topo-direita") items.push({ text, x: right, y: topY, align: "right", sizePt, lineHeight: lh, italic: false });
    else if (num === "topo-externo")
      items.push({ text, x: outer === "right" ? right : left, y: topY, align: outer, sizePt, lineHeight: lh, italic: false });
    else if (num === "rodape-centro") items.push({ text, x: center, y: bottomY, align: "center", sizePt, lineHeight: lh, italic: false });
    else items.push({ text, x: outer === "right" ? right : left, y: bottomY, align: outer, sizePt, lineHeight: lh, italic: false });
  }

  if (l.runningHead && !page.opener) {
    const text = (recto ? info.title : info.author).trim();
    if (text) items.push({ text, x: center, y: topY, align: "center", sizePt, lineHeight: lh, italic: true });
  }
  return items;
}
