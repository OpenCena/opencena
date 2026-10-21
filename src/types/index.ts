// Modelo de dados do aplicativo.

export const SCHEMA_VERSION = 1;

/** Tipos de projeto: roteiro audiovisual, roteiro de quadrinhos e novel (texto corrido). */
export type ProjectType = "roteiro" | "quadrinhos" | "novel";

/**
 * Obra única ou em partes. Internamente "serie" = projeto com várias partes
 * (episódios no roteiro, edições nos quadrinhos). "filme" = obra única.
 */
export type WorkFormat = "filme" | "serie";

// projeto.json: metadados do projeto
export interface ProjectMeta {
  id: string;
  schemaVersion: number;
  tipo: ProjectType;
  nome: string;
  autor: string;
  criadoEm: string; // ISO 8601
  atualizadoEm: string; // ISO 8601
  /** Inserir "(CONT'D)" automaticamente quando o mesmo personagem retoma a fala. */
  contdEnabled?: boolean;
  /** Obra única ou em partes (episódios/edições). */
  formato?: WorkFormat;
  /** Legado: subtipo de versões antigas (não é mais usado). */
  subtipo?: string;
  /** Configuração de página (papel/formato do livro, margens, fonte...). */
  pagina?: PageSettings;
  /** Novel: páginas de abertura do livro que o autor quer usar. */
  livro?: BookParts;
  /** Metas de escrita (palavras). */
  metas?: WritingGoals;
  /** Idioma do documento: convenções como (MAIS)/(CONT'D), "escrito por", "Sumário". */
  idioma?: "pt-BR" | "en" | "es";
}

/** Páginas de abertura (pré-textuais) de um livro. */
export interface BookParts {
  capa: boolean;
  folhaRosto: boolean;
  creditos: boolean;
  dedicatoria: boolean;
  epigrafe: boolean;
  sumario: boolean;
}

export const DEFAULT_BOOK_PARTS: BookParts = {
  capa: true,
  folhaRosto: false,
  creditos: false,
  dedicatoria: false,
  epigrafe: false,
  sumario: false,
};

export interface WritingGoals {
  /** Meta de palavras do projeto inteiro. */
  total?: number;
  /** Meta de palavras por dia. */
  diaria?: number;
  /** Dia (AAAA-MM-DD) em que a contagem diária começou… */
  dia?: string;
  /** …e quantas palavras o texto tinha nesse momento. */
  base?: number;
}

// Configuração de página (Arquivo > Configurar página, estilo Word).
export type FontChoice =
  | "serif" // Times New Roman
  | "sans" // Arial
  | "mono" // Courier Prime
  | "garamond"
  | "baskerville"
  | "crimson"
  | "lora"
  | "literata";

export type PageNumbering =
  | "nenhuma"
  | "topo-direita"
  | "topo-externo"
  | "rodape-centro"
  | "rodape-externo";

export interface PageSettings {
  /** id do formato escolhido (ver PAGE_PRESETS) ou "personalizado". */
  formato: string;
  /** id do modelo de diagramação aplicado por último (só informativo). */
  modelo?: string;
  largura: number; // mm
  altura: number; // mm
  margemTopo: number; // mm
  margemBase: number; // mm
  /** Margem interna (lado da lombada), ou esquerda, se não espelhar. */
  margemInterna: number; // mm
  /** Margem externa: ou direita, se não espelhar. */
  margemExterna: number; // mm
  /** Margens espelhadas (páginas pares/ímpares), como num livro. */
  espelhar: boolean;
  fonte: FontChoice;
  tamanho: number; // pt
  entrelinha: number; // múltiplo do tamanho (1, 1.15, 1.5, 2...)
  recuo: number; // mm: recuo da primeira linha do parágrafo
  espacoParagrafo: number; // pt: espaço antes de cada parágrafo
  justificar: boolean;
  hifenizar: boolean;
  numeracao: PageNumbering;
  /** Cabeçalho corrente: autor nas páginas pares, título nas ímpares. */
  cabecalhoCorrente: boolean;
  /** Capítulos começam em página nova. */
  capituloNovaPagina: boolean;
  /** Capítulos começam sempre em página ímpar (direita). */
  capituloImpar: boolean;
  /** Roteiro: mostrar número das cenas na margem. */
  numerarCenas: boolean;
  /** Quadrinhos: cada página da HQ começa em uma folha nova do roteiro. */
  hqPaginaNova: boolean;
}

