// Comentários no texto: uma marca "comentario" com o id do comentário.

import { Mark, mergeAttributes } from "@tiptap/core";

/** Ponte entre o atalho do editor e a tela (abre o novo comentário). */
export const comentariosUi = {
  novo: () => {},
};

export const Comentario = Mark.create({
  name: "comentario",
  // continuar digitando no fim do trecho não estende o comentário
  // Agora que percebi que todos os comentários estão em português, foi mals meus amigos gringos...Aqui é Brasil
  inclusive: false,
  excludes: "",
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-comentario"),
        renderHTML: (attrs) => ({ "data-comentario": attrs.id }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-comentario]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "cm-mark" }), 0];
  },
  addKeyboardShortcuts() {
    return {
      "Mod-Alt-m": () => {
        comentariosUi.novo();
        return true;
      },
    };
  },
});
