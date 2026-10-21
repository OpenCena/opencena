// Escaleta: cartões, modelos de estrutura, ligação com o documento (ordem, cabeçalho, tamanho real
// de cada cena, personagens que falam) e plantar e colher.

import { CardKind, Outline, OutlineAct, OutlineCard, ProjectType, ScreenplayElement, Trama } from "@/types";
import { newId } from "@/domain/project";
import { cleanCharacterName, parseHeadingLocation } from "@/domain/screenplay";
import { tt } from "@/i18n";

export function emptyCard(atoId: string | null, tipo: CardKind = "cena"): OutlineCard {
  return {
    id: newId(),
    numero: 0,
    cabecalho: "",
    resumo: "",
    objetivo: "",
    conflito: "",
    observacoes: "",
    personagemIds: [],
    atoId,
    tipo,
    status: "afazer",
  };
}

/** Numera apenas as cenas, na ordem do array; ideias ficam sem número. */
export function renumber(cartoes: OutlineCard[]): OutlineCard[] {
  let n = 0;
  return cartoes.map((c) => (c.tipo === "ideia" ? { ...c, numero: 0 } : { ...c, numero: ++n }));
}

// modelos de estrutura
export interface Beat {
  nome: string;
  guia: string;
}
export interface StructureTemplate {
  id: string;
  nome: string;
  descricao: string;
  /** Tipos de obra para os quais o modelo aparece primeiro. */
  tipos: ProjectType[];
  atos: { titulo: string; batidas: Beat[] }[];
}

