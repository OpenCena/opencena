// Onde um personagem, local ou objeto aparece no documento: em quais cenas (páginas da HQ,
// capítulos), quantas falas, quantas menções.

import { ProjectType, ScreenplayElement } from "@/types";
import { cleanCharacterName, parseHeadingLocation } from "@/domain/screenplay";
import { kindOf } from "@/layout/profiles";
import { tt } from "@/i18n";

export interface Section {
  /** Bloco que abre a seção (cena, página, capítulo). */
  id: string;
  n: number;
  titulo: string;
  /** Índices [início, fim) dos blocos da seção. */
  de: number;
  ate: number;
}

/** Divide o documento em seções (o que vem antes da primeira vira a seção 0). */
export function sectionsOf(elementos: ScreenplayElement[], tipo: ProjectType): Section[] {
  const kind = kindOf({ tipo });
  const out: Section[] = [];
  let n = 0;
  elementos.forEach((e, i) => {
    if (e.tipo !== kind.sectionType) return;
    if (!out.length && i > 0) out.push({ id: elementos[0].id, n: 0, titulo: tt("Início"), de: 0, ate: i });
    if (out.length) out[out.length - 1].ate = i;
    n += 1;
    const t = e.texto.replace(/\n/g, " ").trim();
    const titulo =
      kind.id === "roteiro" ? t.toUpperCase() || tt("Cena {n}", { n }) : kind.id === "quadrinhos" ? `${tt("Página {n}", { n })}${t ? `: ${t}` : ""}` : t || tt("Capítulo {n}", { n });
    out.push({ id: e.id, n, titulo, de: i, ate: elementos.length });
  });
  if (!out.length && elementos.length) out.push({ id: elementos[0].id, n: 0, titulo: tt("Documento"), de: 0, ate: elementos.length });
  return out;
}

export interface Presence {
  /** Seções onde aparece. */
  secoes: Section[];
  /** Falas (roteiro e HQ, só personagens). */
  falas: number;
  /** Menções do nome no texto. */
  mencoes: number;
}

const normaliza = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function contaMencoes(texto: string, nome: string): number {
  const alvo = normaliza(nome.trim());
  if (alvo.length < 2) return 0;
  const t = normaliza(texto);
  let n = 0;
  let i = t.indexOf(alvo);
  while (i >= 0) {
    const antes = i === 0 ? " " : t[i - 1];
    const depois = t[i + alvo.length] ?? " ";
    if (!/[\p{L}\p{N}]/u.test(antes) && !/[\p{L}\p{N}]/u.test(depois)) n++;
    i = t.indexOf(alvo, i + alvo.length);
  }
  return n;
}

export function presenceOf(
  elementos: ScreenplayElement[],
  tipo: ProjectType,
  alvo: { tipo: "personagem" | "local" | "objeto"; nome: string; nomeCompleto?: string }
): Presence {
  const secoes = sectionsOf(elementos, tipo);
  const nome = alvo.nome.trim();
  const res: Presence = { secoes: [], falas: 0, mencoes: 0 };
  if (!nome) return res;
  const NOME = cleanCharacterName(nome);
  for (const s of secoes) {
    let aqui = false;
    for (let i = s.de; i < s.ate; i++) {
      const e = elementos[i];
      if (alvo.tipo === "personagem" && e.tipo === "personagem" && cleanCharacterName(e.texto) === NOME) {
        aqui = true;
        // conta a fala que vem logo depois do nome
        const prox = elementos[i + 1];
        if (prox && (prox.tipo === "dialogo" || prox.tipo === "balao" || prox.tipo === "parentese")) res.falas++;
        continue;
      }
      if (alvo.tipo === "local" && tipo === "roteiro" && e.tipo === "cabecalho" && parseHeadingLocation(e.texto) === NOME) {
        aqui = true;
        continue;
      }
      const m =
        contaMencoes(e.texto, nome) +
        (alvo.nomeCompleto && normaliza(alvo.nomeCompleto) !== normaliza(nome) ? contaMencoes(e.texto, alvo.nomeCompleto) : 0);
      if (m) {
        res.mencoes += m;
        aqui = true;
      }
    }
    if (aqui) res.secoes.push(s);
  }
  return res;
}
