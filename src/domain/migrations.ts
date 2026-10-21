// Versões do formato dos arquivos do projeto. Ao abrir, as migrações pendentes rodam em
// ordem e a versão nova é gravada em projeto.json. Arquivos antigos não são apagados.
//
//   1  formato inicial
//   2  pesquisa em árvore (pastas, quadros, páginas)
//   3  pesquisa em vários arquivos (estrutura.json + nos/<id>.json)
//   4  o antigo mural de Ideias vira um quadro na Pesquisa

import type { ProjectDir } from "@/storage/dir";
import { Board, BoardItem, Idea, ProjectMeta, Reference, ResearchNode, ResearchTree } from "@/types";
import { readJSON, writeJSON } from "@/storage/fs";
import { emptyBoard, newId } from "@/domain/project";
import { writeResearch } from "@/domain/researchStore";
import { tt } from "@/i18n";

/** Versão atual do formato dos projetos. */
export const FORMAT_VERSION = 4;

const P = {
  meta: ["projeto.json"],
  ideas: ["ideias", "ideias.json"],
  references: ["pesquisa", "referencias.json"],
  boardV1: ["pesquisa", "quadro.json"],
  researchV2: ["pesquisa", "pesquisa.json"],
} as const;

// transformações puras

/**
 * v1 → v2: o quadro único vira o quadro "Quadro"; as referências que não
 * estavam nele vão para um quadro "Referências", em grade.
 */
export function researchFromV1(board: Partial<Board> | undefined, refs: Reference[], agora = new Date().toISOString()): ResearchTree {
  const b: Board = { ...emptyBoard(), ...(board ?? {}) };
  const nos: ResearchNode[] = [{ id: newId(), tipo: "quadro", titulo: "Quadro", paiId: null, quadro: b, criadoEm: agora }];
  const noQuadro = new Set(b.itens.map((i) => i.refId).filter(Boolean));
  const soltas = refs.filter((r) => !noQuadro.has(r.id));
  if (soltas.length) {
    const itens: BoardItem[] = soltas.map((r, k) => ({
      id: newId(),
      tipo: "referencia",
      refId: r.id,
      x: 40 + (k % 4) * 270,
      y: 40 + Math.floor(k / 4) * 240,
      w: r.tipo === "imagem" ? 240 : 230,
      h: r.tipo === "imagem" ? 200 : r.tipo === "link" ? 36 : 64,
    }));
    nos.push({ id: newId(), tipo: "quadro", titulo: "Referências", paiId: null, quadro: { ...emptyBoard(), itens }, criadoEm: agora });
  }
  return { nos };
}

const COR_DA_CATEGORIA: Record<string, string> = {
  geral: "amarelo",
  personagem: "lilas",
  cena: "rosa",
  mundo: "verde",
  dialogo: "azul",
  pesquisa: "papel",
};

/**
 * v3 → v4: cada ideia vira uma nota num quadro "Ideias" (fixadas primeiro),
 * com a cor da categoria. O texto e o título antigos são mantidos.
 */
export function ideasToBoard(tree: ResearchTree, ideas: Idea[], agora = new Date().toISOString()): ResearchTree {
  if (!ideas.length) return tree;
  const ordem = [...ideas.filter((i) => i.fixada), ...ideas.filter((i) => !i.fixada)];
  const itens: BoardItem[] = ordem.map((i, k) => {
    const texto = i.titulo ? (i.texto ? `${i.titulo}\n${i.texto}` : i.titulo) : i.texto;
    const h = Math.min(320, 90 + Math.ceil(texto.length / 30) * 20 + (texto.split("\n").length - 1) * 20);
    return {
      id: i.id,
      tipo: "nota",
      texto,
      cor: COR_DA_CATEGORIA[i.tag] ?? "amarelo",
      x: 40 + (k % 4) * 250,
      y: 40 + Math.floor(k / 4) * 340,
      w: 220,
      h,
      cartaoId: i.cartaoId,
    };
  });
  const no: ResearchNode = { id: newId(), tipo: "quadro", titulo: "Ideias", paiId: null, quadro: { ...emptyBoard(), itens }, criadoEm: agora };
  return { nos: [no, ...tree.nos] };
}

// execução

export class NewerFormatError extends Error {}

/**
 * Atualiza os arquivos do projeto para o formato atual. Devolve o `meta`
 * com a versão nova (já gravado).
 */
export async function runMigrations(root: ProjectDir, meta: ProjectMeta): Promise<ProjectMeta> {
  const versao = meta.schemaVersion ?? 1;
  if (versao > FORMAT_VERSION) {
    throw new NewerFormatError(
      tt("Este projeto foi salvo por uma versão mais nova do OpenCena. Atualize o aplicativo para abri-lo sem perder nada.")
    );
  }
  if (versao === FORMAT_VERSION) return meta;

  let tree: ResearchTree | undefined;
  if (versao < 2) {
    const refs = (await readJSON<Reference[]>(root, P.references)) ?? [];
    tree = (await readJSON<ResearchTree>(root, P.researchV2)) ?? researchFromV1(await readJSON<Board>(root, P.boardV1), refs);
  }
  if (versao < 3) {
    tree = tree ?? (await readJSON<ResearchTree>(root, P.researchV2)) ?? { nos: [] };
  }
  if (versao < 4) {
    const ideas = (await readJSON<Idea[]>(root, P.ideas)) ?? [];
    if (ideas.length) {
      tree = ideasToBoard(tree ?? (await readResearchAny(root)), ideas);
      // o arquivo antigo fica como cópia, com outro nome
      await writeJSON(root, ["ideias", "ideias-antigas.json"], ideas);
      await writeJSON(root, P.ideas, []);
    }
  }
  if (tree) await writeResearch(root, tree, null);

  const novo = { ...meta, schemaVersion: FORMAT_VERSION };
  await writeJSON(root, P.meta, novo);
  return novo;
}

async function readResearchAny(root: ProjectDir): Promise<ResearchTree> {
  const { readResearch } = await import("@/domain/researchStore");
  return (await readResearch(root)) ?? { nos: [] };
}