export const TEMPLATES: StructureTemplate[] = [
  {
    id: "3atos",
    nome: tt("Três atos"),
    descricao: tt("Começo, meio e fim, com as viradas clássicas."),
    tipos: ["roteiro", "quadrinhos", "novel"],
    atos: [
      {
        titulo: tt("Ato 1: apresentação"),
        batidas: [
          { nome: tt("Mundo comum"), guia: tt("Quem é a protagonista e como é a vida dela antes de tudo mudar.") },
          { nome: tt("Incidente incitante"), guia: tt("O acontecimento que tira a protagonista do lugar.") },
          { nome: tt("Virada do 1º ato"), guia: tt("A decisão sem volta que joga a história no conflito.") },
        ],
      },
      {
        titulo: tt("Ato 2: confronto"),
        batidas: [
          { nome: tt("Obstáculos crescentes"), guia: tt("Tentativas, erros e aliados; a pressão aumenta.") },
          { nome: tt("Ponto médio"), guia: tt("Uma revelação ou vitória falsa muda o rumo da história.") },
          { nome: tt("Crise"), guia: tt("Tudo parece perdido; o pior momento.") },
          { nome: tt("Virada do 2º ato"), guia: tt("A descoberta que permite o confronto final.") },
        ],
      },
      {
        titulo: tt("Ato 3: resolução"),
        batidas: [
          { nome: tt("Clímax"), guia: tt("O confronto decisivo.") },
          { nome: tt("Resolução"), guia: tt("O novo equilíbrio: o que mudou.") },
        ],
      },
    ],
  },
  {
    id: "savethecat",
    nome: tt("Save the Cat (15 batidas)"),
    descricao: tt("As batidas de Blake Snyder, muito usadas em cinema."),
    tipos: ["roteiro", "novel"],
    atos: [
      {
        titulo: tt("Ato 1"),
        batidas: [
          { nome: tt("Imagem de abertura"), guia: tt("Um retrato de onde a protagonista está no começo.") },
          { nome: tt("Tema apresentado"), guia: tt("Alguém diz (sem perceber) qual é a lição da história.") },
          { nome: tt("Preparação"), guia: tt("O mundo, as falhas e o que precisa mudar.") },
          { nome: tt("Catalisador"), guia: tt("O acontecimento que muda tudo.") },
          { nome: tt("Debate"), guia: tt("A dúvida: ir ou não ir?") },
          { nome: tt("Virada para o 2º ato"), guia: tt("A escolha de entrar no mundo novo.") },
        ],
      },
      {
        titulo: tt("Ato 2A"),
        batidas: [
          { nome: tt("História B"), guia: tt("A relação que carrega o tema (amor, amizade, mentor).") },
          { nome: tt("Diversão e jogos"), guia: tt("A promessa da premissa: o que o público veio ver.") },
          { nome: tt("Ponto médio"), guia: tt("Vitória ou derrota falsa; as apostas sobem.") },
        ],
      },
      {
        titulo: tt("Ato 2B"),
        batidas: [
          { nome: tt("Os vilões se aproximam"), guia: tt("Pressão de fora e de dentro.") },
          { nome: tt("Tudo está perdido"), guia: tt("O fundo do poço; algo (ou alguém) morre.") },
          { nome: tt("Noite escura da alma"), guia: tt("A protagonista encara a própria falha.") },
        ],
      },
      {
        titulo: tt("Ato 3"),
        batidas: [
          { nome: tt("Virada para o 3º ato"), guia: tt("A solução aparece, unindo A e B.") },
          { nome: tt("Final"), guia: tt("O plano em ação; a transformação se prova.") },
          { nome: tt("Imagem final"), guia: tt("O oposto da imagem de abertura.") },
        ],
      },
    ],
  },
  {
    id: "jornada",
    nome: tt("Jornada do Herói"),
    descricao: tt("As 12 etapas de Campbell e Vogler."),
    tipos: ["roteiro", "quadrinhos", "novel"],
    atos: [
      {
        titulo: tt("Partida"),
        batidas: [
          { nome: tt("Mundo comum"), guia: tt("O herói antes da aventura.") },
          { nome: tt("Chamado à aventura"), guia: tt("Surge um problema ou desafio.") },
          { nome: tt("Recusa do chamado"), guia: tt("Medo, dúvida, resistência.") },
          { nome: tt("Encontro com o mentor"), guia: tt("Conselho, treino ou um objeto especial.") },
          { nome: tt("Travessia do primeiro limiar"), guia: tt("Entrada no mundo especial.") },
        ],
      },
      {
        titulo: tt("Iniciação"),
        batidas: [
          { nome: tt("Testes, aliados e inimigos"), guia: tt("As regras do mundo novo.") },
          { nome: tt("Aproximação da caverna oculta"), guia: tt("Preparação para o maior perigo.") },
          { nome: tt("Provação"), guia: tt("O confronto com a morte ou o maior medo.") },
          { nome: tt("Recompensa"), guia: tt("O que foi conquistado.") },
        ],
      },
      {
        titulo: tt("Retorno"),
        batidas: [
          { nome: tt("Caminho de volta"), guia: tt("As consequências da recompensa.") },
          { nome: tt("Ressurreição"), guia: tt("O teste final; o herói renasce.") },
          { nome: tt("Retorno com o elixir"), guia: tt("Volta transformado, trazendo algo para o mundo comum.") },
        ],
      },
    ],
  },
  {
    id: "kishotenketsu",
    nome: tt("Kishōtenketsu (4 atos)"),
    descricao: tt("Estrutura do Leste Asiático, ótima para mangá e contos."),
    tipos: ["quadrinhos", "novel", "roteiro"],
    atos: [
      { titulo: tt("Ki: introdução"), batidas: [{ nome: tt("Introdução"), guia: tt("Personagens e situação.") }] },
      { titulo: tt("Shō: desenvolvimento"), batidas: [{ nome: tt("Desenvolvimento"), guia: tt("A situação se aprofunda, sem grande conflito.") }] },
      { titulo: tt("Ten: reviravolta"), batidas: [{ nome: tt("Reviravolta"), guia: tt("Um elemento inesperado muda o olhar sobre tudo.") }] },
      { titulo: tt("Ketsu: conclusão"), batidas: [{ nome: tt("Conclusão"), guia: tt("As partes se reconciliam num novo sentido.") }] },
    ],
  },
  {
    id: "serie",
    nome: tt("Episódio de série (teaser + 4 atos)"),
    descricao: tt("Formato de TV com ganchos antes de cada intervalo."),
    tipos: ["roteiro"],
    atos: [
      { titulo: tt("Teaser"), batidas: [{ nome: tt("Teaser"), guia: tt("Abre com força e deixa uma pergunta.") }] },
      { titulo: tt("Ato 1"), batidas: [{ nome: tt("Problema do episódio"), guia: tt("O caso/conflito da semana aparece.") }, { nome: tt("Gancho do ato 1"), guia: tt("Termina com uma virada antes do intervalo.") }] },
      { titulo: tt("Ato 2"), batidas: [{ nome: tt("Complicação"), guia: tt("O plano falha, surgem novos obstáculos.") }, { nome: tt("Gancho do ato 2"), guia: tt("Uma revelação.") }] },
      { titulo: tt("Ato 3"), batidas: [{ nome: tt("Pior momento"), guia: tt("A situação chega ao limite.") }, { nome: tt("Gancho do ato 3"), guia: tt("Decisão arriscada.") }] },
      { titulo: tt("Ato 4"), batidas: [{ nome: tt("Clímax e resolução"), guia: tt("O caso se resolve; o arco da temporada avança.") }] },
      { titulo: tt("Tag"), batidas: [{ nome: tt("Tag"), guia: tt("Cena curta final: humor, emoção ou gancho para o próximo.") }] },
    ],
  },
];