// roteiro/screenplay.json, o documento em si
export type ScreenplayElementType =
  | "cabecalho" // INT. QUARTO - NOITE
  | "acao" // Thiago entra e fecha a porta.
  | "personagem" // THIAGO
  | "dialogo" // Eu não posso continuar.
  | "parentese" // (baixo)
  | "transicao"; // FADE OUT.

export type ComicElementType =
  | "pagina" // PÁGINA 1 (3 QUADROS)
  | "quadro" // QUADRO 1
  | "descricao" // Plano geral da cidade.
  | "balao" // texto do balão (o falante é um bloco "personagem")
  | "legenda" // LEGENDA: São Paulo, 2049.
  | "sfx" // SFX: KRA-KOOM
  | "nota"; // NOTA: observação para o desenhista

export type NovelElementType =
  | "capitulo" // Capítulo 1: O começo
  | "paragrafo" // texto corrido
  | "separador" // * * *  (quebra de cena)
  | "citacao"; // epígrafe / citação em bloco

export type ElementType = ScreenplayElementType | ComicElementType | NovelElementType;

/** Formatação de trecho (negrito/itálico), usada em novel e quadrinhos. */
export interface TextMark {
  de: number; // índice do primeiro caractere
  ate: number; // índice após o último caractere
  tipo: "b" | "i";
}

export interface ScreenplayElement {
  id: string;
  tipo: ElementType;
  texto: string;
  /** Trechos em negrito/itálico (opcional). */
  marcas?: TextMark[];
  /** Trechos com comentário: intervalos de caracteres e o id do comentário. */
  comentarios?: CommentAnchor[];
  /** Preenchido pelo app para elementos "cabecalho": número da cena (1, 2, 3…). */
  numeroCena?: number;
}

export interface Screenplay {
  schemaVersion: number;
  elementos: ScreenplayElement[];
  /** Comentários do documento (o trecho comentado fica marcado nos elementos). */
  comentarios?: DocComment[];
}

export interface CommentAnchor {
  id: string;
  de: number;
  ate: number;
}

export interface CommentReply {
  id: string;
  texto: string;
  criadoEm: string;
}

export interface DocComment {
  id: string;
  texto: string;
  criadoEm: string;
  /** Trecho comentado, guardado para mostrar mesmo depois de resolvido. */
  trecho: string;
  resolvido?: boolean;
  respostas?: CommentReply[];
}

// personagens/personagens.json, a "bíblia" de personagens
export interface CharacterRelation {
  personagemId: string;
  tipo: string; // "irmã", "amigo", "antagonista"...
}

export interface Character {
  id: string;
  nome: string; // nome como aparece no roteiro (THIAGO)
  nomeCompleto: string;
  idade: string;
  descricao: string;
  aparencia: string;
  personalidade: string;
  historia: string;
  objetivos: string;
  medos: string;
  conflitos: string;
  arco: string;
  relacoes: CharacterRelation[];
  /** Foto principal (anexos/...). */
  imagem?: string;
  /** Papel na história (protagonista, antagonista...). */
  papel?: string;
}

// locais/locais.json e objetos/objetos.json
export interface Location {
  id: string;
  nome: string; // APARTAMENTO, CASA DE MARIA...
  descricao: string;
  /** Interno, externo ou os dois. */
  ambiente?: string;
  atmosfera?: string;
  epoca?: string;
  notas?: string;
  /** Foto principal (anexos/...). */
  imagem?: string;
}

