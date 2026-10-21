// Perfis de documento: o que muda entre ROTEIRO, QUADRINHOS e NOVEL.

import {
  ElementType,
  FontChoice,
  PageNumbering,
  PageSettings,
  ProjectMeta,
  ProjectType,
  WorkFormat,
} from "@/types";
import { tt, Lang, tdoc, uiLang } from "@/i18n";

// unidades
export const MM = 96 / 25.4; // px por milímetro
export const PT = 96 / 72; // px por ponto tipográfico
/** Arredonda para 1/64 px: a unidade interna de layout do navegador. */
export const q = (x: number) => Math.round(x * 64) / 64;

// Tipos de projeto
export interface BlockDef {
  tipo: ElementType;
  label: string; // nome completo (menus, busca)
  short: string; // rótulo da barra de ferramentas
  placeholder: string;
  /** Tipo do bloco criado ao apertar Enter no fim deste. */
  enter: ElementType;
}

export interface FormatDef {
  id: WorkFormat;
  label: string;
  hint: string;
}

export interface KindDef {
  id: ProjectType;
  label: string; // "Roteiro audiovisual"
  desc: string;
  docLabel: string; // nome da aba do editor
  folder: string; // pasta do documento no disco
  docFile: string; // arquivo do documento
  blocks: BlockDef[]; // ordem = ciclo do Tab e atalhos Ctrl+1..N
  defaultType: ElementType;
  /** Tab circula o tipo do bloco (roteiro/HQ). No novel, Tab não faz nada. */
  tabCycles: boolean;
  /** Permite negrito/itálico (Ctrl+B / Ctrl+I). */
  marks: boolean;
  formatos: FormatDef[];
  /** Nome de cada parte quando o projeto é "em partes". */
  partLabel: string;
  partLabelPlural: string;
  /** Bloco que abre uma seção (cena, página da HQ, capítulo), sumário/escaleta. */
  sectionType: ElementType;
  sectionLabel: string; // "Cenas" | "Páginas" | "Capítulos"
}

