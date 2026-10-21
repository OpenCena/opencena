// Schema do editor no TipTap/ProseMirror, o mesmo para roteiro, quadrinhos e novel; muda só o
// perfil (tipos de bloco, Enter/Tab, negrito/itálico).

import { Extension, InputRule, Node, type AnyExtension } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import HardBreak from "@tiptap/extension-hard-break";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import { UndoRedo, Dropcursor, Placeholder } from "@tiptap/extensions";
import { Plugin } from "@tiptap/pm/state";
import { Paginacao } from "./pagination";
import { Busca } from "./search";
import { Comentario } from "./comments";
import { autocomplete } from "./autocompleteBridge";
import { ElementType } from "@/types";
import { KindDef, Layout, blockDef, nextTypeOnEnter, nextTypeOnTab } from "@/layout/profiles";

// O documento só contém "linha" (nada de parágrafo/heading do StarterKit).
export const RoteiroDoc = Document.extend({ content: "linha+" });

function makeLinha(kind: KindDef) {
  return Node.create({
    name: "linha",
    group: "block",
    content: "inline*",
    // roteiro não tem negrito/itálico, mas aceita comentários
    marks: kind.marks ? "_" : "comentario",

    addAttributes() {
      return {
        tipo: {
          default: kind.defaultType,
          parseHTML: (el) => (el as HTMLElement).getAttribute("data-tipo") || kind.defaultType,
          renderHTML: (attrs) => ({ "data-tipo": attrs.tipo }),
        },
        // id estável do bloco (mesmo id do ScreenplayElement).
        id: {
          default: null,
          parseHTML: (el) => (el as HTMLElement).getAttribute("data-id"),
          renderHTML: (attrs) => (attrs.id ? { "data-id": attrs.id } : {}),
        },
      };
    },

    parseHTML() {
      // Blocos colados de dentro do app mantêm o tipo; texto de fora (Word,
      // navegador) vira blocos do tipo padrão.
      return [{ tag: "div[data-tipo]" }, { tag: "p" }, { tag: "h1" }, { tag: "h2" }, { tag: "h3" }, { tag: "li" }, { tag: "blockquote" }];
    },

    renderHTML({ node }) {
      const tipo = node.attrs.tipo as ElementType;
      return ["div", { class: `blk blk-${tipo}`, "data-tipo": tipo, "data-id": node.attrs.id ?? "" }, 0];
    },

    addKeyboardShortcuts() {
      const tipoAtual = () => this.editor.state.selection.$from.parent.attrs.tipo as ElementType;
      const setTipo = (tipo: ElementType) => () =>
        this.editor.commands.updateAttributes("linha", { tipo });

      const keys: Record<string, () => boolean> = {
        // Enter: quebra o bloco e o novo bloco assume o tipo natural seguinte
        // (cabeçalho→ação, personagem→diálogo, quadro→descrição...).
        Enter: () => {
          const { $from, empty } = this.editor.state.selection;
          const atual = tipoAtual();
          // Enter num bloco vazio (que não é o padrão) só troca o tipo, como
          // no Final Draft: "Enter, Enter" volta para ação/parágrafo.
          if (empty && $from.parent.content.size === 0 && atual !== kind.defaultType && kind.id === "roteiro") {
            const alvo = atual === "dialogo" || atual === "parentese" ? "acao" : null;
            if (alvo) return this.editor.commands.updateAttributes("linha", { tipo: alvo });
          }
          const atEnd = $from.parentOffset === $from.parent.content.size;
          const proximo = atEnd ? nextTypeOnEnter(kind, atual) : atual;
          return this.editor.chain().splitBlock().updateAttributes("linha", { tipo: proximo }).run();
        },
        // Shift+Enter: quebra de linha DENTRO do mesmo bloco.
        "Shift-Enter": () => this.editor.commands.setHardBreak(),
        // Setas navegam a sugestão de autocomplete quando ela está aberta.
        ArrowDown: () => (autocomplete.active ? autocomplete.move(1) : false),
        ArrowUp: () => (autocomplete.active ? autocomplete.move(-1) : false),
        Escape: () => (autocomplete.active ? autocomplete.close() : false),
        // Tab: aceita a sugestão se houver; senão, circula o tipo do bloco.
        Tab: () => {
          if (autocomplete.active && autocomplete.accept()) return true;
          if (!kind.tabCycles) return true; // no novel o Tab não sai do editor
          return this.editor.commands.updateAttributes("linha", { tipo: nextTypeOnTab(kind, tipoAtual()) });
        },
        "Shift-Tab": () => {
          if (!kind.tabCycles) return true;
          return this.editor.commands.updateAttributes("linha", { tipo: nextTypeOnTab(kind, tipoAtual(), -1) });
        },
      };
      kind.blocks.forEach((b, i) => {
        if (i < 9) keys[`Mod-${i + 1}`] = setTipo(b.tipo);
      });
      return keys;
    },

    // Garante que todo bloco tenha um id único (ao dividir com Enter, o novo
    // bloco herda o id do original, aqui reatribuímos um id novo) e que o tipo
    // pertença ao perfil.
    addProseMirrorPlugins() {
      const validos = new Set(kind.blocks.map((b) => b.tipo));
      return [
        new Plugin({
          appendTransaction: (trs, _old, newState) => {
            if (!trs.some((t) => t.docChanged)) return null;
            const seen = new Set<string>();
            let tr = newState.tr;
            let changed = false;
            newState.doc.forEach((node, pos) => {
              if (node.type.name !== "linha") return;
              const id = node.attrs.id as string | null;
              if (!id || seen.has(id)) {
                tr = tr.setNodeAttribute(pos, "id", crypto.randomUUID());
                changed = true;
              } else {
                seen.add(id);
              }
              if (!validos.has(node.attrs.tipo)) {
                tr = tr.setNodeAttribute(pos, "tipo", kind.defaultType);
                changed = true;
              }
            });
            return changed ? tr : null;
          },
        }),
      ];
    },
  });
}

