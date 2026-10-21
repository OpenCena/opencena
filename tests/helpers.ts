// Fábricas de dados para os testes.

import type { LoadedProject, OutlineCard, ProjectType, ScreenplayElement } from "@/types";
import { emptyResearch, initialCover } from "@/domain/project";
import { emptyCard } from "@/domain/outline";

let seq = 0;

/** Elemento do documento com id previsível. */
export function el(tipo: ScreenplayElement["tipo"], texto = "", id?: string): ScreenplayElement {
  return { id: id ?? `e${++seq}`, tipo, texto };
}

export function card(p: Partial<OutlineCard> = {}): OutlineCard {
  return { ...emptyCard(null), id: p.id ?? `c${++seq}`, ...p };
}

export function project(tipo: ProjectType, elementos: ScreenplayElement[], p: Partial<LoadedProject> = {}): LoadedProject {
  const agora = "2026-01-01T00:00:00.000Z";
  return {
    meta: { id: "p1", schemaVersion: 4, tipo, nome: "Teste", autor: "Ana", criadoEm: agora, atualizadoEm: agora, idioma: "pt-BR" },
    cover: initialCover("Teste", "Ana"),
    screenplay: { schemaVersion: 1, elementos },
    characters: [],
    locations: [],
    objects: [],
    outline: { atos: [], cartoes: [] },
    ideas: [],
    references: [],
    pesquisa: emptyResearch(),
    ...p,
  };
}

/** Ids dos elementos, na ordem. */
export const ids = (els: { id: string }[]) => els.map((e) => e.id);