export const KINDS: Record<ProjectType, KindDef> = {
  roteiro: {
    id: "roteiro",
    label: tt("Roteiro audiovisual"),
    desc: tt("Filme, série, curta ou animação no formato de indústria."),
    docLabel: tt("Roteiro"),
    folder: "roteiro",
    docFile: "screenplay.json",
    defaultType: "cabecalho",
    tabCycles: true,
    marks: false,
    partLabel: tt("Episódio"),
    partLabelPlural: tt("Episódios"),
    sectionType: "cabecalho",
    sectionLabel: tt("Cenas"),
    blocks: [
      { tipo: "cabecalho", label: tt("Cabeçalho de cena"), short: tt("Cena"), placeholder: tt("INT. LOCAL - DIA"), enter: "acao" },
      { tipo: "acao", label: tt("Ação"), short: tt("Ação"), placeholder: tt("Descreva a ação…"), enter: "acao" },
      { tipo: "personagem", label: tt("Personagem"), short: tt("Personagem"), placeholder: tt("PERSONAGEM"), enter: "dialogo" },
      { tipo: "dialogo", label: tt("Diálogo"), short: tt("Diálogo"), placeholder: tt("Fala do personagem…"), enter: "acao" },
      { tipo: "parentese", label: tt("Parêntese"), short: tt("Parêntese"), placeholder: tt("(entonação)"), enter: "dialogo" },
      { tipo: "transicao", label: tt("Transição"), short: tt("Transição"), placeholder: tt("CORTA PARA:"), enter: "cabecalho" },
    ],
    formatos: [
      { id: "filme", label: tt("Filme"), hint: tt("obra única") },
      { id: "serie", label: tt("Seriado"), hint: tt("episódios") },
    ],
  },
  quadrinhos: {
    id: "quadrinhos",
    label: tt("Quadrinhos"),
    desc: tt("Roteiro de HQ: páginas, quadros, balões, legendas e SFX."),
    docLabel: tt("Roteiro"),
    folder: "roteiro",
    docFile: "screenplay.json",
    defaultType: "pagina",
    tabCycles: true,
    marks: true,
    partLabel: tt("Capítulo"),
    partLabelPlural: tt("Capítulos"),
    sectionType: "pagina",
    sectionLabel: tt("Páginas"),
    blocks: [
      { tipo: "pagina", label: tt("Página"), short: tt("Página"), placeholder: tt("observação da página (opcional)"), enter: "quadro" },
      { tipo: "quadro", label: tt("HQ|Quadro"), short: tt("HQ|Quadro"), placeholder: tt("enquadramento (opcional)"), enter: "descricao" },
      { tipo: "descricao", label: tt("Descrição do quadro"), short: tt("Descrição"), placeholder: tt("O que o desenhista deve mostrar…"), enter: "personagem" },
      { tipo: "personagem", label: tt("Personagem (quem fala)"), short: tt("Personagem"), placeholder: tt("PERSONAGEM"), enter: "balao" },
      { tipo: "balao", label: tt("Balão (fala)"), short: tt("Balão"), placeholder: tt("Texto do balão…"), enter: "personagem" },
      { tipo: "legenda", label: tt("Legenda (recordatório)"), short: tt("Legenda"), placeholder: tt("texto da legenda…"), enter: "personagem" },
      { tipo: "sfx", label: tt("Onomatopeia (SFX)"), short: tt("SFX"), placeholder: tt("KRA-KOOM"), enter: "descricao" },
      { tipo: "nota", label: tt("Nota para o desenhista"), short: tt("Nota"), placeholder: tt("observação…"), enter: "descricao" },
    ],
    formatos: [
      { id: "filme", label: tt("História única"), hint: tt("uma história fechada") },
      { id: "serie", label: tt("Em capítulos"), hint: tt("vários capítulos") },
    ],
  },
  novel: {
    id: "novel",
    label: tt("Novel / livro"),
    desc: tt("Texto corrido com capítulos, diagramado como livro."),
    docLabel: tt("Manuscrito"),
    folder: "manuscrito",
    docFile: "texto.json",
    defaultType: "paragrafo",
    tabCycles: false,
    marks: true,
    partLabel: "Volume",
    partLabelPlural: "Volumes",
    sectionType: "capitulo",
    sectionLabel: tt("Capítulos"),
    blocks: [
      { tipo: "capitulo", label: tt("Título de capítulo"), short: tt("Capítulo"), placeholder: tt("Capítulo 1"), enter: "paragrafo" },
      { tipo: "paragrafo", label: tt("Parágrafo"), short: tt("Parágrafo"), placeholder: tt("Escreva aqui…"), enter: "paragrafo" },
      { tipo: "separador", label: tt("Separador de cena"), short: tt("Separador"), placeholder: "", enter: "paragrafo" },
      { tipo: "citacao", label: tt("Citação / epígrafe"), short: tt("Citação"), placeholder: tt("Citação…"), enter: "paragrafo" },
    ],
    formatos: [
      { id: "filme", label: tt("Livro"), hint: tt("texto corrido") },
    ],
  },
};

export function kindOf(meta: Pick<ProjectMeta, "tipo">): KindDef {
  return KINDS[meta.tipo] ?? KINDS.roteiro;
}

export function blockDef(kind: KindDef, tipo: ElementType): BlockDef {
  return kind.blocks.find((b) => b.tipo === tipo) ?? kind.blocks[0];
}

/** Rótulo de qualquer tipo de bloco (para busca/command palette). */
export const ELEMENT_LABEL: Record<ElementType, string> = Object.fromEntries(
  Object.values(KINDS).flatMap((k) => k.blocks.map((b) => [b.tipo, b.label]))
) as Record<ElementType, string>;

export function nextTypeOnTab(kind: KindDef, t: ElementType, dir = 1): ElementType {
  const list = kind.blocks.map((b) => b.tipo);
  const i = Math.max(0, list.indexOf(t));
  return list[(i + dir + list.length) % list.length];
}

export function nextTypeOnEnter(kind: KindDef, t: ElementType): ElementType {
  return kind.blocks.find((b) => b.tipo === t)?.enter ?? kind.defaultType;
}

// Formatos de papel e de livro
export interface PagePreset {
  id: string;
  label: string;
  w: number; // mm
  h: number; // mm
  grupo: "folha" | "livro";
}