// Tipografia do texto corrido: "--" vira travessão (diálogo em português),
// "..." vira reticências.
const Tipografia = Extension.create({
  name: "tipografia",
  addInputRules() {
    return [
      new InputRule({
        find: /--$/,
        handler: ({ state, range }) => {
          state.tr.insertText("—", range.from, range.to);
        },
      }),
      new InputRule({
        find: /\.\.\.$/,
        handler: ({ state, range }) => {
          state.tr.insertText("…", range.from, range.to);
        },
      }),
    ];
  },
});

// Negrito/itálico só por atalho (Ctrl+B / Ctrl+I) ou botão, sem atalhos de
// markdown, que atrapalhariam quem escreve "* * *" ou *asteriscos*.
const Negrito = Bold.extend({
  addInputRules() {
    return [];
  },
  addPasteRules() {
    return [];
  },
});
const Italico = Italic.extend({
  addInputRules() {
    return [];
  },
  addPasteRules() {
    return [];
  },
});

export function buildExtensions(kind: KindDef, opts: { layout: Layout; contd: boolean }) {
  const exts: AnyExtension[] = [
    RoteiroDoc,
    makeLinha(kind),
    Text,
    HardBreak.configure({ keepMarks: true }),
    UndoRedo,
    Dropcursor,
    Placeholder.configure({
      includeChildren: false,
      placeholder: ({ node }) => blockDef(kind, node.attrs.tipo as ElementType)?.placeholder ?? "",
    }),
    Paginacao.configure({ layout: opts.layout, contd: opts.contd }),
    Busca,
    Comentario,
  ];
  if (kind.marks) exts.push(Negrito, Italico);
  if (kind.id === "novel") exts.push(Tipografia);
  return exts;
}

/** Extensões só para o schema (exportação sem editor aberto). */
export function schemaExtensions(kind: KindDef) {
  const exts: AnyExtension[] = [RoteiroDoc, makeLinha(kind), Text, HardBreak, Comentario];
  if (kind.marks) exts.push(Negrito, Italico);
  return exts;
}
