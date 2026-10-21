// Localizar e substituir (Ctrl+F / Ctrl+H).

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { nodeText } from "@/layout/engine";

export interface Hit {
  from: number;
  to: number;
}

export interface BuscaState {
  query: string;
  caso: boolean;
  hits: Hit[];
  atual: number;
  decos: DecorationSet;
}

interface BuscaMeta {
  query?: string;
  caso?: boolean;
  atual?: number;
}

export const buscaKey = new PluginKey<BuscaState>("busca");

/** Abrir a barra de busca a partir do teclado do editor (preenchido pela UI). */
export const buscaUi: { open: (replace: boolean) => void } = { open: () => {} };

function findHits(doc: PMNode, query: string, caso: boolean): Hit[] {
  if (!query) return [];
  const q = caso ? query : query.toLocaleLowerCase("pt-BR");
  const hits: Hit[] = [];
  doc.forEach((node, pos) => {
    if (node.type.name !== "linha") return;
    let text = nodeText(node);
    if (!caso) text = text.toLocaleLowerCase("pt-BR");
    let i = text.indexOf(q);
    while (i >= 0 && hits.length < 5000) {
      hits.push({ from: pos + 1 + i, to: pos + 1 + i + q.length });
      i = text.indexOf(q, i + Math.max(1, q.length));
    }
  });
  return hits;
}

function decorate(doc: PMNode, hits: Hit[], atual: number): DecorationSet {
  if (!hits.length) return DecorationSet.empty;
  return DecorationSet.create(
    doc,
    hits.map((h, i) => Decoration.inline(h.from, h.to, { class: i === atual ? "find-hit find-current" : "find-hit" }))
  );
}

function compute(state: EditorState, prev: BuscaState | null, meta: BuscaMeta): BuscaState {
  const query = meta.query ?? prev?.query ?? "";
  const caso = meta.caso ?? prev?.caso ?? false;
  const hits = findHits(state.doc, query, caso);
  let atual = meta.atual ?? prev?.atual ?? 0;
  if (meta.query !== undefined && meta.atual === undefined) {
    // nova busca: começa na ocorrência mais próxima depois do cursor
    const from = state.selection.from;
    const idx = hits.findIndex((h) => h.from >= from);
    atual = idx >= 0 ? idx : 0;
  }
  atual = hits.length ? ((atual % hits.length) + hits.length) % hits.length : 0;
  return { query, caso, hits, atual, decos: decorate(state.doc, hits, atual) };
}

export const Busca = Extension.create({
  name: "busca",
  addKeyboardShortcuts() {
    return {
      "Mod-f": () => {
        buscaUi.open(false);
        return true;
      },
      "Mod-h": () => {
        buscaUi.open(true);
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<BuscaState>({
        key: buscaKey,
        state: {
          init: (_c, state) => compute(state, null, {}),
          apply: (tr, prev, _o, state) => {
            const meta = tr.getMeta(buscaKey) as BuscaMeta | undefined;
            if (meta) return compute(state, prev, meta);
            if (tr.docChanged && prev.query) return compute(state, prev, {});
            return prev;
          },
        },
        props: {
          decorations: (state) => buscaKey.getState(state)?.decos ?? DecorationSet.empty,
        },
      }),
    ];
  },
});

// ações usadas pela barra de busca
function goTo(view: EditorView, st: BuscaState, tr: Transaction) {
  const h = st.hits[st.atual];
  if (h) tr.setSelection(TextSelection.create(tr.doc, h.from, h.to));
  view.dispatch(tr);
  if (h) scrollToPos(view, h.from);
}

/**
 * Rola a área das folhas até a posição. (O scrollIntoView do ProseMirror rola a
 * partir do elemento com foco, que aqui é a caixa de busca, e não acha a área.)
 */
function scrollToPos(view: EditorView, pos: number) {
  const scroller = view.dom.closest(".pv-canvas") as HTMLElement | null;
  if (!scroller) return;
  try {
    const c = view.coordsAtPos(pos);
    const r = scroller.getBoundingClientRect();
    const margin = r.height * 0.3;
    if (c.top < r.top + 40 || c.bottom > r.bottom - 40) {
      scroller.scrollTop += c.top - r.top - margin;
    }
    if (c.left < r.left || c.right > r.right) {
      scroller.scrollLeft += c.left - r.left - r.width / 2;
    }
  } catch {
    /* posição fora do documento */
  }
}

export function setBusca(view: EditorView, query: string, caso: boolean) {
  const tr = view.state.tr.setMeta(buscaKey, { query, caso } as BuscaMeta);
  const next = view.state.apply(tr);
  const st = buscaKey.getState(next)!;
  goTo(view, st, tr);
}

export function moverBusca(view: EditorView, dir: number) {
  const st = buscaKey.getState(view.state);
  if (!st || !st.hits.length) return;
  const atual = (st.atual + dir + st.hits.length) % st.hits.length;
  const tr = view.state.tr.setMeta(buscaKey, { atual } as BuscaMeta);
  goTo(view, { ...st, atual }, tr);
}

export function substituir(view: EditorView, texto: string) {
  const st = buscaKey.getState(view.state);
  if (!st || !st.hits.length) return;
  const h = st.hits[st.atual];
  const tr = view.state.tr.insertText(texto, h.from, h.to);
  tr.setMeta(buscaKey, { atual: st.atual } as BuscaMeta);
  view.dispatch(tr);
  const st2 = buscaKey.getState(view.state);
  if (st2?.hits.length) moverBusca(view, 0);
}

export function substituirTodos(view: EditorView, texto: string): number {
  const st = buscaKey.getState(view.state);
  if (!st || !st.hits.length) return 0;
  const tr = view.state.tr;
  for (let i = st.hits.length - 1; i >= 0; i--) tr.insertText(texto, st.hits[i].from, st.hits[i].to);
  view.dispatch(tr);
  return st.hits.length;
}

export function limparBusca(view: EditorView) {
  view.dispatch(view.state.tr.setMeta(buscaKey, { query: "" } as BuscaMeta));
}
