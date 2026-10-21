import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/appStore";
import { RefLink, ResearchNode, ResearchNodeKind, ResearchTree } from "@/types";
import { Icon } from "@/components/Icon";
import { confirmDialog } from "@/components/Dialogs";
import { BoardView } from "@/components/Board";
import { NotePage } from "@/components/NotePage";
import { kindOf } from "@/layout/profiles";
import { NODE_LABEL, childrenOf, descendants, docText, moveNode, newNode, patchNode, removeNode } from "@/domain/research";
import "@/styles/research.css";

export { linkKey } from "@/domain/research";
import { tt } from "@/i18n";

type IconName = Parameters<typeof Icon>[0]["name"];

export interface LinkTarget {
  value: string; // "tipo:id"
  label: string;
  link: RefLink;
  group: string;
}

/** Tudo a que algo da pesquisa pode ser vinculado: a obra e os elementos dela. */
export function useLinkTargets(): LinkTarget[] {
  const p = useApp((s) => s.current!.project);
  return useMemo(() => {
    const kind = kindOf(p.meta);
    const out: LinkTarget[] = [{ value: "obra", label: tt("A obra toda"), link: { tipo: "obra" }, group: "Obra" }];
    const add = (tipo: RefLink["tipo"], id: string, label: string, group: string) =>
      out.push({ value: `${tipo}:${id}`, label, link: { tipo, id }, group });
    p.characters.forEach((c) => add("personagem", c.id, c.nome || tt("Personagem sem nome"), tt("Personagens")));
    p.locations.forEach((l) => add("local", l.id, l.nome || tt("Local sem nome"), tt("Locais")));
    p.objects.forEach((o) => add("objeto", o.id, o.nome || tt("Objeto sem nome"), tt("Objetos")));
    let n = 0;
    p.screenplay.elementos.forEach((e) => {
      if (e.tipo !== kind.sectionType) return;
      n += 1;
      const t = e.texto.replace(/\n/g, " ").trim();
      const nome = kind.id === "roteiro" ? `${tt("Cena {n}", { n })}${t ? `: ${t}` : ""}` : kind.id === "quadrinhos" ? `${tt("Página {n}", { n })}${t ? `: ${t}` : ""}` : t || tt("Capítulo {n}", { n });
      add("secao", e.id, nome, kind.sectionLabel);
    });
    return out;
  }, [p]);
}

const NODE_ICON: Record<ResearchNodeKind, IconName> = { pasta: "folder", quadro: "grid", pagina: "fileText" };
const SEL_KEY = "opencena:pesquisa-aberto";