export const PAGE_PRESETS: PagePreset[] = [
  { id: "carta", label: tt("Carta (Letter) · 21,6 × 27,9 cm"), w: 215.9, h: 279.4, grupo: "folha" },
  { id: "a4", label: tt("A4 · 21 × 29,7 cm"), w: 210, h: 297, grupo: "folha" },
  { id: "14x21", label: tt("14 × 21 cm · brochura padrão no Brasil"), w: 140, h: 210, grupo: "livro" },
  { id: "16x23", label: tt("16 × 23 cm · livro grande"), w: 160, h: 230, grupo: "livro" },
  { id: "a5", label: tt("A5 · 14,8 × 21 cm"), w: 148, h: 210, grupo: "livro" },
  { id: "13x20", label: tt("13 × 20 cm"), w: 130, h: 200, grupo: "livro" },
  { id: "12x18", label: tt("12 × 18 cm"), w: 120, h: 180, grupo: "livro" },
  { id: "bolso", label: tt("Bolso · 11 × 18 cm"), w: 110, h: 180, grupo: "livro" },
  { id: "b6", label: tt("B6 · 12,8 × 18,2 cm (mangá / tankobon)"), w: 128, h: 182, grupo: "livro" },
  { id: "a6", label: tt("A6 · 10,5 × 14,8 cm (bunko / light novel)"), w: 105, h: 148, grupo: "livro" },
  { id: "6x9", label: tt("6 × 9 pol · 15,2 × 22,9 cm (trade / KDP)"), w: 152.4, h: 228.6, grupo: "livro" },
  { id: "5.5x8.5", label: tt("5,5 × 8,5 pol · 14 × 21,6 cm (digest)"), w: 139.7, h: 215.9, grupo: "livro" },
  { id: "5x8", label: tt("5 × 8 pol · 12,7 × 20,3 cm"), w: 127, h: 203.2, grupo: "livro" },
  { id: "web", label: tt("Tela · 16 × 24 cm (leitura na web)"), w: 160, h: 240, grupo: "livro" },
];

export function presetById(id: string): PagePreset | undefined {
  return PAGE_PRESETS.find((p) => p.id === id);
}

// modelos de diagramação para novel
export interface NovelTemplate {
  id: string;
  label: string;
  desc: string;
  settings: Partial<PageSettings>;
}

const BOOK_COMMON: Partial<PageSettings> = {
  espelhar: true,
  fonte: "garamond",
  justificar: true,
  hifenizar: true,
  espacoParagrafo: 0,
  numeracao: "rodape-centro",
  cabecalhoCorrente: true,
  capituloNovaPagina: true,
  capituloImpar: false,
};

