// Roteiro: numeração de cenas, (CONT'D) e nomes de personagens e locais para o autocomplete.

import { ScreenplayElement, Screenplay } from "@/types";

/**
 * Recalcula o número de cada cena (elementos "cabecalho") em ordem.
 * Retorna uma nova lista; não muta a original.
 */
export function renumberScenes(
  elementos: ScreenplayElement[]
): ScreenplayElement[] {
  let n = 0;
  return elementos.map((el) => {
    if (el.tipo === "cabecalho") {
      n += 1;
      return { ...el, numeroCena: n };
    }
    if (el.numeroCena !== undefined) {
      const { numeroCena: _omit, ...rest } = el;
      return rest;
    }
    return el;
  });
}

/** Nomes de personagens já usados no roteiro (para autocomplete). */
export function charactersInScreenplay(screenplay: Screenplay): string[] {
  const set = new Set<string>();
  for (const el of screenplay.elementos) {
    if (el.tipo === "personagem" && el.texto.trim()) {
      set.add(cleanCharacterName(el.texto));
    }
  }
  return [...set].sort();
}

/** Remove sufixos como "(CONT'D)" do nome do personagem. */
export function cleanCharacterName(texto: string): string {
  return texto
    .replace(/\(cont'?d\)/gi, "")
    .trim()
    .toUpperCase();
}

/**
 * Extrai o local de um cabeçalho de cena.
 * "INT. CASA DE MARIA - NOITE" -> "CASA DE MARIA"
 */
export function parseHeadingLocation(texto: string): string {
  return texto
    .replace(/^\s*(INT\.?\/EXT\.?|INT\.?|EXT\.?|EST\.?)\s*/i, "")
    .replace(/\s*[-–—]\s*(DIA|NOITE|TARDE|MANHÃ|AMANHECER|ENTARDECER|CONTÍNUO|MAIS TARDE).*$/i, "")
    .trim()
    .toUpperCase();
}

/** Locais únicos citados nos cabeçalhos do roteiro. */
export function locationsInScreenplay(screenplay: Screenplay): string[] {
  const set = new Set<string>();
  for (const el of screenplay.elementos) {
    if (el.tipo === "cabecalho" && el.texto.trim()) {
      const loc = parseHeadingLocation(el.texto);
      if (loc) set.add(loc);
    }
  }
  return [...set].sort();
}

/** Cabeçalhos de cena completos já usados (para autocomplete de cena). */
export function headingsInScreenplay(screenplay: Screenplay): string[] {
  const set = new Set<string>();
  for (const el of screenplay.elementos) {
    if (el.tipo === "cabecalho" && el.texto.trim().length > 3) {
      set.add(el.texto.trim().toUpperCase());
    }
  }
  return [...set].sort();
}

/**
 * Calcula quais blocos de personagem devem exibir "(CONT'D)".
 * Regra: dentro da mesma cena, se o mesmo personagem volta a falar depois de uma
 * ação (ou outro bloco) interromper, mas sem outro personagem ter falado no
 * meio: marca CONT'D. Retorna o conjunto de ids.
 */
export function computeContdIds(
  elementos: Pick<ScreenplayElement, "id" | "tipo" | "texto">[]
): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < elementos.length; i++) {
    const el = elementos[i];
    if (el.tipo !== "personagem" || !el.texto.trim()) continue;
    const nome = cleanCharacterName(el.texto);

    // Anda para trás até achar outro personagem ou o início da cena.
    for (let j = i - 1; j >= 0; j--) {
      const prev = elementos[j];
      if (prev.tipo === "cabecalho") break; // nova cena: sem CONT'D
      if (prev.tipo === "personagem") {
        if (cleanCharacterName(prev.texto) === nome) ids.add(el.id);
        break; // achou o personagem anterior; decisão tomada
      }
    }
  }
  return ids;
}