// barra lateral: árvore de pastas, quadros e páginas
function Tree({
  tree,
  paiId,
  depth,
  sel,
  onSelect,
  onChange,
  renomear,
  setRenomear,
  onDelete,
  onCreate,
}: {
  tree: ResearchTree;
  paiId: string | null;
  depth: number;
  sel: string | null;
  onSelect: (id: string) => void;
  onChange: (t: ResearchTree) => void;
  renomear: string | null;
  setRenomear: (id: string | null) => void;
  onDelete: (n: ResearchNode) => void;
  onCreate: (tipo: ResearchNodeKind, paiId: string | null) => void;
}) {
  const [over, setOver] = useState<{ id: string; onde: "antes" | "dentro" } | null>(null);
  return (
    <>
      {childrenOf(tree, paiId).map((n) => {
        const filhos = n.tipo === "pasta" ? childrenOf(tree, n.id).length : 0;
        return (
          <div key={n.id}>
            <div
              className={`rt-row ${sel === n.id ? "active" : ""} ${over?.id === n.id ? `over-${over.onde}` : ""}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              draggable={renomear !== n.id}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-opencena-no", n.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!Array.from(e.dataTransfer.types).includes("application/x-opencena-no")) return;
                e.preventDefault();
                e.stopPropagation();
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const dentro = n.tipo === "pasta" && e.clientY > r.top + r.height * 0.35;
                setOver({ id: n.id, onde: dentro ? "dentro" : "antes" });
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = e.dataTransfer.getData("application/x-opencena-no");
                const onde = over?.onde;
                setOver(null);
                if (!id || id === n.id) return;
                if (onde === "dentro") onChange(patchNode(moveNode(tree, id, n.id), n.id, { aberta: true }));
                else onChange(moveNode(tree, id, n.paiId, n.id));
              }}
              onClick={() => (n.tipo === "pasta" ? onChange(patchNode(tree, n.id, { aberta: !n.aberta })) : onSelect(n.id))}
              onDoubleClick={() => setRenomear(n.id)}
            >
              <span className="rt-caret">
                {n.tipo === "pasta" && <Icon name={n.aberta ? "chevronDown" : "chevronLeft"} size={12} />}
              </span>
              <span className={`rt-ico k-${n.tipo}`}>
                <Icon name={n.tipo === "pasta" && n.aberta ? "folderOpen" : NODE_ICON[n.tipo]} size={14} />
              </span>
              {renomear === n.id ? (
                <input
                  className="rt-input"
                  autoFocus
                  defaultValue={n.titulo}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    onChange(patchNode(tree, n.id, { titulo: e.target.value.trim() || n.titulo }));
                    setRenomear(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setRenomear(null);
                  }}
                />
              ) : (
                <span className="rt-name">{n.titulo || NODE_LABEL[n.tipo]}</span>
              )}
              {n.tipo === "pasta" && filhos > 0 && !n.aberta && <span className="rt-count">{filhos}</span>}
              <span className="rt-acts" onClick={(e) => e.stopPropagation()}>
                {n.tipo === "pasta" && (
                  <>
                    <button title={tt("Novo quadro nesta pasta")} onClick={() => onCreate("quadro", n.id)}>
                      <Icon name="grid" size={12} />
                    </button>
                    <button title={tt("Nova página nesta pasta")} onClick={() => onCreate("pagina", n.id)}>
                      <Icon name="fileText" size={12} />
                    </button>
                  </>
                )}
                <button title={tt("Renomear")} onClick={() => setRenomear(n.id)}>
                  <Icon name="pencil" size={12} />
                </button>
                <button title={tt("Excluir")} className="danger" onClick={() => onDelete(n)}>
                  <Icon name="trash" size={12} />
                </button>
              </span>
            </div>
            {n.tipo === "pasta" && n.aberta && (
              <Tree
                tree={tree}
                paiId={n.id}
                depth={depth + 1}
                sel={sel}
                onSelect={onSelect}
                onChange={onChange}
                renomear={renomear}
                setRenomear={setRenomear}
                onDelete={onDelete}
                onCreate={onCreate}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// Pesquisa e referência: barra lateral com pastas, quadros livres (estilo Miro)
// e páginas de texto (estilo Notion), tudo vinculável à obra.
export function ResearchTab() {
  const cur = useApp((s) => s.current!);
  const previewMode = useApp((s) => s.previewMode);
  const tree = cur.project.pesquisa;
  const updatePesquisa = useApp((s) => s.updatePesquisa);
  const focus = useApp((s) => s.researchFocus);
  const clearFocus = useApp((s) => s.clearResearchFocus);
  const root = previewMode ? null : cur.root;
  const targets = useLinkTargets();
  const [renomear, setRenomear] = useState<string | null>(null);
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const treeRef = useRef(tree);
  treeRef.current = tree;

  const [selId, setSelId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`${SEL_KEY}:${cur.project.meta.id}`);
    } catch {
      return null;
    }
  });
  const selecionado = tree.nos.find((n) => n.id === selId && n.tipo !== "pasta") ?? tree.nos.find((n) => n.tipo !== "pasta") ?? null;

  useEffect(() => {
    if (!selecionado) return;
    try {
      localStorage.setItem(`${SEL_KEY}:${cur.project.meta.id}`, selecionado.id);
    } catch {
      /* ignora */
    }
  }, [selecionado?.id, cur.project.meta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // vindo de outra aba (ficha do personagem etc.)
  useEffect(() => {
    if (!focus) return;
    // abre as pastas até o item
    let t = treeRef.current;
    let pai = t.nos.find((n) => n.id === focus.noId)?.paiId ?? null;
    while (pai) {
      const p = pai;
      t = patchNode(t, p, { aberta: true });
      pai = t.nos.find((n) => n.id === p)?.paiId ?? null;
    }
    if (t !== treeRef.current) updatePesquisa(t);
    setSelId(focus.noId);
    setFocusItem(focus.itemId ?? null);
    clearFocus();
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchSel = (p: Partial<ResearchNode>) => {
    if (selecionado) updatePesquisa(patchNode(treeRef.current, selecionado.id, p));
  };

  function criar(tipo: ResearchNodeKind, paiId: string | null = null) {
    const n = newNode(tipo, paiId);
    let t: ResearchTree = { nos: [...treeRef.current.nos, n] };
    if (paiId) t = patchNode(t, paiId, { aberta: true });
    updatePesquisa(t);
    if (tipo !== "pasta") setSelId(n.id);
    // a página ganha o título no próprio cabeçalho; pasta e quadro, na barra lateral
    if (tipo !== "pagina") setRenomear(n.id);
  }

  async function excluir(n: ResearchNode) {
    const filhos = descendants(treeRef.current, n.id).length;
    const ok = await confirmDialog({
      title: tt("Excluir \"{nome}\"?", { nome: n.titulo || NODE_LABEL[n.tipo] }),
      message:
        n.tipo === "pasta"
          ? filhos
            ? tt("A pasta e os {n} itens dentro dela saem da pesquisa. Dá para voltar pelo Histórico.", { n: filhos })
            : tt("A pasta vazia sai da pesquisa.")
          : n.tipo === "quadro"
            ? tt("O quadro e o que há nele saem da pesquisa. Os arquivos continuam na pasta anexos/ do projeto e dá para voltar pelo Histórico.")
            : tt("A página e o que há nela saem da pesquisa. Os arquivos continuam na pasta anexos/ do projeto e dá para voltar pelo Histórico."),
      confirmLabel: tt("Excluir"),
      tone: "danger",
    });
    if (ok) updatePesquisa(removeNode(treeRef.current, n.id));
  }

  // busca: títulos, texto das páginas e das notas dos quadros
  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return null;
    return tree.nos
      .filter((n) => n.tipo !== "pasta")
      .filter(
        (n) =>
          n.titulo.toLowerCase().includes(q) ||
          (n.tipo === "pagina" && docText(n.doc, 100000).toLowerCase().includes(q)) ||
          n.quadro?.itens.some((i) => (i.texto ?? "").toLowerCase().includes(q))
      );
  }, [busca, tree]);

  return (
    <div className="rs-wrap">
      <aside className="rt">
        <div className="rt-head">
          <span>{tt("Pesquisa")}</span>
          <span className="rt-new">
            <button title={tt("Nova pasta")} onClick={() => criar("pasta")}>
              <Icon name="folder" size={14} />
            </button>
            <button title={tt("Novo quadro")} onClick={() => criar("quadro")}>
              <Icon name="grid" size={14} />
            </button>
            <button title={tt("Nova página de texto")} onClick={() => criar("pagina")}>
              <Icon name="fileText" size={14} />
            </button>
          </span>
        </div>
        <div className="rt-search">
          <Icon name="search" size={13} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tt("Buscar na pesquisa")} />
        </div>
        <div
          className="rt-list"
          onDragOver={(e) => Array.from(e.dataTransfer.types).includes("application/x-opencena-no") && e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData("application/x-opencena-no");
            if (id) updatePesquisa(moveNode(treeRef.current, id, null));
          }}
        >
          {resultados ? (
            resultados.length ? (
              resultados.map((n) => (
                <div key={n.id} className={`rt-row ${selecionado?.id === n.id ? "active" : ""}`} onClick={() => setSelId(n.id)}>
                  <span className={`rt-ico k-${n.tipo}`}>
                    <Icon name={NODE_ICON[n.tipo]} size={14} />
                  </span>
                  <span className="rt-name">{n.titulo || NODE_LABEL[n.tipo]}</span>
                </div>
              ))
            ) : (
              <p className="rt-empty">{tt("Nada encontrado.")}</p>
            )
          ) : (
            <Tree
              tree={tree}
              paiId={null}
              depth={0}
              sel={selecionado?.id ?? null}
              onSelect={(id) => {
                setSelId(id);
                setFocusItem(null);
              }}
              onChange={updatePesquisa}
              renomear={renomear}
              setRenomear={setRenomear}
              onDelete={(n) => void excluir(n)}
              onCreate={criar}
            />
          )}
          {!resultados && tree.nos.length === 0 && <p className="rt-empty">{tt("Crie um quadro, uma página ou uma pasta para começar.")}</p>}
        </div>
        <p className="rt-tip">{tt("Arraste para organizar. Duplo clique renomeia.")}</p>
      </aside>

      <div className="rs-main">
        {!selecionado ? (
          <div className="rs-empty">
            <Icon name="bookmark" size={22} />
            <p>{tt("Guarde aqui referências, imagens, links, documentos e anotações. Comece por um quadro ou uma página.")}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button className="btn" onClick={() => criar("quadro")}>
                <Icon name="grid" size={14} />
                {tt("Novo quadro")}
              </button>
              <button className="btn" onClick={() => criar("pagina")}>
                <Icon name="fileText" size={14} />
                {tt("Nova página")}
              </button>
            </div>
          </div>
        ) : selecionado.tipo === "quadro" ? (
          <BoardView
            key={selecionado.id}
            board={selecionado.quadro!}
            onChange={(quadro) => patchSel({ quadro })}
            targets={targets}
            root={root}
            focusItem={focusItem}
          />
        ) : (
          <NotePage key={selecionado.id} node={selecionado} targets={targets} onChange={patchSel} root={root} />
        )}
      </div>
    </div>
  );
}