export const NOVEL_TEMPLATES: NovelTemplate[] = [
  {
    id: "livro-14x21",
    label: tt("Livro 14 × 21 cm"),
    desc: tt("Brochura padrão das editoras brasileiras."),
    settings: { ...BOOK_COMMON, formato: "14x21", largura: 140, altura: 210, margemTopo: 18, margemBase: 20, margemInterna: 20, margemExterna: 15, tamanho: 11, entrelinha: 1.2, recuo: 6 },
  },
  {
    id: "livro-16x23",
    label: tt("Livro 16 × 23 cm"),
    desc: tt("Formato maior, mais palavras por página."),
    settings: { ...BOOK_COMMON, formato: "16x23", largura: 160, altura: 230, margemTopo: 20, margemBase: 22, margemInterna: 22, margemExterna: 17, tamanho: 11.5, entrelinha: 1.2, recuo: 7 },
  },
  {
    id: "bolso",
    label: tt("Livro de bolso 11 × 18 cm"),
    desc: tt("Compacto, fonte menor."),
    settings: { ...BOOK_COMMON, formato: "bolso", largura: 110, altura: 180, margemTopo: 14, margemBase: 16, margemInterna: 16, margemExterna: 11, tamanho: 9.5, entrelinha: 1.15, recuo: 5 },
  },
  {
    id: "a5",
    label: tt("A5 (14,8 × 21 cm)"),
    desc: tt("Bom para imprimir em casa como livreto em folhas A4."),
    settings: { ...BOOK_COMMON, formato: "a5", largura: 148, altura: 210, margemTopo: 18, margemBase: 20, margemInterna: 20, margemExterna: 15, tamanho: 11, entrelinha: 1.2, recuo: 6 },
  },
  {
    id: "kdp-6x9",
    label: tt("6 × 9 pol (Amazon KDP)"),
    desc: tt("Padrão de autopublicação internacional."),
    settings: { ...BOOK_COMMON, formato: "6x9", largura: 152.4, altura: 228.6, margemTopo: 19, margemBase: 19, margemInterna: 22, margemExterna: 16, tamanho: 11, entrelinha: 1.2, recuo: 7 },
  },
  {
    id: "bunko",
    label: tt("Light novel (bunko A6)"),
    desc: tt("Formato pequeno japonês, 10,5 × 14,8 cm."),
    settings: { ...BOOK_COMMON, formato: "a6", largura: 105, altura: 148, margemTopo: 12, margemBase: 14, margemInterna: 14, margemExterna: 10, tamanho: 9, entrelinha: 1.2, recuo: 4 },
  },
  {
    id: "web",
    label: tt("Web"),
    desc: tt("Para publicar na internet: leitura em tela, parágrafos separados, sem numeração. Exporte como página web ou copie e cole."),
    settings: {
      formato: "web", largura: 160, altura: 240, margemTopo: 16, margemBase: 18, margemInterna: 16, margemExterna: 16,
      espelhar: false, fonte: "literata", tamanho: 11.5, entrelinha: 1.55, recuo: 0, espacoParagrafo: 8,
      justificar: false, hifenizar: false, numeracao: "nenhuma", cabecalhoCorrente: false,
      capituloNovaPagina: false, capituloImpar: false,
    },
  },
  {
    id: "manuscrito",
    label: tt("Manuscrito para editora / concurso"),
    desc: tt("A4, Times 12, espaço duplo, sem justificar."),
    settings: {
      formato: "a4", largura: 210, altura: 297, margemTopo: 25, margemBase: 25, margemInterna: 25, margemExterna: 25,
      espelhar: false, fonte: "serif", tamanho: 12, entrelinha: 2, recuo: 12.5, espacoParagrafo: 0,
      justificar: false, hifenizar: false, numeracao: "topo-direita", cabecalhoCorrente: false,
      capituloNovaPagina: true, capituloImpar: false,
    },
  },
  {
    id: "rascunho",
    label: tt("Rascunho A4"),
    desc: tt("Folha A4 confortável para escrever e revisar."),
    settings: {
      formato: "a4", largura: 210, altura: 297, margemTopo: 25, margemBase: 25, margemInterna: 30, margemExterna: 25,
      espelhar: false, fonte: "serif", tamanho: 12, entrelinha: 1.5, recuo: 12.5, espacoParagrafo: 0,
      justificar: true, hifenizar: false, numeracao: "rodape-centro", cabecalhoCorrente: false,
      capituloNovaPagina: true, capituloImpar: false,
    },
  },
];

const BASE_SETTINGS: PageSettings = {
  formato: "a4",
  largura: 210,
  altura: 297,
  margemTopo: 25,
  margemBase: 25,
  margemInterna: 25,
  margemExterna: 25,
  espelhar: false,
  fonte: "mono",
  tamanho: 12,
  entrelinha: 1,
  recuo: 0,
  espacoParagrafo: 0,
  justificar: false,
  hifenizar: false,
  numeracao: "topo-direita",
  cabecalhoCorrente: false,
  capituloNovaPagina: true,
  capituloImpar: false,
  numerarCenas: false,
  hqPaginaNova: false,
};

/** Configuração padrão de página para um tipo de projeto novo. */
export function defaultPageSettings(tipo: ProjectType): PageSettings {
  // Roteiro e quadrinhos: A4, Courier 12, margens fixas do padrão de indústria.
  if (tipo === "roteiro" || tipo === "quadrinhos") return { ...BASE_SETTINGS };
  const t = NOVEL_TEMPLATES[0];
  return { ...BASE_SETTINGS, ...t.settings, modelo: t.id };
}

/** Configuração efetiva do projeto (padrões + o que estiver salvo). */
export function pageSettingsOf(meta: Pick<ProjectMeta, "tipo" | "pagina">): PageSettings {
  const base = defaultPageSettings(meta.tipo);
  if (meta.tipo === "novel") return { ...base, ...(meta.pagina ?? {}) };
  // Roteiro e HQ têm formato fixo; só as opções de numeração/quebra valem.
  return {
    ...base,
    numerarCenas: meta.pagina?.numerarCenas ?? base.numerarCenas,
    hqPaginaNova: meta.pagina?.hqPaginaNova ?? base.hqPaginaNova,
  };
}

