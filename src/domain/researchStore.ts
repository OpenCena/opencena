// Gravação da Pesquisa em vários arquivos.

import type { ProjectDir } from "@/storage/dir";
import { ResearchNode, ResearchTree } from "@/types";
import { listFiles, readJSON, removeFile, writeJSON } from "@/storage/fs";

const ESTRUTURA = ["pesquisa", "estrutura.json"];
const PASTA_NOS = ["pesquisa", "nos"];

type Conteudo = Pick<ResearchNode, "quadro" | "doc">;
type Indice = { nos: Omit<ResearchNode, "quadro" | "doc">[] };

/** Separa a árvore em índice (sem conteúdo) e conteúdo de cada nó. */
export function splitResearch(tree: ResearchTree): { indice: Indice; conteudos: Map<string, Conteudo> } {
  const conteudos = new Map<string, Conteudo>();
  const nos = tree.nos.map(({ quadro, doc, ...resto }) => {
    if (quadro !== undefined || doc !== undefined) conteudos.set(resto.id, { quadro, doc });
    return resto;
  });
  return { indice: { nos }, conteudos };
}

/** Junta índice e conteúdos de volta na árvore. */
export function joinResearch(indice: Indice, conteudos: Map<string, Conteudo>): ResearchTree {
  return { nos: indice.nos.map((n) => ({ ...n, ...(conteudos.get(n.id) ?? {}) })) };
}

// última versão gravada, por projeto (pasta) e nó
const gravado = new WeakMap<object, { indice: string; nos: Map<string, unknown> }>();

function chave(root: ProjectDir): object {
  return root.kind === "web" ? root.handle : (root as unknown as object);
}

export async function readResearch(root: ProjectDir): Promise<ResearchTree | undefined> {
  const indice = await readJSON<Indice>(root, ESTRUTURA);
  if (!indice) return undefined;
  const conteudos = new Map<string, Conteudo>();
  for (const n of indice.nos) {
    if (n.tipo === "pasta") continue;
    const c = await readJSON<Conteudo>(root, [...PASTA_NOS, `${n.id}.json`]);
    if (c) conteudos.set(n.id, c);
  }
  const tree = joinResearch(indice, conteudos);
  // o que acabou de ser lido conta como gravado
  gravado.set(chave(root), {
    indice: JSON.stringify(indice),
    nos: new Map(tree.nos.map((n) => [n.id, n.quadro ?? n.doc])),
  });
  return tree;
}

/**
 * Grava só o que mudou desde a última gravação. `anterior` = null força
 * gravar tudo (ex.: migração).
 */
export async function writeResearch(root: ProjectDir, tree: ResearchTree, anterior?: null): Promise<void> {
  const { indice, conteudos } = splitResearch(tree);
  const k = chave(root);
  const ultimo = anterior === null ? undefined : gravado.get(k);
  const textoIndice = JSON.stringify(indice);
  if (!ultimo || ultimo.indice !== textoIndice) await writeJSON(root, ESTRUTURA, indice);
  const atual = new Map<string, unknown>();
  for (const n of tree.nos) {
    const c = n.quadro ?? n.doc;
    atual.set(n.id, c);
    if (n.tipo === "pasta") continue;
    if (!ultimo || ultimo.nos.get(n.id) !== c) await writeJSON(root, [...PASTA_NOS, `${n.id}.json`], conteudos.get(n.id) ?? {});
  }
  // nós apagados: tira os arquivos
  if (ultimo) {
    for (const id of ultimo.nos.keys()) {
      if (!atual.has(id)) {
        try {
          await removeFile(root, PASTA_NOS, `${id}.json`);
        } catch {
          /* já não existia */
        }
      }
    }
  } else {
    // primeira gravação nesta sessão: limpa arquivos de nós que não existem mais
    try {
      const arquivos = await listFiles(root, PASTA_NOS);
      for (const f of arquivos) {
        const id = f.replace(/\.json$/, "");
        if (!atual.has(id)) await removeFile(root, PASTA_NOS, f);
      }
    } catch {
      /* pasta ainda não existe */
    }
  }
  gravado.set(k, { indice: textoIndice, nos: atual });
}
