// Comparação entre duas versões do projeto (histórico).

import { LoadedProject, ScreenplayElement } from "@/types";
import { tt } from "@/i18n";

export type WordOp = { t: "eq" | "add" | "del"; s: string };

export type BlockDiff =
  | { op: "eq"; el: ScreenplayElement }
  | { op: "add"; el: ScreenplayElement }
  | { op: "del"; el: ScreenplayElement }
  | { op: "mod"; el: ScreenplayElement; antes: ScreenplayElement; palavras: WordOp[] };

/** Palavras, espaços e pontuação viram pedaços separados. */
const TOKENS = /(\s+|[^\p{L}\p{N}\s])/u;

/** Diff por palavra (LCS). Textos muito grandes caem para troca inteira. */
export function diffWords(a: string, b: string): WordOp[] {
  if (a === b) return [{ t: "eq", s: a }];
  const A = a.split(TOKENS).filter(Boolean);
  const B = b.split(TOKENS).filter(Boolean);
  // prefixo e sufixo iguais saem do cálculo
  let p = 0;
  while (p < A.length && p < B.length && A[p] === B[p]) p++;
  let s = 0;
  while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
  const a2 = A.slice(p, A.length - s);
  const b2 = B.slice(p, B.length - s);
  const out: WordOp[] = [];
  const push = (t: WordOp["t"], str: string) => {
    if (!str) return;
    const last = out[out.length - 1];
    if (last && last.t === t) last.s += str;
    else out.push({ t, s: str });
  };
  push("eq", A.slice(0, p).join(""));
  if (a2.length * b2.length > 2_000_000) {
    push("del", a2.join(""));
    push("add", b2.join(""));
  } else {
    const n = a2.length;
    const m = b2.length;
    const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i][j] = a2[i] === b2[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a2[i] === b2[j]) {
        push("eq", a2[i]);
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", a2[i++]);
      else push("add", b2[j++]);
    }
    while (i < n) push("del", a2[i++]);
    while (j < m) push("add", b2[j++]);
  }
  push("eq", A.slice(A.length - s).join(""));
  return agrupar(out);
}

/**
 * Junta trocas picadas ("em"→"com", " ", "silêncio"→"raiva") num trecho
 * removido seguido do trecho inserido ("em silêncio" → "com raiva"), que é
 * como a gente lê uma revisão. Espaços entre trocas entram nos dois lados.
 */
function agrupar(ops: WordOp[]): WordOp[] {
  const out: WordOp[] = [];
  let del = "";
  let add = "";
  let aberto = false;
  const fechar = () => {
    if (!aberto) return;
    // espaço no fim dos dois lados volta a ser texto igual
    const fim = Math.min(del.length - del.trimEnd().length, add.length - add.trimEnd().length);
    const resto = fim ? del.slice(del.length - fim) : "";
    if (fim) {
      del = del.slice(0, del.length - fim);
      add = add.slice(0, add.length - fim);
    }
    if (del) out.push({ t: "del", s: del });
    if (add) out.push({ t: "add", s: add });
    if (resto) out.push({ t: "eq", s: resto });
    del = add = "";
    aberto = false;
  };
  ops.forEach((o, k) => {
    if (o.t === "del") {
      del += o.s;
      aberto = true;
    } else if (o.t === "add") {
      add += o.s;
      aberto = true;
    } else if (aberto && !o.s.trim() && ops.slice(k + 1).find((x) => x.t !== "eq" || x.s.trim())?.t !== "eq") {
      // só espaço entre duas trocas: continua o mesmo trecho
      del += o.s;
      add += o.s;
    } else {
      fechar();
      out.push({ ...o });
    }
  });
  fechar();
  return out;
}