// Layout resolvido (pixels a 96 dpi)
export type Align = "left" | "right" | "center" | "justify";

export interface BlockStyle {
  indentLeft: number; // px a partir da margem esquerda do texto
  indentRight: number; // px a partir da margem direita do texto
  align: Align;
  upper: boolean;
  bold: boolean;
  italic: boolean;
  muted: boolean;
  fontPt: number;
  lineHeight: number; // px
  spaceBefore: number; // px
  spaceAfter: number; // px (somado ao espaço antes do bloco seguinte)
  firstIndent: number; // px (recuo da 1ª linha)
  splittable: boolean; // pode ser cortado entre duas páginas
  keepWithNext: boolean; // não fica sozinho no pé da página
  pageBreakBefore: boolean; // sempre começa página nova
  sinkTop: number; // px de "afundamento" quando abre uma página (capítulos)
  orphans: number; // linhas mínimas no pé da página
  widows: number; // linhas mínimas no topo da página seguinte
  /** Espaço antes zerado quando o bloco anterior é de um destes tipos. */
  tightAfter: ElementType[];
  /** O parágrafo seguinte não leva recuo de primeira linha. */
  noIndentNext: boolean;
  /** Prefixo fixo exibido antes do texto ("LEGENDA: "). */
  prefix: string;
  /** Diálogo cortado entre páginas ganha (MAIS) / NOME (CONT'D). */
  dialogSplit: boolean;
}

export interface FontInfo {
  css: string; // pilha de fontes CSS
  /** Fonte no PDF: uma das padrão (times/helvetica) ou a família embutida. */
  pdf: string;
  /** Família empacotada no app que é embutida no PDF (mesma da tela). */
  embed?: string;
  ascent: number; // em "em": acha a linha de base no PDF como o navegador
  descent: number;
}

// Fontes do app. As com `embed` vêm empacotadas (src/fonts) e funcionam sem
// internet em qualquer sistema; no PDF entra o mesmo arquivo da tela.
const embedded = (family: string, label: string, fallback: string, ascent = 0.9, descent = 0.27) => ({
  label,
  css: `"${family}", ${fallback}`,
  pdf: family,
  embed: family,
  ascent,
  descent,
  single: 1.15,
});

export const FONTS: Record<FontChoice, FontInfo & { label: string; single: number }> = {
  garamond: embedded("EB Garamond", "Garamond (EB Garamond)", "Garamond, serif", 1.007, 0.298),
  baskerville: embedded("Libre Baskerville", "Baskerville (Libre Baskerville)", "Baskerville, serif", 0.97, 0.27),
  crimson: embedded("Crimson Text", "Crimson Text", "serif", 0.965, 0.35),
  literata: embedded("Literata", tt("Literata (feita para leitura longa)"), "serif", 0.95, 0.25),
  lora: embedded("Lora", "Lora", "serif", 1.006, 0.274),
  serif: {
    label: tt("Times New Roman"),
    css: '"Times New Roman", Times, "Liberation Serif", serif',
    pdf: "times",
    ascent: 0.891,
    descent: 0.216,
    single: 1.15,
  },
  sans: {
    label: tt("Arial (sem serifa)"),
    css: 'Arial, Helvetica, "Liberation Sans", sans-serif',
    pdf: "helvetica",
    ascent: 0.905,
    descent: 0.212,
    single: 1.15,
  },
  mono: {
    ...embedded("Courier Prime", tt("Courier Prime (máquina de escrever)"), '"Courier New", Courier, monospace', 0.83, 0.3),
    single: 1,
  },
};

export interface Layout {
  kind: ProjectType;
  sig: string; // assinatura (muda quando qualquer medida muda)
  pageW: number;
  pageH: number;
  marginTop: number;
  marginBottom: number;
  marginInner: number; // esquerda nas páginas ímpares
  marginOuter: number; // direita nas páginas ímpares
  mirror: boolean;
  contentW: number;
  contentH: number;
  gap: number; // espaço entre folhas na tela
  font: FontChoice;
  fontInfo: FontInfo;
  basePt: number;
  lineHeight: number; // px da linha base
  blocks: Partial<Record<ElementType, BlockStyle>>;
  numbering: PageNumbering;
  numberFirstPage: boolean;
  numberFormat: "ponto" | "simples"; // "2." (roteiro) ou "2"
  runningHead: boolean;
  chapterOdd: boolean;
  sceneNumbers: boolean;
  hyphenate: boolean;
  justify: boolean;
  more: string;
  contd: string;
  /** Idioma do documento (rótulos como PÁGINA, QUADRO, Sumário). */
  lang: Lang;
}

