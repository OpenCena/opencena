// Pesquisa: árvore de pastas, quadros e páginas (a barra lateral) e o que estiver vinculado a cada
// elemento da obra (para mostrar nas fichas).

import { LoadedProject, RefLink, Reference, ResearchNode, ResearchNodeKind, ResearchTree } from "@/types";
import { emptyBoard, newId } from "@/domain/project";
import { tt } from "@/i18n";

export const linkKey = (l: RefLink) => (l.id ? `${l.tipo}:${l.id}` : l.tipo);

export const NODE_LABEL: Record<ResearchNodeKind, string> = {
  pasta: tt("Pasta"),
  quadro: tt("Quadro"),
  pagina: tt("Página"),
};

export function newNode(tipo: ResearchNodeKind, paiId: string | null, titulo?: string): ResearchNode {
  return {
    id: newId(),
    tipo,
    titulo: titulo ?? (tipo === "pasta" ? tt("Nova pasta") : tipo === "quadro" ? tt("Novo quadro") : ""),
    paiId,
    aberta: tipo === "pasta" ? true : undefined,
    quadro: tipo === "quadro" ? emptyBoard() : undefined,
    doc: tipo === "pagina" ? { type: "doc", content: [{ type: "paragraph" }] } : undefined,
    criadoEm: new Date().toISOString(),
  };
}

export const childrenOf = (t: ResearchTree, paiId: string | null) => t.nos.filter((n) => n.paiId === paiId);

/** Todos os descendentes de um nó (para apagar uma pasta inteira). */
export function descendants(t: ResearchTree, id: string): string[] {
  const out: string[] = [];
  const walk = (pai: string) =>
    t.nos.forEach((n) => {
      if (n.paiId === pai) {
        out.push(n.id);
        walk(n.id);
      }
    });
  walk(id);
  return out;
}

export function patchNode(t: ResearchTree, id: string, p: Partial<ResearchNode>): ResearchTree {
  return { nos: t.nos.map((n) => (n.id === id ? { ...n, ...p } : n)) };
}

export function removeNode(t: ResearchTree, id: string): ResearchTree {
  const fora = new Set([id, ...descendants(t, id)]);
  return { nos: t.nos.filter((n) => !fora.has(n.id)) };
}

/**
 * Move `id` para dentro de `paiId`, antes do nó `antesDe` (ou no fim).
 * Não deixa uma pasta entrar nela mesma.
 */
export function moveNode(t: ResearchTree, id: string, paiId: string | null, antesDe?: string | null): ResearchTree {
  if (id === paiId || (paiId && descendants(t, id).includes(paiId))) return t;
  const no = t.nos.find((n) => n.id === id);
  if (!no) return t;
  const resto = t.nos.filter((n) => n.id !== id);
  const movido = { ...no, paiId };
  const idx = antesDe ? resto.findIndex((n) => n.id === antesDe) : -1;
  return { nos: idx < 0 ? [...resto, movido] : [...resto.slice(0, idx), movido, ...resto.slice(idx)] };
}

/** Caminho "Pasta / Subpasta / Quadro" de um nó. */
export function nodePath(t: ResearchTree, id: string): string {
  const parts: string[] = [];
  let cur = t.nos.find((n) => n.id === id);
  while (cur) {
    parts.unshift(cur.titulo || NODE_LABEL[cur.tipo]);
    const pai = cur.paiId;
    cur = pai ? t.nos.find((n) => n.id === pai) : undefined;
  }
  return parts.join(" / ");
}

/** Texto simples de uma página (para trechos e busca). */
export function docText(doc: unknown, max = 400): string {
  let out = "";
  const walk = (n: { text?: string; content?: unknown[]; type?: string }) => {
    if (out.length > max) return;
    if (n.text) out += n.text;
    if (Array.isArray(n.content)) {
      n.content.forEach((c) => walk(c as never));
      if (n.type && n.type !== "doc" && n.type !== "text") out += " ";
    }
  };
  if (doc && typeof doc === "object") walk(doc as never);
  return out.replace(/\s+/g, " ").trim().slice(0, max);
}

// o que está vinculado a um elemento da obra
export interface LinkedEntry {
  key: string;
  tipo: "imagem" | "link" | "documento" | "nota" | "texto" | "pagina";
  titulo: string;
  trecho?: string;
  ref?: Reference;
  /** Onde está: quadro/página da pesquisa. */
  noId?: string;
  itemId?: string;
  onde: string;
}

export function linkedTo(project: LoadedProject, alvo: RefLink): LinkedEntry[] {
  const key = linkKey(alvo);
  const t = project.pesquisa ?? { nos: [] };
  const out: LinkedEntry[] = [];
  // onde cada referência aparece (primeiro quadro que a contém)
  const ondeRef = new Map<string, { noId: string; itemId: string }>();
  t.nos.forEach((n) =>
    n.quadro?.itens.forEach((i) => i.refId && !ondeRef.has(i.refId) && ondeRef.set(i.refId, { noId: n.id, itemId: i.id }))
  );
  (project.references ?? []).forEach((r) => {
    if (!r.vinculos.some((v) => linkKey(v) === key)) return;
    const pos = ondeRef.get(r.id);
    out.push({
      key: `ref:${r.id}`,
      tipo: r.tipo === "nota" ? "nota" : r.tipo,
      titulo: r.titulo || r.arquivoNome || r.url || tt("Referência"),
      trecho: r.notas || undefined,
      ref: r,
      noId: pos?.noId,
      itemId: pos?.itemId,
      onde: pos ? nodePath(t, pos.noId) : tt("Pesquisa"),
    });
  });
  t.nos.forEach((n) => {
    n.quadro?.itens.forEach((i) => {
      if ((i.tipo !== "nota" && i.tipo !== "texto") || !i.vinculos?.some((v) => linkKey(v) === key)) return;
      const txt = (i.texto ?? "").trim();
      out.push({
        key: `item:${i.id}`,
        tipo: i.tipo,
        titulo: txt.split("\n")[0].slice(0, 80) || tt("Nota"),
        trecho: txt.split("\n").slice(1).join(" ").slice(0, 200) || undefined,
        noId: n.id,
        itemId: i.id,
        onde: nodePath(t, n.id),
      });
    });
    if (n.tipo === "pagina" && n.vinculos?.some((v) => linkKey(v) === key)) {
      out.push({
        key: `no:${n.id}`,
        tipo: "pagina",
        titulo: n.titulo || tt("Página"),
        trecho: docText(n.doc, 200) || undefined,
        noId: n.id,
        onde: nodePath(t, n.id),
      });
    }
  });
  return out;
}
