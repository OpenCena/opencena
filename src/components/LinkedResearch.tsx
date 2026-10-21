import { useApp } from "@/store/appStore";
import { RefLink } from "@/types";
import { Icon } from "@/components/Icon";
import { LinkedEntry, linkedTo, newNode } from "@/domain/research";
import { openLink } from "@/storage/dir";
import { useProjectImageUrl } from "@/storage/images";
import { tt } from "@/i18n";
import "@/styles/research.css";

type IconName = Parameters<typeof Icon>[0]["name"];

const ICON: Record<LinkedEntry["tipo"], IconName> = {
  imagem: "image",
  link: "link",
  documento: "fileText",
  nota: "penLine",
  texto: "type",
  pagina: "fileText",
};

function Card({ e }: { e: LinkedEntry }) {
  const cur = useApp((s) => s.current!);
  const previewMode = useApp((s) => s.previewMode);
  const openResearch = useApp((s) => s.openResearch);
  const url = useProjectImageUrl(previewMode ? null : cur.root, e.tipo === "imagem" ? e.ref?.arquivo : undefined);
  return (
    <button
      className="lr-card"
      title={e.onde}
      onClick={() => {
        if (e.noId) openResearch(e.noId, e.itemId);
        else if (e.tipo === "link" && e.ref?.url) void openLink(e.ref.url);
      }}
    >
      {e.tipo === "imagem" && <div className="lr-thumb">{url && <img src={url} alt="" />}</div>}
      <div className="lr-body">
        <span className={`lr-name ${e.tipo === "link" ? "link" : ""}`}>
          <Icon name={ICON[e.tipo]} size={12} />
          {e.tipo === "imagem" && !e.ref?.titulo ? tt("Imagem") : e.titulo}
        </span>
        {e.trecho && <span className="lr-snip">{e.trecho}</span>}
        <span className="lr-where">{e.onde}</span>
      </div>
    </button>
  );
}

/**
 * Na ficha de um personagem, local ou objeto: tudo da Pesquisa vinculado a ele
 * (imagens, links, arquivos, notas e páginas). Clicar abre no lugar.
 */
export function LinkedResearch({ alvo, nome, semImagens = false }: { alvo: RefLink; nome: string; semImagens?: boolean }) {
  const project = useApp((s) => s.current!.project);
  const updatePesquisa = useApp((s) => s.updatePesquisa);
  const openResearch = useApp((s) => s.openResearch);
  // nas fichas, as imagens já aparecem na galeria
  const itens = linkedTo(project, alvo).filter((e) => !semImagens || e.tipo !== "imagem");

  function novaPagina() {
    const n = { ...newNode("pagina", null, nome || tt("Nova página")), vinculos: [alvo] };
    updatePesquisa({ nos: [...project.pesquisa.nos, n] });
    openResearch(n.id);
  }

  return (
    <div className="lr">
      <div className="lr-head">
        <span className="lr-title">{tt("Pesquisa e anotações")} {itens.length > 0 && `(${itens.length})`}</span>
        <button className="btn btn-ghost" style={{ padding: "5px 9px", fontSize: 12.5 }} onClick={novaPagina}>
          <Icon name="plus" size={13} />
          {tt("Página de pesquisa")}
        </button>
      </div>
      {itens.length === 0 ? (
        <p className="lr-empty">
          {tt("Nada vinculado ainda. Na Pesquisa, selecione uma imagem, link, arquivo ou nota e use \"Vincular\" para que apareça aqui.")}
        </p>
      ) : (
        <div className="lr-grid">
          {itens.map((e) => (
            <Card key={e.key} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}
