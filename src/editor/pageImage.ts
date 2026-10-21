// Imagem dentro das páginas de texto da Pesquisa (como no Notion): colar, arrastar ou escolher um
// arquivo; arrastar a borda direita muda a largura.

import { Node, mergeAttributes } from "@tiptap/core";
import type { ProjectDir } from "@/storage/dir";
import { loadProjectImage } from "@/storage/images";
import { tt } from "@/i18n";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imagemPagina: {
      inserirImagem: (attrs: { arquivo: string; largura?: number }) => ReturnType;
    };
  }
}

const urls = new Map<string, string>();

async function urlDe(root: ProjectDir | null, arquivo: string): Promise<string | null> {
  const pronta = urls.get(arquivo);
  if (pronta) return pronta;
  const blob = await loadProjectImage(root, arquivo);
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(arquivo, u);
  return u;
}

export const PageImage = Node.create<{ root: ProjectDir | null }>({
  name: "imagem",
  group: "block",
  atom: true,
  draggable: true,
  addOptions() {
    return { root: null };
  },
  addAttributes() {
    return {
      arquivo: { default: null },
      largura: { default: 100 },
    };
  },
  parseHTML() {
    return [{ tag: "figure[data-arquivo]", getAttrs: (el) => ({ arquivo: (el as HTMLElement).dataset.arquivo, largura: Number((el as HTMLElement).dataset.largura) || 100 }) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes({ "data-arquivo": HTMLAttributes.arquivo, "data-largura": HTMLAttributes.largura })];
  },
  addCommands() {
    return {
      inserirImagem:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
  addNodeView() {
    const root = this.options.root;
    return ({ node, getPos, editor }) => {
      const fig = document.createElement("figure");
      fig.className = "np-img";
      const caixa = document.createElement("div");
      caixa.className = "np-img-box";
      const img = document.createElement("img");
      img.draggable = false;
      const alca = document.createElement("span");
      alca.className = "np-img-handle";
      alca.title = tt("Arraste para mudar o tamanho");
      caixa.append(img, alca);
      fig.append(caixa);

      let atual = node;
      const aplicar = () => {
        caixa.style.width = `${atual.attrs.largura ?? 100}%`;
        const arq = atual.attrs.arquivo as string | null;
        if (arq) void urlDe(root, arq).then((u) => u && (img.src = u));
      };
      aplicar();

      // redimensionar pela alça
      alca.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const largTotal = fig.getBoundingClientRect().width;
        const inicio = e.clientX;
        const de = caixa.getBoundingClientRect().width;
        const mover = (ev: MouseEvent) => {
          const pct = Math.max(15, Math.min(100, ((de + ev.clientX - inicio) / largTotal) * 100));
          caixa.style.width = `${pct}%`;
        };
        const soltar = (ev: MouseEvent) => {
          window.removeEventListener("mousemove", mover);
          window.removeEventListener("mouseup", soltar);
          const pct = Math.round(Math.max(15, Math.min(100, ((de + ev.clientX - inicio) / largTotal) * 100)));
          const pos = typeof getPos === "function" ? getPos() : null;
          if (pos != null) editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...atual.attrs, largura: pct }));
        };
        window.addEventListener("mousemove", mover);
        window.addEventListener("mouseup", soltar);
      });

      return {
        dom: fig,
        update: (n) => {
          if (n.type.name !== "imagem") return false;
          atual = n;
          aplicar();
          return true;
        },
        selectNode: () => fig.classList.add("sel"),
        deselectNode: () => fig.classList.remove("sel"),
        ignoreMutation: () => true,
      };
    };
  },
});
