// Operações de alto nível sobre um projeto: criar, carregar e salvar.

import type { ProjectDir } from "@/storage/dir";
import {
  Character,
  Cover,
  Episode,
  LoadedProject,
  Location,
  Outline,
  OutlineCard,
  ProjectMeta,
  ProjectType,
  Screenplay,
  ScreenplayElement,
  SCHEMA_VERSION,
  StoryObject,
  WorkFormat,
  BookParts,
  DEFAULT_BOOK_PARTS,
  Idea,
  Reference,
  Board,
  ResearchTree,
  SeasonPlan,
} from "@/types";
import { getDir, readJSON, writeJSON } from "@/storage/fs";
import { FORMAT_VERSION, runMigrations } from "@/domain/migrations";
import { readResearch, writeResearch } from "@/domain/researchStore";
import { KINDS, NOVEL_TEMPLATES, defaultPageSettings } from "@/layout/profiles";
import { tt, Lang, tdoc, uiLang } from "@/i18n";

function initialPageSettings(tipo: ProjectType, modelo?: string) {
  const base = defaultPageSettings(tipo);
  const t = tipo === "novel" && modelo ? NOVEL_TEMPLATES.find((x) => x.id === modelo) : undefined;
  return t ? { ...base, ...t.settings, modelo: t.id } : base;
}

// Caminhos dos arquivos dentro da pasta do projeto (comuns a todos os tipos).
export const PATHS = {
  meta: ["projeto.json"],
  characters: ["personagens", "personagens.json"],
  locations: ["locais", "locais.json"],
  objects: ["objetos", "objetos.json"],
  ideas: ["ideias", "ideias.json"],
  references: ["pesquisa", "referencias.json"],
} as const;

export function emptyBoard(): Board {
  return { itens: [], ligacoes: [], vista: { x: 0, y: 0, zoom: 1 } };
}

/** Pesquisa de um projeto novo: um quadro pronto para usar. */
export function emptyResearch(): ResearchTree {
  return {
    nos: [{ id: newId(), tipo: "quadro", titulo: tt("Quadro"), paiId: null, quadro: emptyBoard(), criadoEm: new Date().toISOString() }],
  };
}

// Subpastas que criamos vazias na criação do projeto.
const EMPTY_FOLDERS = ["anexos", "exportados", "backups"];

type MetaLike = Pick<ProjectMeta, "tipo" | "formato">;

/** Pasta do documento: roteiro/ (roteiro e HQ) ou manuscrito/ (novel). */
function docFolder(meta: MetaLike): { folder: string; file: string } {
  const k = KINDS[meta.tipo] ?? KINDS.roteiro;
  return { folder: k.folder, file: k.docFile };
}

/** Lista de episódios/edições. */
export function episodesPath(meta: MetaLike): string[] {
  return [docFolder(meta).folder, "episodios.json"];
}

export function episodeContentPaths(meta: MetaLike, epId: string) {
  const { folder, file } = docFolder(meta);
  const base = [folder, "episodios", epId];
  return {
    cover: [...base, "capa.json"],
    screenplay: [...base, file],
    outline: [...base, "escaleta.json"],
  };
}

/** Caminhos de capa/documento/escaleta: raiz (obra única) ou parte (série). */
export function contentPaths(meta: MetaLike, epId: string | null) {
  if (meta.formato === "serie" && epId) return episodeContentPaths(meta, epId);
  const { folder, file } = docFolder(meta);
  return {
    cover: [folder, "capa.json"],
    screenplay: [folder, file],
    outline: [folder, "escaleta.json"],
  };
}

export function newId(): string {
  return crypto.randomUUID();
}

function emptyScreenplay(): Screenplay {
  return { schemaVersion: SCHEMA_VERSION, elementos: [] };
}

/** Documento inicial de um projeto novo (já com a estrutura do tipo). */
export function starterScreenplay(tipo: ProjectType, lang?: Lang): Screenplay {
  const el = (t: ScreenplayElement["tipo"], texto = ""): ScreenplayElement => ({
    id: newId(),
    tipo: t,
    texto,
  });
  let elementos: ScreenplayElement[] = [];
  if (tipo === "quadrinhos") elementos = [el("pagina"), el("quadro"), el("descricao")];
  if (tipo === "novel") elementos = [el("capitulo", tdoc(lang, "Capítulo {n}", { n: 1 })), el("paragrafo")];
  return { schemaVersion: SCHEMA_VERSION, elementos };
}

function emptyOutline(): Outline {
  return { atos: [], cartoes: [] };
}

/** Aceita tanto o formato novo (Outline) quanto o antigo (array de cartões). */
function normalizeOutline(raw: unknown): Outline {
  if (Array.isArray(raw)) return { atos: [], cartoes: raw as OutlineCard[] };
  if (raw && typeof raw === "object" && "cartoes" in raw) {
    const o = raw as Outline;
    return { atos: o.atos ?? [], cartoes: o.cartoes ?? [] };
  }
  return emptyOutline();
}

