// Medidor: mede cada bloco num elemento invisível com o MESMO CSS do editor.

import { DOMSerializer, Node as PMNode, Schema } from "@tiptap/pm/model";
import { ElementType } from "@/types";
import { Layout } from "./profiles";
import { ensureLayoutCss } from "./css";
import { StaticAttrs, layoutSig } from "./statics";

export interface Measure {
  height: number; // px (sem o espaço antes)
  lines: number;
  /** tops[k] = topo da linha k relativo ao topo do bloco; tops[lines] = altura. */
  tops: number[];
  /** starts[k] = índice do caractere onde a linha k começa (preenchido sob demanda). */
  starts?: number[];
}

/** Aplica no elemento os atributos estáticos que afetam a quebra de linha. */
export function applyStaticDom(el: HTMLElement, a: StaticAttrs): void {
  if (a.label !== undefined) el.setAttribute("data-label", a.label);
  if (a.noIndent) el.classList.add("no-indent");
  if (a.contd) el.classList.add("has-contd");
}

export class Measurer {
  private outer: HTMLDivElement;
  private host: HTMLDivElement;
  private inner: HTMLDivElement;
  private ser: DOMSerializer;
  private cache = new WeakMap<PMNode, Map<string, Measure>>();
  private layout: Layout;
  private listeners = new Set<() => void>();

  constructor(schema: Schema, layout: Layout) {
    this.ser = DOMSerializer.fromSchema(schema);
    this.layout = layout;
    // Caixa externa com contenção total: medir um bloco não obriga o navegador
    // a recalcular o layout da página inteira (importante em livros grandes).
    this.outer = document.createElement("div");
    this.outer.setAttribute("aria-hidden", "true");
    this.outer.style.cssText =
      "position:absolute;left:-100000px;top:0;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;contain:strict;";
    this.host = document.createElement("div");
    this.inner = document.createElement("div");
    this.inner.className = "pv-text";
    this.host.appendChild(this.inner);
    this.outer.appendChild(this.host);
    document.body.appendChild(this.outer);
    this.applyLayout();
    // Quando uma fonte termina de carregar, as larguras mudam: mede de novo.
    if (document.fonts) {
      document.fonts.addEventListener?.("loadingdone", this.onFonts);
    }
  }

  private onFonts = () => {
    this.cache = new WeakMap();
    this.listeners.forEach((fn) => fn());
  };