/** Índices (em `seq`) da maior subsequência crescente. */
function lis(seq: number[]): Set<number> {
  const tails: number[] = [];
  const prev = new Array<number>(seq.length).fill(-1);
  for (let i = 0; i < seq.length; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (seq[tails[mid]] < seq[i]) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const out = new Set<number>();
  let k = tails.length ? tails[tails.length - 1] : -1;
  while (k >= 0) {
    out.add(k);
    k = prev[k];
  }
  return out;
}

const sameBlock = (a: ScreenplayElement, b: ScreenplayElement) =>
  a.tipo === b.tipo && a.texto === b.texto && JSON.stringify(a.marcas ?? []) === JSON.stringify(b.marcas ?? []);

export function diffBlocks(antes: ScreenplayElement[], depois: ScreenplayElement[]): BlockDiff[] {
  const posAntes = new Map(antes.map((e, i) => [e.id, i]));
  // pares (j em depois, i em antes) com o mesmo id, na ordem de "depois"
  const pares: { j: number; i: number }[] = [];
  depois.forEach((e, j) => {
    const i = posAntes.get(e.id);
    if (i !== undefined) pares.push({ j, i });
  });
  const keep = lis(pares.map((p) => p.i));
  const casadoDepois = new Map<number, number>();
  const casadoAntes = new Set<number>();
  pares.forEach((p, k) => {
    if (!keep.has(k)) return;
    casadoDepois.set(p.j, p.i);
    casadoAntes.add(p.i);
  });

  const out: BlockDiff[] = [];
  let i = 0;
  const flushDel = (ate: number) => {
    for (; i < ate; i++) if (!casadoAntes.has(i)) out.push({ op: "del", el: antes[i] });
  };
  // em cada trecho entre blocos casados, os removidos vêm antes dos inseridos
  let inseridos: ScreenplayElement[] = [];
  const flushAdd = () => {
    for (const el of inseridos) out.push({ op: "add", el });
    inseridos = [];
  };
  depois.forEach((el, j) => {
    const ai = casadoDepois.get(j);
    if (ai === undefined) {
      inseridos.push(el);
      return;
    }
    flushDel(ai);
    flushAdd();
    i = ai + 1;
    const a = antes[ai];
    if (sameBlock(a, el)) out.push({ op: "eq", el });
    else out.push({ op: "mod", el, antes: a, palavras: diffWords(a.texto, el.texto) });
  });
  flushDel(antes.length);
  flushAdd();

  // um bloco removido seguido de um inserido do mesmo tipo é, na prática, uma edição
  for (let k = 0; k < out.length - 1; k++) {
    const x = out[k];
    const y = out[k + 1];
    if (x.op === "del" && y.op === "add" && x.el.tipo === y.el.tipo) {
      out.splice(k, 2, { op: "mod", el: y.el, antes: x.el, palavras: diffWords(x.el.texto, y.el.texto) });
    }
  }
  return out;
}

export const countWords = (els: ScreenplayElement[]) =>
  els.reduce((n, e) => n + (e.texto.trim() ? e.texto.trim().split(/\s+/).length : 0), 0);

// o resto do projeto: resumo por área
export interface AreaChange {
  area: string;
  adicionados: string[];
  removidos: string[];
  alterados: string[];
}

function byId<T extends { id: string }>(
  area: string,
  a: T[] | undefined,
  b: T[] | undefined,
  nome: (x: T) => string
): AreaChange | null {
  const A = new Map((a ?? []).map((x) => [x.id, x]));
  const B = new Map((b ?? []).map((x) => [x.id, x]));
  const ch: AreaChange = { area, adicionados: [], removidos: [], alterados: [] };
  B.forEach((x, id) => {
    const old = A.get(id);
    if (!old) ch.adicionados.push(nome(x));
    else if (JSON.stringify(old) !== JSON.stringify(x)) ch.alterados.push(nome(x));
  });
  A.forEach((x, id) => !B.has(id) && ch.removidos.push(nome(x)));
  return ch.adicionados.length || ch.removidos.length || ch.alterados.length ? ch : null;
}

const COVER_FIELDS: Record<string, string> = {
  titulo: tt("título"),
  subtitulo: tt("subtítulo"),
  autor: tt("autor"),
  baseadoEm: tt("baseado em"),
  contato: tt("contato"),
  telefone: tt("telefone"),
  email: tt("e-mail"),
  data: tt("data"),
  imagem: tt("imagem"),
  dedicatoria: tt("dedicatória"),
  editora: tt("editora"),
};

export function diffProjectAreas(a: LoadedProject, b: LoadedProject): AreaChange[] {
  const out: (AreaChange | null)[] = [
    byId(tt("Personagens"), a.characters, b.characters, (x) => x.nome || tt("Sem nome")),
    byId(tt("Locais"), a.locations, b.locations, (x) => x.nome || tt("Sem nome")),
    byId(tt("Objetos"), a.objects, b.objects, (x) => x.nome || tt("Sem nome")),
    byId(tt("Escaleta"), a.outline?.cartoes, b.outline?.cartoes, (x) => x.cabecalho || x.resumo.slice(0, 40) || tt("Cartão")),
    byId(tt("Ideias"), a.ideas, b.ideas, (x) => x.titulo || x.texto.slice(0, 40) || tt("Ideia")),
    byId(tt("Referências"), a.references, b.references, (x) => x.titulo || x.arquivoNome || x.url || tt("Referência")),
    byId(tt("Pesquisa"), a.pesquisa?.nos, b.pesquisa?.nos, (x) => x.titulo || tt("Sem título")),
  ];
  const ca = (a.cover ?? {}) as unknown as Record<string, unknown>;
  const cb = (b.cover ?? {}) as unknown as Record<string, unknown>;
  const campos = Array.from(new Set([...Object.keys(ca), ...Object.keys(cb)])).filter(
    (k) => JSON.stringify(ca[k] ?? "") !== JSON.stringify(cb[k] ?? "")
  );
  if (campos.length) out.push({ area: tt("Capa"), adicionados: [], removidos: [], alterados: campos.map((k) => COVER_FIELDS[k] ?? k) });
  return out.filter((x): x is AreaChange => !!x);
}