export function initialCover(nome: string, autor: string): Cover {
  return {
    titulo: nome,
    subtitulo: "",
    autor,
    baseadoEm: "",
    contato: "",
    telefone: "",
    email: "",
    data: "",
  };
}

/**
 * Cria a estrutura de um novo projeto no disco.
 * @param root handle da pasta do projeto (já escolhida/criada pelo usuário).
 */
export async function createProject(
  root: ProjectDir,
  input: {
    nome: string;
    autor: string;
    tipo: ProjectType;
    formato?: WorkFormat;
    livro?: BookParts;
    /** Novel: modelo de diagramação inicial (formato do livro). */
    modelo?: string;
  }
): Promise<LoadedProject> {
  const now = new Date().toISOString();
  const formato = input.tipo === "novel" ? "filme" : input.formato ?? "filme";
  const meta: ProjectMeta = {
    id: newId(),
    schemaVersion: FORMAT_VERSION,
    idioma: uiLang(),
    tipo: input.tipo,
    nome: input.nome,
    autor: input.autor,
    formato,
    pagina: initialPageSettings(input.tipo, input.modelo),
    ...(input.tipo === "novel" ? { livro: input.livro ?? { ...DEFAULT_BOOK_PARTS } } : {}),
    criadoEm: now,
    atualizadoEm: now,
  };

  const cover = initialCover(input.nome, input.autor);
  const screenplay = starterScreenplay(input.tipo, uiLang());
  const paths = contentPaths(meta, null);

  // Arquivos iniciais.
  await writeJSON(root, PATHS.meta, meta);
  await writeJSON(root, paths.cover, cover);
  await writeJSON(root, paths.screenplay, screenplay);
  await writeJSON(root, paths.outline, emptyOutline());
  await writeJSON(root, PATHS.characters, []);
  await writeJSON(root, PATHS.locations, []);
  await writeJSON(root, PATHS.objects, []);
  await writeJSON(root, PATHS.ideas, []);
  await writeJSON(root, PATHS.references, []);
  const pesquisa = emptyResearch();
  await writeResearch(root, pesquisa, null);

  // Pastas vazias.
  for (const folder of EMPTY_FOLDERS) {
    await getDir(root, [folder], true);
  }

  // Série: cria a primeira parte (T1E1 / edição #1).
  if (meta.formato === "serie") {
    const ep: Episode = {
      id: newId(),
      temporada: 1,
      numero: 1,
      titulo: input.tipo === "roteiro" ? tt("Piloto") : tt("Capítulo {n}", { n: 1 }),
    };
    await saveEpisodes(root, meta, [ep]);
    await createEpisodeFiles(root, meta, ep.id, initialCover(input.nome, input.autor));
  }

  return {
    meta,
    cover,
    screenplay,
    characters: [],
    locations: [],
    objects: [],
    outline: emptyOutline(),
    ideas: [],
    references: [],
    pesquisa,
  };
}

/**
 * Carrega um projeto existente a partir da pasta. Campos ausentes recebem
 * valores padrão (tolerante a projetos criados por versões mais antigas).
 */
export async function loadProject(
  root: ProjectDir
): Promise<LoadedProject> {
  const lido = await readJSON<ProjectMeta>(root, PATHS.meta);
  if (!lido) {
    throw new Error(
      tt("Esta pasta não contém um projeto válido (projeto.json não encontrado).")
    );
  }

  if (!lido.tipo) lido.tipo = "roteiro";
  // arquivos de versões antigas do app são atualizados para o formato atual
  const meta = await runMigrations(root, lido);
  const paths = contentPaths(meta, null);
  // Mescla com os padrões para tolerar capas de versões antigas (sem telefone/email).
  const loadedCover = await readJSON<Partial<Cover>>(root, paths.cover);
  const cover = { ...initialCover(meta.nome, meta.autor), ...(loadedCover ?? {}) };
  const screenplay =
    (await readJSON<Screenplay>(root, paths.screenplay)) ?? emptyScreenplay();
  const characters =
    (await readJSON<Character[]>(root, PATHS.characters)) ?? [];
  const locations = (await readJSON<Location[]>(root, PATHS.locations)) ?? [];
  const objects = (await readJSON<StoryObject[]>(root, PATHS.objects)) ?? [];
  const outline = normalizeOutline(await readJSON<unknown>(root, paths.outline));
  const ideas = (await readJSON<Idea[]>(root, PATHS.ideas)) ?? [];
  const references = (await readJSON<Reference[]>(root, PATHS.references)) ?? [];
  const pesquisa = (await readResearch(root)) ?? emptyResearch();
  const temporada = meta.formato === "serie" ? (await readJSON<SeasonPlan>(root, seasonPath(meta))) ?? { arcos: [], celulas: {} } : undefined;

  return { meta, cover, screenplay, characters, locations, objects, outline, ideas, references, pesquisa, temporada };
}