function style(p: Partial<BlockStyle> & { lineHeight: number; fontPt: number }): BlockStyle {
  return {
    indentLeft: 0,
    indentRight: 0,
    align: "left",
    upper: false,
    bold: false,
    italic: false,
    muted: false,
    spaceBefore: 0,
    spaceAfter: 0,
    firstIndent: 0,
    splittable: false,
    keepWithNext: false,
    pageBreakBefore: false,
    sinkTop: 0,
    orphans: 2,
    widows: 2,
    tightAfter: [],
    noIndentNext: false,
    prefix: "",
    dialogSplit: false,
    ...p,
  };
}

/** Margem esquerda (px) da página de índice `pageIndex` (0 = página 1, ímpar). */
export function pageLeftMargin(l: Layout, pageIndex: number): number {
  if (!l.mirror) return l.marginInner;
  return pageIndex % 2 === 0 ? l.marginInner : l.marginOuter;
}

export function resolveLayout(meta: Pick<ProjectMeta, "tipo" | "pagina" | "idioma">): Layout {
  const lang = meta.idioma;
  const s = pageSettingsOf(meta);
  const kind = meta.tipo ?? "roteiro";
  const pageW = q(s.largura * MM);
  const pageH = q(s.altura * MM);

  let marginTop: number, marginBottom: number, marginInner: number, marginOuter: number;
  let font: FontChoice = s.fonte;
  let basePt = s.tamanho;
  let lh: number;
  const blocks: Layout["blocks"] = {};

  if (kind === "roteiro") {
    // Padrão de indústria: Courier 12, 6 linhas por polegada (entrelinha = 12pt).
    // Margens: topo/base 2,5 cm, esquerda 3,5 cm, direita 2,5 cm.
    font = "mono";
    basePt = 12;
    lh = q(12 * PT);
    marginTop = q(25 * MM);
    marginBottom = q(25 * MM);
    marginInner = q(35 * MM);
    marginOuter = q(25 * MM);
    const textLeft = 35;
    const textRight = s.largura - 25;
    // posições absolutas a partir da borda esquerda do papel (mm)
    const at = (left: number, right = textRight) => ({
      indentLeft: q((left - textLeft) * MM),
      indentRight: q(Math.max(0, textRight - right) * MM),
    });
    const dlgL = 65;
    const dlgR = dlgL + 88.9; // diálogo com 3,5" de largura (~35 caracteres)
    const one = lh;
    const base = { lineHeight: lh, fontPt: 12 };
    blocks.cabecalho = style({ ...base, upper: true, bold: true, spaceBefore: one, keepWithNext: true });
    blocks.acao = style({ ...base, spaceBefore: one, splittable: true });
    blocks.personagem = style({ ...base, ...at(90), upper: true, bold: true, spaceBefore: one, keepWithNext: true });
    blocks.dialogo = style({ ...base, ...at(dlgL, dlgR), splittable: true, dialogSplit: true });
    blocks.parentese = style({ ...base, ...at(dlgL + 12.7, dlgR - 12.7), keepWithNext: true });
    blocks.transicao = style({ ...base, upper: true, align: "right", spaceBefore: one });
  } else if (kind === "quadrinhos") {
    marginTop = q(25 * MM);
    marginBottom = q(25 * MM);
    marginInner = q(25 * MM);
    marginOuter = q(25 * MM);
    lh = q(basePt * PT * FONTS[font].single * Math.max(1, s.entrelinha));
    const one = lh;
    const base = { lineHeight: lh, fontPt: basePt };
    const ind = (mm: number) => q(mm * MM);
    blocks.pagina = style({ ...base, upper: true, bold: true, spaceBefore: q(one * 2), keepWithNext: true, pageBreakBefore: s.hqPaginaNova });
    blocks.quadro = style({ ...base, upper: true, bold: true, spaceBefore: one, keepWithNext: true });
    blocks.descricao = style({ ...base, spaceBefore: one, tightAfter: ["quadro"], splittable: true });
    blocks.personagem = style({ ...base, upper: true, bold: true, indentLeft: ind(55), spaceBefore: one, keepWithNext: true });
    blocks.balao = style({ ...base, indentLeft: ind(30), indentRight: ind(25), spaceBefore: one, tightAfter: ["personagem"], splittable: true });
    blocks.legenda = style({ ...base, indentLeft: ind(30), indentRight: ind(25), spaceBefore: one, prefix: tdoc(lang, "LEGENDA: "), splittable: true });
    blocks.sfx = style({ ...base, indentLeft: ind(30), indentRight: ind(25), upper: true, spaceBefore: one, prefix: tdoc(lang, "SFX: ") });
    blocks.nota = style({ ...base, italic: true, muted: true, spaceBefore: one, prefix: tdoc(lang, "NOTA: "), splittable: true });
  } else {
    marginTop = q(s.margemTopo * MM);
    marginBottom = q(s.margemBase * MM);
    marginInner = q(s.margemInterna * MM);
    marginOuter = q(s.margemExterna * MM);
    lh = q(basePt * PT * FONTS[font].single * s.entrelinha);
    const contentH = pageH - marginTop - marginBottom;
    const capPt = Math.round(basePt * 1.6 * 2) / 2;
    const base = { lineHeight: lh, fontPt: basePt };
    blocks.capitulo = style({
      lineHeight: q(capPt * PT * 1.25),
      fontPt: capPt,
      align: "center",
      bold: true,
      spaceBefore: q(lh * 2),
      spaceAfter: q(lh * 2),
      keepWithNext: true,
      pageBreakBefore: s.capituloNovaPagina,
      sinkTop: s.capituloNovaPagina ? q(contentH * 0.22) : 0,
      noIndentNext: true,
    });
    blocks.paragrafo = style({
      ...base,
      align: s.justificar ? "justify" : "left",
      firstIndent: q(s.recuo * MM),
      spaceBefore: q(s.espacoParagrafo * PT),
      splittable: true,
    });
    blocks.separador = style({ ...base, align: "center", spaceBefore: lh, spaceAfter: lh, keepWithNext: true, noIndentNext: true });
    const citPt = Math.round(basePt * 0.95 * 2) / 2;
    blocks.citacao = style({
      lineHeight: q(citPt * PT * FONTS[font].single * Math.min(s.entrelinha, 1.5)),
      fontPt: citPt,
      italic: true,
      indentLeft: q(10 * MM),
      indentRight: q(10 * MM),
      align: s.justificar ? "justify" : "left",
      spaceBefore: q(lh * 0.6),
      spaceAfter: q(lh * 0.6),
      splittable: true,
    });
  }

  const contentW = pageW - marginInner - marginOuter;
  const contentH = pageH - marginTop - marginBottom;

  const layout: Layout = {
    kind,
    sig: "",
    pageW,
    pageH,
    marginTop,
    marginBottom,
    marginInner,
    marginOuter,
    mirror: kind === "novel" && s.espelhar,
    contentW,
    contentH,
    gap: 24,
    font,
    fontInfo: FONTS[font],
    basePt,
    lineHeight: lh,
    blocks,
    numbering: kind === "novel" ? s.numeracao : "topo-direita",
    numberFirstPage: kind !== "roteiro",
    numberFormat: kind === "roteiro" ? "ponto" : "simples",
    runningHead: kind === "novel" && s.cabecalhoCorrente,
    chapterOdd: kind === "novel" && s.capituloNovaPagina && s.capituloImpar,
    sceneNumbers: kind === "roteiro" && s.numerarCenas,
    hyphenate: kind === "novel" && s.hifenizar,
    justify: kind === "novel" && s.justificar,
    more: tdoc(lang, "(MAIS)"),
    contd: tdoc(lang, "(CONT'D)"),
    lang: lang ?? uiLang(),
  };
  layout.sig = hash(JSON.stringify({ ...layout, sig: undefined, fontInfo: undefined }));
  return layout;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Texto do número de página conforme o layout ("2." no roteiro, "2" no livro). */
export function pageNumberText(l: Layout, n: number): string {
  return l.numberFormat === "ponto" ? `${n}.` : String(n);
}