export interface StoryObject {
  id: string;
  nome: string;
  descricao: string;
  importancia?: string;
  origem?: string;
  notas?: string;
  /** Foto principal (anexos/...). */
  imagem?: string;
}

// Partes: episódios (roteiro) ou edições (quadrinhos), <pasta>/episodios.json.
export interface Episode {
  id: string;
  temporada: number;
  numero: number;
  titulo: string;
}

// capa.json: folha de rosto (title page)
export interface Cover {
  titulo: string;
  subtitulo: string; // ex.: "Episódio piloto"
  autor: string; // "escrito por"
  baseadoEm: string; // "baseado em..."
  contato: string; // nome/agência para contato (rodapé esquerdo)
  telefone: string; // opcional, rodapé esquerdo
  email: string; // opcional, rodapé esquerdo
  data: string; // "1ª versão, agosto de 2026"
  // novel / livro
  /** Imagem da capa (arquivo dentro da pasta do projeto) e enquadramento. */
  imagem?: CoverImage;
  /** Título e autor por cima da imagem da capa. */
  capaTexto?: CoverText;
  editora?: string;
  dedicatoria?: string;
  epigrafe?: string;
  epigrafeAutor?: string;
  creditos?: Credits;
}

export interface CoverImage {
  arquivo: string; // ex.: "anexos/capa-1730000000000.jpg"
  /** Ponto de enquadramento (0 = esquerda/topo, 1 = direita/base). */
  x: number;
  y: number;
  /** 1 = preenche a capa; maior = mais zoom. */
  zoom: number;
}

export interface CoverText {
  mostrar: boolean;
  cor: "claro" | "escuro";
  posicao: "topo" | "meio" | "base";
}

export interface Credits {
  copyright: string; // "© 2026 Nome do autor"
  edicao: string; // "1ª edição, 2026"
  isbn: string;
  editora: string;
  ficha: string; // ficha catalográfica (texto livre)
}

// escaleta.json: cartões de cena (outline)
export type CardKind = "cena" | "ideia";

export interface OutlineCard {
  id: string;
  numero: number;
  cabecalho: string; // INT. QUARTO - NOITE / PÁGINA 3 / Capítulo 2
  resumo: string;
  objetivo: string;
  conflito: string;
  observacoes: string;
  personagemIds: string[];
  /** Ato (linha) ao qual o cartão pertence; null = sem ato. */
  atoId?: string | null;
  /** Tipo de cartão: cena do roteiro ou ideia solta. */
  tipo?: CardKind;
  /** Andamento da cena/capítulo. */
  status?: CardStatus;
  /** Legado: cor da trama (hoje a trama tem nome, em `tramaId`). */
  cor?: string;
  /** Linha narrativa (trama A, B, C...). */
  tramaId?: string;
  /** Etiquetas livres (flashback, clímax, virada...). */
  etiquetas?: string[];
  /** Imagem do cartão (storyboard): arquivo em anexos/. */
  imagem?: string;
  /** O que é plantado nesta cena e onde é colhido. */
  plantios?: Plant[];
  /** Função da batida, quando o cartão veio de um modelo de estrutura. */
  guia?: string;
  /** Bloco do documento a que o cartão corresponde (cena, página, capítulo). */
  elementoId?: string;
}

export interface Plant {
  id: string;
  texto: string;
  /** Cartão onde o que foi plantado volta (null = ainda sem retorno). */
  colheitaId?: string | null;
}

export interface Trama {
  id: string;
  nome: string;
  cor: string;
}

/** Arcos da temporada (seriados): o que cada arco faz em cada episódio. */
export interface SeasonPlan {
  arcos: Trama[];
  /** chave "arcoId:episodioId" -> texto */
  celulas: Record<string, string>;
}

export type CardStatus = "afazer" | "escrevendo" | "pronto";