// Salvamento granular (cada coleção em seu próprio arquivo).
export async function saveMeta(
  root: ProjectDir,
  meta: ProjectMeta
): Promise<void> {
  await writeJSON(root, PATHS.meta, { ...meta, atualizadoEm: new Date().toISOString() });
}

export async function saveCharacters(
  root: ProjectDir,
  characters: Character[]
): Promise<void> {
  await writeJSON(root, PATHS.characters, characters);
}

export async function saveLocations(
  root: ProjectDir,
  locations: Location[]
): Promise<void> {
  await writeJSON(root, PATHS.locations, locations);
}

export async function saveObjects(
  root: ProjectDir,
  objects: StoryObject[]
): Promise<void> {
  await writeJSON(root, PATHS.objects, objects);
}

export async function saveReferences(root: ProjectDir, references: Reference[]): Promise<void> {
  await writeJSON(root, PATHS.references, references);
}

/** Arcos da temporada (seriados), na pasta do documento. */
export function seasonPath(meta: MetaLike): string[] {
  return [docFolder(meta).folder, "temporada.json"];
}

export async function saveSeason(root: ProjectDir, meta: MetaLike, plan: SeasonPlan): Promise<void> {
  await writeJSON(root, seasonPath(meta), plan);
}

export async function saveResearch(root: ProjectDir, pesquisa: ResearchTree): Promise<void> {
  await writeResearch(root, pesquisa);
}

export async function saveIdeas(
  root: ProjectDir,
  ideas: Idea[]
): Promise<void> {
  await writeJSON(root, PATHS.ideas, ideas);
}

// Séries: episódios
export async function loadEpisodes(
  root: ProjectDir,
  meta: MetaLike
): Promise<Episode[]> {
  return (await readJSON<Episode[]>(root, episodesPath(meta))) ?? [];
}

export async function saveEpisodes(
  root: ProjectDir,
  meta: MetaLike,
  episodes: Episode[]
): Promise<void> {
  await writeJSON(root, episodesPath(meta), episodes);
}

export async function loadEpisodeContent(
  root: ProjectDir,
  meta: MetaLike,
  epId: string
): Promise<{ screenplay: Screenplay; cover: Cover; outline: Outline }> {
  const p = episodeContentPaths(meta, epId);
  const screenplay =
    (await readJSON<Screenplay>(root, p.screenplay)) ?? emptyScreenplay();
  const loadedCover = await readJSON<Partial<Cover>>(root, p.cover);
  const cover = { ...initialCover("", ""), ...(loadedCover ?? {}) };
  const outline = normalizeOutline(await readJSON<unknown>(root, p.outline));
  return { screenplay, cover, outline };
}

export async function createEpisodeFiles(
  root: ProjectDir,
  meta: MetaLike,
  epId: string,
  cover: Cover
): Promise<void> {
  const p = episodeContentPaths(meta, epId);
  await writeJSON(root, p.cover, cover);
  await writeJSON(root, p.screenplay, starterScreenplay(meta.tipo));
  await writeJSON(root, p.outline, emptyOutline());
}

/** Salva uma parte do conteúdo no destino certo (raiz p/ filme, episódio p/ série). */
export async function saveContent(
  root: ProjectDir,
  meta: ProjectMeta,
  epId: string | null,
  kind: "cover" | "screenplay" | "outline",
  data: unknown
): Promise<void> {
  const paths = contentPaths(meta, epId);
  await writeJSON(root, paths[kind], data);
}

/** Grava todas as partes do projeto de uma vez (usado ao restaurar backup). */
export async function saveAll(
  root: ProjectDir,
  project: LoadedProject,
  epId: string | null = null
): Promise<void> {
  const paths = contentPaths(project.meta, epId);
  await writeJSON(root, PATHS.meta, project.meta);
  await writeJSON(root, paths.cover, project.cover);
  await writeJSON(root, paths.screenplay, project.screenplay);
  await writeJSON(root, PATHS.characters, project.characters);
  await writeJSON(root, PATHS.locations, project.locations);
  await writeJSON(root, PATHS.objects, project.objects);
  await writeJSON(root, paths.outline, project.outline);
  await writeJSON(root, PATHS.ideas, project.ideas ?? []);
  await writeJSON(root, PATHS.references, project.references ?? []);
  await writeResearch(root, project.pesquisa ?? emptyResearch(), null);
  if (project.temporada) await writeJSON(root, seasonPath(project.meta), project.temporada);
}
