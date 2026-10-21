// Paginação ao vivo no editor (estilo Word).

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Layout } from "@/layout/profiles";
import { Measurer } from "@/layout/measure";
import { DocLayout, PageBreak, computeBreaks, effectiveSpaceBefore, layoutDoc } from "@/layout/engine";

export interface PagState {
  layout: Layout;
  contd: boolean;
  dl: DocLayout;
  decos: DecorationSet;
  /** Incrementa a cada repaginação (para a UI saber que mudou). */
  version: number;
}

export interface PagMeta {
  layout?: Layout;
  contd?: boolean;
  refresh?: boolean;
}

export const paginacaoKey = new PluginKey<PagState>("paginacao");

function isLetter(ch: string | undefined): boolean {
  return !!ch && /\p{L}/u.test(ch);
}

function spacerDom(br: PageBreak, layout: Layout, offsetLeft: number): HTMLElement {
  const el = document.createElement(br.inline ? "span" : "div");
  el.className = br.inline ? "pg-spacer pg-inline" : "pg-spacer";
  el.contentEditable = "false";
  el.setAttribute("aria-hidden", "true");
  el.style.height = `${br.height}px`;
  const charLeft = layout.blocks.personagem?.indentLeft ?? 0;
  if (br.more) {
    const m = document.createElement("span");
    m.className = "pg-more";
    m.textContent = layout.more;
    m.style.left = `${charLeft - offsetLeft}px`;
    el.appendChild(m);
  }
  if (br.cont) {
    const c = document.createElement("span");
    c.className = "pg-cont";
    c.textContent = br.cont;
    c.style.left = `${charLeft - offsetLeft}px`;
    c.style.top = `${br.height - layout.lineHeight}px`;
    el.appendChild(c);
  }
  return el;
}

function buildDecorations(doc: PMNode, dl: DocLayout): DecorationSet {
  const { layout, nodes, statics, blocks } = dl;
  const decos: Decoration[] = [];
  const sb = effectiveSpaceBefore(dl);

  nodes.forEach(({ node, pos }, i) => {
    const a = statics[i];
    const attrs: Record<string, string> = {};
    const cls: string[] = [];
    if (a.label !== undefined) attrs["data-label"] = a.label;
    if (a.noIndent) cls.push("no-indent");
    if (a.contd) cls.push("has-contd");
    if (a.bn) attrs["data-bn"] = String(a.bn);
    if (a.scene) attrs["data-scene"] = String(a.scene);
    if (a.info) attrs["data-info"] = a.info;
    let style = "";
    if (Math.abs(sb[i] - blocks[i].style.spaceBefore) > 0.001) style += `padding-top:${sb[i]}px;`;
    // números na margem se alinham à 1ª linha do texto (abaixo do espaço antes)
    if (a.scene || a.bn || a.info) style += `--sb:${sb[i]}px;`;
    if (style) attrs.style = style;
    if (cls.length) attrs.class = cls.join(" ");
    if (Object.keys(attrs).length) {
      decos.push(Decoration.node(pos, pos + node.nodeSize, attrs));
    }
  });

  for (const br of computeBreaks(dl)) {
    const { node, pos } = nodes[br.b];
    const key = `pg${br.page}-${br.height}-${br.more ? 1 : 0}-${br.cont ?? ""}-${br.inline ? 1 : 0}`;
    if (br.inline) {
      const at = pos + 1 + br.ch;
      const style = blocks[br.b].style;
      const text = doc.textBetween(Math.max(pos + 1, at - 1), Math.min(pos + 1 + node.content.size, at + 1), "\n", "\n");
      if (layout.hyphenate && text.length === 2 && isLetter(text[0]) && isLetter(text[1])) {
        decos.push(
          Decoration.widget(
            at,
            () => {
              const h = document.createElement("span");
              h.className = "pg-hyph";
              h.textContent = "-";
              return h;
            },
            { side: -2, key: `${key}-h`, ignoreSelection: true }
          )
        );
      }
      decos.push(
        Decoration.widget(at, () => spacerDom(br, layout, style.indentLeft), {
          side: -1,
          key,
          ignoreSelection: true,
        })
      );
    } else {
      decos.push(
        Decoration.widget(pos + node.nodeSize, () => spacerDom(br, layout, 0), {
          side: -1,
          key,
          ignoreSelection: true,
        })
      );
    }
  }
  return DecorationSet.create(doc, decos);
}

export const Paginacao = Extension.create<{ layout: Layout | null; contd: boolean }>({
  name: "paginacao",

  addOptions() {
    return { layout: null, contd: true };
  },

  addProseMirrorPlugins() {
    const initial = this.options.layout!;
    const measurer = new Measurer(this.editor.schema, initial);
    const contd0 = this.options.contd;

    const compute = (doc: PMNode, layout: Layout, contd: boolean, version: number): PagState => {
      measurer.setLayout(layout);
      const dl = layoutDoc(doc, layout, measurer, { contd });
      return { layout, contd, dl, decos: buildDecorations(doc, dl), version };
    };

    return [
      new Plugin<PagState>({
        key: paginacaoKey,
        state: {
          init: (_cfg, state) => compute(state.doc, initial, contd0, 1),
          apply: (tr, prev, _old, newState) => {
            const meta = tr.getMeta(paginacaoKey) as PagMeta | undefined;
            if (!tr.docChanged && !meta) return prev;
            const layout = meta?.layout ?? prev.layout;
            const contd = meta?.contd ?? prev.contd;
            return compute(newState.doc, layout, contd, prev.version + 1);
          },
        },
        props: {
          decorations: (state) => paginacaoKey.getState(state)?.decos ?? DecorationSet.empty,
        },
        view: (view) => {
          const off = measurer.onInvalidate(() => {
            view.dispatch(view.state.tr.setMeta(paginacaoKey, { refresh: true } as PagMeta));
          });
          return {
            destroy: () => {
              off();
              measurer.destroy();
            },
          };
        },
      }),
    ];
  },
});