/** Um "ato" é uma linha/faixa que agrupa cartões (Ato 1, Ato 2, Setup…). */
export interface OutlineAct {
  id: string;
  titulo: string;
}

/** A escaleta completa: as faixas (atos) e os cartões. */
export interface Outline {
  atos: OutlineAct[];
  cartoes: OutlineCard[];
  /** Linhas narrativas com nome. */
  tramas?: Trama[];
  /** O roteiro segue a ordem dos cartões (mover um cartão move a cena). */
  ordemLigada?: boolean;
}

// ideias/ideias.json: mural de ideias sobre a obra
export type IdeaTag = "geral" | "personagem" | "cena" | "mundo" | "dialogo" | "pesquisa";

export interface Idea {
  id: string;
  titulo: string;
  texto: string;
  tag: IdeaTag;
  fixada: boolean;
  criadaEm: string; // ISO 8601
  /** Cartão da escaleta criado a partir desta ideia. */
  cartaoId?: string;
}

// pesquisa/: referências e quadro livre
export type RefKind = "link" | "imagem" | "documento" | "nota";

/** A que a referência está ligada: a obra toda ou um elemento dela. */
export interface RefLink {
  tipo: "obra" | "personagem" | "local" | "objeto" | "secao" | "ideia";
  id?: string;
}

export interface Reference {
  id: string;
  tipo: RefKind;
  titulo: string;
  url?: string;
  /** Arquivo guardado na pasta do projeto (anexos/referencias/...). */
  arquivo?: string;
  arquivoNome?: string;
  notas: string;
  vinculos: RefLink[];
  criadaEm: string;
}

export type BoardItemKind = "nota" | "texto" | "referencia" | "elemento";

export interface BoardItem {
  id: string;
  tipo: BoardItemKind;
  /** Vínculos de notas e textos (referências guardam os seus na própria referência). */
  vinculos?: RefLink[];
  x: number;
  y: number;
  w: number;
  h: number;
  texto?: string;
  cor?: string;
  refId?: string;
  elemento?: RefLink;
  /** Imagem dentro da nota (anexos/...). */
  imagem?: string;
  /** Cartão da escaleta criado a partir desta nota. */
  cartaoId?: string;
}

export interface BoardEdge {
  id: string;
  de: string;
  para: string;
}

export interface Board {
  itens: BoardItem[];
  ligacoes: BoardEdge[];
  vista: { x: number; y: number; zoom: number };
}

/** Item da barra lateral da pesquisa: pasta, quadro livre ou página de texto. */
export type ResearchNodeKind = "pasta" | "quadro" | "pagina";

export interface ResearchNode {
  id: string;
  tipo: ResearchNodeKind;
  titulo: string;
  /** Pasta onde está (null = raiz). A ordem é a do array. */
  paiId: string | null;
  /** Pasta aberta na barra lateral. */
  aberta?: boolean;
  quadro?: Board;
  /** Conteúdo da página (documento do editor, em JSON). */
  doc?: unknown;
  /** Página vinculada a elementos da obra. */
  vinculos?: RefLink[];
  criadoEm: string;
}

export interface ResearchTree {
  nos: ResearchNode[];
}

// Estado em memória: um projeto totalmente carregado
export interface LoadedProject {
  meta: ProjectMeta;
  cover: Cover;
  screenplay: Screenplay;
  characters: Character[];
  locations: Location[];
  objects: StoryObject[];
  outline: Outline;
  ideas: Idea[];
  references: Reference[];
  pesquisa: ResearchTree;
  /** Seriados: arcos da temporada. */
  temporada?: SeasonPlan;
}

// Registro de projeto recente (guardado nas configurações do app)
export interface RecentProject {
  id: string;
  nome: string;
  autor: string;
  tipo: ProjectType;
  /** Chave usada para recuperar o handle da pasta no IndexedDB. */
  handleKey: string;
  abertoEm: string; // ISO 8601
}