  /** Avisa quando as medidas antigas deixaram de valer (fontes carregadas). */
  onInvalidate(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private applyLayout() {
    const cls = ensureLayoutCss(this.layout);
    this.host.className = `pv-flow pv-measure ${cls}`;
    this.host.style.width = `${this.layout.contentW}px`;
  }

  setLayout(layout: Layout) {
    if (layout.sig === this.layout.sig) return;
    this.layout = layout;
    this.cache = new WeakMap();
    this.applyLayout();
  }

  destroy() {
    document.fonts?.removeEventListener?.("loadingdone", this.onFonts);
    this.outer.remove();
    this.listeners.clear();
  }

  private build(node: PMNode, a: StaticAttrs): HTMLElement {
    const el = this.ser.serializeNode(node) as HTMLElement;
    applyStaticDom(el, a);
    // O ProseMirror põe um <br> no fim de blocos vazios (ou terminados em quebra
    // de linha) para a linha existir; o serializador não, reproduzimos.
    const last = node.lastChild;
    if (node.childCount === 0 || (last && last.type.name === "hardBreak")) {
      el.appendChild(document.createElement("br"));
    }
    return el;
  }

  private lineHeightOf(tipo: ElementType): number {
    return this.layout.blocks[tipo]?.lineHeight ?? this.layout.lineHeight;
  }

  private fromHeight(tipo: ElementType, h: number): Measure {
    const lh = this.lineHeightOf(tipo);
    const lines = Math.max(1, Math.round(h / lh));
    const step = h / lines; // == lh quando todas as linhas têm a mesma altura
    const tops: number[] = [];
    for (let k = 0; k < lines; k++) tops.push(k * step);
    tops.push(h);
    return { height: h, lines, tops };
  }

  private get(node: PMNode, a: StaticAttrs): Measure | undefined {
    return this.cache.get(node)?.get(layoutSig(a));
  }

  private put(node: PMNode, a: StaticAttrs, m: Measure) {
    let map = this.cache.get(node);
    if (!map) {
      map = new Map();
      this.cache.set(node, map);
    }
    map.set(layoutSig(a), m);
  }

  /** Mede vários blocos de uma vez (um único cálculo de layout para os novos). */
  measureAll(items: { node: PMNode; attrs: StaticAttrs }[]): Measure[] {
    const out: (Measure | undefined)[] = items.map((it) => this.get(it.node, it.attrs));
    const pending: { i: number; el: HTMLElement }[] = [];
    const frag = document.createDocumentFragment();
    items.forEach((it, i) => {
      if (out[i]) return;
      const el = this.build(it.node, it.attrs);
      frag.appendChild(el);
      pending.push({ i, el });
    });
    if (pending.length) {
      this.inner.appendChild(frag);
      for (const p of pending) {
        const h = p.el.getBoundingClientRect().height;
        const m = this.fromHeight(items[p.i].node.attrs.tipo as ElementType, h);
        this.put(items[p.i].node, items[p.i].attrs, m);
        out[p.i] = m;
      }
      this.inner.textContent = "";
    }
    return out as Measure[];
  }

  /**
   * Índice do caractere (offset dentro do bloco, contando quebra de linha como 1)
   * onde cada linha visual começa. Calculado por busca binária sobre as posições
   * dos caracteres no medidor.
   */
  lineStarts(node: PMNode, a: StaticAttrs, m: Measure): number[] {
    if (m.starts) return m.starts;
    if (m.lines <= 1) {
      m.starts = [0];
      return m.starts;
    }
    const el = this.build(node, a);
    this.inner.appendChild(el);
    try {
      m.starts = computeStarts(el, node.content.size, m);
    } finally {
      this.inner.textContent = "";
    }
    return m.starts;
  }
}

/** Mapeia offsets do bloco para nós do DOM serializado (texto e <br>). */
function computeStarts(el: HTMLElement, size: number, m: Measure): number[] {
  const segs: { start: number; node: Text | HTMLElement; len: number }[] = [];
  let base = 0;
  const walk = (n: Node) => {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === Node.TEXT_NODE) {
        const len = (c as Text).data.length;
        if (len) segs.push({ start: base, node: c as Text, len });
        base += len;
      } else if (c.nodeName === "BR") {
        if (base < size) {
          segs.push({ start: base, node: c as HTMLElement, len: 1 });
          base += 1;
        }
      } else {
        walk(c);
      }
    }
  };
  walk(el);

  const elTop = el.getBoundingClientRect().top;
  const step = m.height / m.lines;
  const range = document.createRange();
  let si = 0;

  const lineOf = (o: number): number => {
    // acha o segmento que contém o offset (os offsets crescem; começa do último)
    if (si >= segs.length || segs[si].start > o) si = 0;
    while (si < segs.length - 1 && segs[si].start + segs[si].len <= o) si++;
    const s = segs[si];
    let r: DOMRect;
    if (s.node.nodeType === Node.TEXT_NODE) {
      const off = Math.min(o - s.start, s.len - 1);
      range.setStart(s.node, off);
      range.setEnd(s.node, off + 1);
      const rects = range.getClientRects();
      // um caractere hifenizado/quebrado pode ter 2 retângulos: vale o último
      r = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    } else {
      r = (s.node as HTMLElement).getBoundingClientRect();
    }
    const mid = r.top + r.height / 2 - elTop;
    return Math.max(0, Math.min(m.lines - 1, Math.floor(mid / step)));
  };

  const starts = [0];
  for (let k = 1; k < m.lines; k++) {
    let lo = starts[k - 1];
    let hi = size; // hi = "nenhum caractere começa a linha k" (linha vazia final)
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lineOf(mid) >= k) hi = mid;
      else lo = mid + 1;
    }
    starts.push(lo);
  }
  return starts;
}