/** Modelo de HQ: um capítulo com N páginas (um cartão por página). */
export function comicTemplate(paginas: number): StructureTemplate {
  const n = Math.max(1, Math.min(200, Math.round(paginas)));
  return {
    id: `hq-${n}`,
    nome: tt("HQ com {n} páginas", { n }),
    descricao: tt("Um cartão por página."),
    tipos: ["quadrinhos"],
    atos: [
      {
        titulo: tt("Capítulo"),
        batidas: Array.from({ length: n }, (_, i) => ({
          nome: tt("Página {n}", { n: i + 1 }),
          guia: i === 0 ? tt("Página de abertura: prenda o leitor.") : i === n - 1 ? tt("Última página: gancho ou fecho.") : i % 2 === 1 ? tt("Página da esquerda.") : tt("Página da direita: bom lugar para uma revelação."),
        })),
      },
    ],
  };
}

/** Atos e cartões-guia de um modelo, acrescentados ao fim da escaleta. */
export function applyTemplate(o: Outline, t: StructureTemplate): Outline {
  const atos: OutlineAct[] = [...o.atos];
  const cartoes: OutlineCard[] = [...o.cartoes];
  for (const a of t.atos) {
    const ato: OutlineAct = { id: newId(), titulo: a.titulo };
    atos.push(ato);
    for (const b of a.batidas) cartoes.push({ ...emptyCard(ato.id), cabecalho: b.nome, guia: b.guia });
  }
  return { ...o, atos, cartoes: renumber(cartoes) };
}

// ligação com o documento

/** Início e fim [de, ate) de cada seção (cena, página da HQ, capítulo) no documento. */
export function sectionRanges(elementos: ScreenplayElement[], sectionType: string): Map<string, { de: number; ate: number }> {
  const out = new Map<string, { de: number; ate: number }>();
  let atual: string | null = null;
  elementos.forEach((e, i) => {
    if (e.tipo !== sectionType) return;
    if (atual) out.get(atual)!.ate = i;
    atual = e.id;
    out.set(e.id, { de: i, ate: elementos.length });
  });
  return out;
}

/**
 * Move a seção inteira (o bloco que a abre e tudo até a próxima) para antes
 * da seção `antesDe` (ou para o fim). Devolve a nova lista de elementos.
 */
export function moveSection(elementos: ScreenplayElement[], sectionType: string, id: string, antesDe: string | null): ScreenplayElement[] {
  const r = sectionRanges(elementos, sectionType);
  const de = r.get(id);
  if (!de || id === antesDe) return elementos;
  const bloco = elementos.slice(de.de, de.ate);
  const resto = [...elementos.slice(0, de.de), ...elementos.slice(de.ate)];
  if (!antesDe) return [...resto, ...bloco];
  const alvo = resto.findIndex((e) => e.id === antesDe);
  if (alvo < 0) return elementos;
  return [...resto.slice(0, alvo), ...bloco, ...resto.slice(alvo)];
}

/**
 * Ordem que as seções ligadas devem ter, seguindo a ordem dos cartões. Seções
 * sem cartão ficam onde estão em relação às vizinhas.
 */
export function reorderDocByCards(elementos: ScreenplayElement[], sectionType: string, cartoes: OutlineCard[]): ScreenplayElement[] {
  const r = sectionRanges(elementos, sectionType);
  const ligadas = cartoes.map((c) => c.elementoId).filter((id): id is string => !!id && r.has(id));
  let els = elementos;
  // insere cada seção ligada antes da próxima da ordem desejada, de trás para frente
  for (let k = ligadas.length - 2; k >= 0; k--) {
    els = moveSection(els, sectionType, ligadas[k], ligadas[k + 1]);
  }
  return els;
}

/** Texto do bloco da seção a partir do cabeçalho do cartão (e o contrário). */
export function headingToSection(kind: ProjectType, cabecalho: string): string {
  if (kind === "roteiro") return cabecalho.toUpperCase();
  if (kind === "quadrinhos") return cabecalho.replace(/^P[ÁA]GINA\s*\d*\s*:?\s*/i, "");
  return cabecalho;
}

// quem fala em cada seção, local e período
export interface SectionInfo {
  /** Nomes (em maiúsculas) de quem fala. */
  falam: string[];
  local: string;
  periodo: string;
  ambiente: "INT" | "EXT" | "";
  palavras: number;
}

