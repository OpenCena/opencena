// Paginação estilo Word / Final Draft a partir das medidas reais dos blocos.

import { BlockStyle, Layout } from "./profiles";
import { Measure } from "./measure";
import { StaticAttrs } from "./statics";

export interface PBlock {
  style: BlockStyle;
  m: Measure;
  a: StaticAttrs;
  /** Índices de caractere do início de cada linha (calculado só se precisar). */
  starts: () => number[];
  size: number;
}

export interface Seg {
  b: number; // índice do bloco
  fromLine: number;
  toLine: number; // exclusivo
  sb: number; // espaço antes aplicado (px)
  top: number; // y do topo do texto do pedaço, dentro da área de texto
  height: number; // altura das linhas do pedaço
}

export interface PageInfo {
  index: number;
  blank: boolean;
  segs: Seg[];
  used: number; // altura usada (sem a linha do (MAIS))
  /** A folha começa um capítulo/página forçada (sem cabeçalho corrente). */
  opener: boolean;
  /** Linha "(MAIS)" no pé da folha. */
  more?: { y: number };
  /** Linha "NOME (CONT'D)" no topo da folha. */
  cont?: { label: string };
}

const EPS = 0.5;

export function paginate(blocks: PBlock[], layout: Layout): PageInfo[] {
  const H = layout.contentH;
  const pages: PageInfo[] = [];
  let cur: PageInfo = { index: 0, blank: false, segs: [], used: 0, opener: false };
  pages.push(cur);

  const newPage = () => {
    cur = { index: pages.length, blank: false, segs: [], used: 0, opener: false };
    pages.push(cur);
  };
  const atTop = () => cur.segs.length === 0 && !cur.cont;

  const fullH = (i: number) => blocks[i].m.height;

  // Altura mínima que o bloco i precisa ocupar no fim de uma folha para não
  // ficar "sozinho" (inclui o espaço antes e a cadeia de manter-com-o-próximo).
  const minStart = (i: number, depth = 0): number => {
    const b = blocks[i];
    if (!b) return 0;
    let h: number;
    if (b.style.keepWithNext && i + 1 < blocks.length && depth < 4) {
      h = fullH(i) + minStart(i + 1, depth + 1);
    } else if (b.style.splittable) {
      const k = Math.min(b.m.lines, b.style.orphans);
      h = b.m.tops[k];
    } else {
      h = fullH(i);
    }
    return b.a.sb + h;
  };

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const s = b.style;
    const { lines, tops } = b.m;

    // Página nova forçada (capítulo / página da HQ).
    if (s.pageBreakBefore) {
      if (!atTop()) newPage();
      if (layout.chapterOdd && cur.index % 2 === 1) {
        cur.blank = true;
        newPage();
      }
      cur.opener = true;
    }

    let line = 0;
    let guard = 0;
    while (line < lines && guard++ < 10000) {
      const top = atTop();
      const sb = line === 0 ? (top ? s.sinkTop : b.a.sb) : 0;
      const avail = H - cur.used - sb;
      const restH = tops[lines] - tops[line];

      if (restH <= avail + EPS) {
        // Cabe inteiro. Mas se precisa ficar com o próximo e o próximo não
        // cabe, desce junto: desde que o conjunto caiba numa folha vazia.
        if (line === 0 && !top && s.keepWithNext && i + 1 < blocks.length) {
          const need = restH + minStart(i + 1);
          const fresh = s.sinkTop + restH + minStart(i + 1);
          if (need > avail + EPS && fresh <= H + EPS) {
            newPage();
            continue;
          }
        }
        cur.segs.push({ b: i, fromLine: line, toLine: lines, sb, top: cur.used + sb, height: restH });
        cur.used += sb + restH;
        line = lines;
        break;
      }

      // Não cabe inteiro nesta folha.
      const tooTall = restH > H - (line === 0 ? s.sinkTop : 0) + EPS;
      const canSplit = s.splittable || tooTall;
      if (!canSplit) {
        if (!top) {
          newPage();
          continue;
        }
        // topo da folha e mesmo assim não cabe (bloco gigante): corta.
      }

      const reserve = s.dialogSplit ? layout.lineHeight : 0; // linha do (MAIS)
      let k = 0;
      while (line + k < lines && tops[line + k + 1] - tops[line] <= avail - reserve + EPS) k++;

      const fitsFresh = !tooTall;
      if (fitsFresh && !top) {
        // viúva / órfã (só quando o bloco inteiro caberia numa folha nova;
        // senão, cortar é inevitável)
        if (line === 0 && k < s.orphans) {
          newPage();
          continue;
        }
        const rest = lines - (line + k);
        if (rest < s.widows) {
          k = lines - line - s.widows;
          if (k < (line === 0 ? s.orphans : 1)) {
            newPage();
            continue;
          }
        }
      }
      if (k <= 0) {
        if (!top) {
          newPage();
          continue;
        }
        k = 1; // garante progresso
      }

      const h = tops[line + k] - tops[line];
      cur.segs.push({ b: i, fromLine: line, toLine: line + k, sb, top: cur.used + sb, height: h });
      cur.used += sb + h;
      line += k;
      if (line < lines) {
        if (s.dialogSplit) cur.more = { y: cur.used };
        newPage();
        if (s.dialogSplit) {
          const name = (b.a.speaker || "").trim();
          cur.cont = { label: name ? `${name} ${layout.contd}` : layout.contd };
          cur.used = layout.lineHeight;
        }
      }
    }
  }

  return pages;
}

/** Página (índice) que contém o caractere `ch` do bloco `b`. */
export function pageOf(pages: PageInfo[], b: number, ch: number, blocks: PBlock[]): number {
  for (const p of pages) {
    for (const s of p.segs) {
      if (s.b !== b) continue;
      if (s.fromLine === 0 && s.toLine === blocks[b].m.lines) return p.index;
      const starts = blocks[b].starts();
      const from = starts[s.fromLine];
      const to = s.toLine >= starts.length ? Infinity : starts[s.toLine];
      if (ch >= from && ch < to) return p.index;
    }
  }
  return pages.length - 1;
}