export function sectionInfo(elementos: ScreenplayElement[], sectionType: string): Map<string, SectionInfo> {
  const out = new Map<string, SectionInfo>();
  for (const [id, { de, ate }] of sectionRanges(elementos, sectionType)) {
    const falam = new Set<string>();
    let palavras = 0;
    for (let i = de; i < ate; i++) {
      const e = elementos[i];
      if (e.tipo === "personagem" && e.texto.trim()) falam.add(cleanCharacterName(e.texto));
      palavras += e.texto.trim() ? e.texto.trim().split(/\s+/).length : 0;
    }
    const h = elementos[de].texto.trim();
    const amb = /^\s*INT\.?\s*\/\s*EXT|^\s*I\/E/i.test(h) ? "" : /^\s*INT/i.test(h) ? "INT" : /^\s*EXT/i.test(h) ? "EXT" : "";
    const periodo = h.match(/[-–—]\s*([^-–—]+)$/)?.[1]?.trim().toUpperCase() ?? "";
    out.set(id, { falam: [...falam], local: sectionType === "cabecalho" ? parseHeadingLocation(h) : "", periodo, ambiente: amb, palavras });
  }
  return out;
}

/** Ids dos personagens cadastrados que falam na seção. */
export function detectCharacters(falam: string[], personagens: { id: string; nome: string }[]): string[] {
  const set = new Set(falam);
  return personagens.filter((p) => p.nome.trim() && set.has(cleanCharacterName(p.nome))).map((p) => p.id);
}

// plantar e colher
export interface PlantWarning {
  cartaoId: string;
  plantioId: string;
  texto: string;
  motivo: "sem-retorno" | "retorno-antes";
}

export function plantWarnings(cartoes: OutlineCard[]): PlantWarning[] {
  const ordem = new Map(cartoes.map((c, i) => [c.id, i]));
  const out: PlantWarning[] = [];
  for (const c of cartoes) {
    for (const p of c.plantios ?? []) {
      if (!p.texto.trim()) continue;
      if (!p.colheitaId || !ordem.has(p.colheitaId)) out.push({ cartaoId: c.id, plantioId: p.id, texto: p.texto, motivo: "sem-retorno" });
      else if (ordem.get(p.colheitaId)! <= ordem.get(c.id)!) out.push({ cartaoId: c.id, plantioId: p.id, texto: p.texto, motivo: "retorno-antes" });
    }
  }
  return out;
}

// tramas
export const TRAMA_CORES = ["#d0574f", "#dd8a3c", "#c9a227", "#4f9a6a", "#4f7fc7", "#8b6cc7", "#8a8a84"];

const COR_ANTIGA: Record<string, string> = {
  vermelho: "#d0574f",
  laranja: "#dd8a3c",
  amarelo: "#c9a227",
  verde: "#4f9a6a",
  azul: "#4f7fc7",
  roxo: "#8b6cc7",
};

/** Cartões com a cor antiga ganham tramas com nome ("Trama A", "Trama B"...). */
export function migrateCardColors(o: Outline): Outline {
  if (o.tramas?.length || !o.cartoes.some((c) => c.cor && !c.tramaId)) return o;
  const cores = [...new Set(o.cartoes.map((c) => c.cor).filter((c): c is string => !!c))];
  const tramas: Trama[] = cores.map((c, i) => ({ id: newId(), nome: tt("Trama {letra}", { letra: String.fromCharCode(65 + i) }), cor: COR_ANTIGA[c] ?? TRAMA_CORES[i % TRAMA_CORES.length] }));
  const porCor = new Map(cores.map((c, i) => [c, tramas[i].id]));
  return { ...o, tramas, cartoes: o.cartoes.map((c) => (c.cor && !c.tramaId ? { ...c, tramaId: porCor.get(c.cor), cor: undefined } : c)) };
}

/**
 * Depois de mover o cartão `cardId` na escaleta, move a seção dele no
 * documento para ficar na mesma posição relativa: antes da seção do próximo
 * cartão ligado, ou logo depois da seção do cartão ligado anterior.
 */
export function moveCardSection(elementos: ScreenplayElement[], sectionType: string, cartoes: OutlineCard[], cardId: string): ScreenplayElement[] {
  const r = sectionRanges(elementos, sectionType);
  const idx = cartoes.findIndex((c) => c.id === cardId);
  const card = cartoes[idx];
  if (!card?.elementoId || !r.has(card.elementoId)) return elementos;
  const proximo = cartoes.slice(idx + 1).find((c) => c.elementoId && r.has(c.elementoId) && c.elementoId !== card.elementoId);
  if (proximo) return moveSection(elementos, sectionType, card.elementoId, proximo.elementoId!);
  const anterior = [...cartoes.slice(0, idx)].reverse().find((c) => c.elementoId && r.has(c.elementoId));
  if (!anterior) return elementos;
  // a seção que vem depois da anterior no documento (sem contar a que está sendo movida)
  const ordem = [...r.keys()].filter((id) => id !== card.elementoId);
  const depois = ordem[ordem.indexOf(anterior.elementoId!) + 1] ?? null;
  return moveSection(elementos, sectionType, card.elementoId, depois);
}
