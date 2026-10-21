// Estado global do aplicativo (Zustand).

import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import {
  BookParts,
  Character,
  Cover,
  Idea,
  Reference,
  ResearchTree,
  SeasonPlan,
  Episode,
  LoadedProject,
  Location,
  Outline,
  ProjectMeta,
  ProjectType,
  RecentProject,
  SCHEMA_VERSION,
  WorkFormat,
  Screenplay,
  StoryObject,
} from "@/types";
import {
  ensurePermission,
  loadHandle,
  makeHandleKey,
  saveHandle,
} from "@/storage/handles";
import { ProjectDir, childDir, isNative, pickDirectory, removeChildDir, sameDir } from "@/storage/dir";
import { confirmDialog } from "@/components/Dialogs";

/** Pergunta, no visual do app, antes de dar acesso a uma pasta. */
function askFolderAccess(kind: "projetos" | "projeto"): Promise<boolean> {
  const quem = isNative ? tt("o OpenCena") : tt("este site");
  return confirmDialog({
    title: tt("Permitir que {quem} edite arquivos nesta pasta?", { quem }),
    message:
      kind === "projetos"
        ? tt("Escolha a pasta onde seus projetos vão ficar. Os arquivos continuam no seu computador; nada é enviado para a internet.")
        : tt("Escolha a pasta do projeto que você quer abrir."),
    details: [
      tt("Ler e gravar só dentro da pasta escolhida"),
      tt("Salvar enquanto você escreve, com backups"),
      ...(isNative ? [] : [tt("Em seguida o navegador também pede essa confirmação")]),
    ],
    confirmLabel: tt("Permitir e escolher pasta"),
    icon: "folderOpen",
  });
}
import {
  createEpisodeFiles,
  createProject,
  initialCover,
  loadEpisodeContent,
  loadEpisodes,
  loadProject,
  newId,
  saveCharacters,
  saveContent,
  saveEpisodes,
  saveMeta,
  saveLocations,
  saveObjects,
  saveIdeas,
  saveReferences,
  saveResearch,
  saveSeason,
} from "@/domain/project";
import { saveAll } from "@/domain/project";
import {
  BackupInfo,
  BackupKind,
  createBackup as writeBackup,
  projectSig,
  listBackups,
  readBackup,
} from "@/domain/backup";
import { tt, locale } from "@/i18n";

export type Theme = "light" | "dark" | "system";
export type WorkspaceTab =
  | "capa"
  | "editor"
  | "pesquisa"
  | "escaleta"
  | "personagens"
  | "locais"
  | "objetos"
  | "exportar"
  | "historico";

const CONFIG_KEY = "app:config";
const PROJECTS_FOLDER_KEY = "handle:__projects_folder__";

/** Preferências gerais (valem para todos os projetos). */
export interface AppPrefs {
  /** Onde abrem os textos expandidos (páginas da pesquisa). */
  painel: "lateral" | "janela";
  /** Procurar versão nova ao abrir o app instalado. */
  atualizar?: boolean;
}

export const DEFAULT_PREFS: AppPrefs = { painel: "lateral", atualizar: true };

interface PersistedConfig {
  projectsFolderSet: boolean;
  theme: Theme;
  recents: RecentProject[];
  prefs?: AppPrefs;
}

interface CurrentProject {
  root: ProjectDir;
  project: LoadedProject;
  /** Séries: episódios e episódio ativo. Vazio/null para filmes. */
  episodes: Episode[];
  currentEpisodeId: string | null;
}

type EpisodeContent = { screenplay: Screenplay; cover: Cover; outline: Outline };

function emptyScreenplayContent(): Screenplay {
  return { schemaVersion: SCHEMA_VERSION, elementos: [] };
}

interface AppState {
  // estado
  ready: boolean;
  previewMode: boolean;
  /** Conteúdo dos episódios em memória (apenas no modo pré-visualização). */
  previewEpisodes: Record<string, EpisodeContent>;
  projectsFolderSet: boolean;
  theme: Theme;
  recents: RecentProject[];
  prefs: AppPrefs;
  current: CurrentProject | null;
  workspaceTab: WorkspaceTab;
  saving: boolean;
  lastSavedAt: string | null;
  error: string | null;
  /** Aviso rápido (ex.: "PDF baixado"). */
  notice: string | null;
  history: BackupInfo[];
  /** Modo foco: só a folha, sem barras laterais. */
  focusMode: boolean;
  /** Elemento do roteiro a focar (usado pela busca global). */
  pendingFocusElement: string | null;
  /** Histórico de desfazer/refazer do roteiro. */
  spPast: Screenplay[];
  spFuture: Screenplay[];
  spLastSnap: number;

  // ciclo de vida
  init: () => Promise<void>;

  // configuração
  chooseProjectsFolder: () => Promise<void>;
  setTheme: (theme: Theme) => void;
  setPrefs: (patch: Partial<AppPrefs>) => void;

  // projetos
  createNewProject: (input: {
    nome: string;
    autor: string;
    tipo: ProjectType;
    formato: WorkFormat;
    livro?: BookParts;
    modelo?: string;
  }) => Promise<void>;
  openProjectFromPicker: () => Promise<void>;
  openRecent: (recent: RecentProject) => Promise<void>;
  renameRecent: (id: string, nome: string) => Promise<void>;
  deleteRecent: (id: string, deleteFiles: boolean) => Promise<void>;
  closeProject: () => void;

  // navegação dentro do workspace
  setWorkspaceTab: (tab: WorkspaceTab) => void;
  setFocusMode: (on: boolean) => void;

  // séries: episódios
  selectEpisode: (id: string) => Promise<void>;
  addEpisode: (temporada: number, titulo: string) => Promise<void>;
  renameEpisode: (id: string, patch: Partial<Episode>) => void;
  removeEpisode: (id: string) => Promise<void>;

  // backup / histórico
  /** Cria um backup (se algo mudou desde o último). Devolve true se criou. */
  createBackup: (tipo?: BackupKind) => Promise<boolean>;
  refreshHistory: () => Promise<void>;
  restoreBackup: (name: string) => Promise<void>;

  // busca / navegação por elemento
  focusElement: (id: string) => void;
  clearFocusElement: () => void;

  // desfazer / refazer (roteiro)
  undoScreenplay: () => void;
  redoScreenplay: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // edição + autosave
  updateMeta: (patch: Partial<ProjectMeta>) => void;
  updateCover: (cover: Cover) => void;
  updateScreenplay: (screenplay: Screenplay) => void;
  updateCharacters: (characters: Character[]) => void;
  updateLocations: (locations: Location[]) => void;
  updateObjects: (objects: StoryObject[]) => void;
  updateOutline: (outline: Outline) => void;
  updateTemporada: (plan: SeasonPlan) => void;
  updateIdeas: (ideas: Idea[]) => void;
  updateReferences: (references: Reference[]) => void;
  updatePesquisa: (pesquisa: ResearchTree) => void;
  /** Abrir na Pesquisa um quadro/página (e um item dele), vindo de outra aba. */
  researchFocus: { noId: string; itemId?: string } | null;
  openResearch: (noId: string, itemId?: string) => void;
  clearResearchFocus: () => void;

  setError: (msg: string | null) => void;
  setNotice: (msg: string | null) => void;
}

// persistência da configuração
async function loadConfig(): Promise<PersistedConfig> {
  const cfg = (await idbGet(CONFIG_KEY)) as PersistedConfig | undefined;
  return (
    cfg ?? { projectsFolderSet: false, theme: "system", recents: [] }
  );
}

async function persistConfig(state: AppState): Promise<void> {
  const cfg: PersistedConfig = {
    projectsFolderSet: state.projectsFolderSet,
    theme: state.theme,
    recents: state.recents,
    prefs: state.prefs,
  };
  await idbSet(CONFIG_KEY, cfg);
}

// autosave com debounce
// Um timer por tipo de coleção, para não gravar a cada tecla.
const AUTOSAVE_MS = 800;
const timers: Record<string, ReturnType<typeof setTimeout>> = {};
// gravações agendadas que ainda não rodaram (para gravar na hora ao fechar)
const pending: Record<string, () => Promise<void>> = {};
/** Assinatura do último backup de cada projeto/parte (evita backups repetidos). */
const lastBackupSig: Record<string, string> = {};

function scheduleSave(
  key: string,
  run: () => Promise<void>,
  onSaving: (v: boolean) => void,
  onSaved: () => void,
  onError: (msg: string) => void
) {
  onSaving(true);
  clearTimeout(timers[key]);
  const exec = async () => {
    clearTimeout(timers[key]);
    if (pending[key] === exec) delete pending[key];
    try {
      await run();
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };
  pending[key] = exec;
  timers[key] = setTimeout(() => void exec(), AUTOSAVE_MS);
}

/** Há alterações esperando para ser gravadas? */
export function hasPendingSaves(): boolean {
  return Object.keys(pending).length > 0;
}

/** Grava agora tudo o que estava agendado (ex.: antes de fechar o app). */
export async function flushPendingSaves(): Promise<void> {
  await Promise.all(Object.values(pending).map((run) => run()));
}

function sanitizeFolderName(name: string): string {
  // Remove caracteres inválidos para nome de pasta no Windows.
  return name.replace(/[<>:"/\\|?*]/g, "").trim() || tt("Novo Projeto");
}

export const useApp = create<AppState>((set, get) => {
  // Helper genérico de autosave reutilizado por todas as coleções.
  function autosave(collectionKey: string, run: () => Promise<void>) {
    if (get().previewMode) return; // pré-visualização não grava em disco
    scheduleSave(
      collectionKey,
      run,
      (v) => set({ saving: v }),
      () => set({ saving: false, lastSavedAt: new Date().toISOString() }),
      (msg) => set({ saving: false, error: tt("Falha ao salvar: {msg}", { msg }) })
    );
  }

  // Monta o CurrentProject. Para séries, carrega os episódios e o conteúdo do
  // primeiro episódio nos "slots" de screenplay/cover/outline.
  async function hydrate(
    root: ProjectDir,
    project: LoadedProject
  ): Promise<CurrentProject> {
    if (project.meta.formato !== "serie") {
      return { root, project, episodes: [], currentEpisodeId: null };
    }
    let episodes = await loadEpisodes(root, project.meta);
    if (episodes.length === 0) {
      const ep: Episode = { id: newId(), temporada: 1, numero: 1, titulo: "Piloto" };
      await createEpisodeFiles(
        root,
        project.meta,
        ep.id,
        initialCover(project.meta.nome, project.meta.autor)
      );
      await saveEpisodes(root, project.meta, [ep]);
      episodes = [ep];
    }
    const first = episodes[0];
    const content = await loadEpisodeContent(root, project.meta, first.id);
    return {
      root,
      project: { ...project, ...content },
      episodes,
      currentEpisodeId: first.id,
    };
  }

  // No preview, guarda o conteúdo do episódio atual em memória.
  function updatePreviewEp(epId: string | null, patch: Partial<EpisodeContent>) {
    if (!epId) return;
    const prev = get().previewEpisodes[epId];
    if (!prev) return;
    set({
      previewEpisodes: { ...get().previewEpisodes, [epId]: { ...prev, ...patch } },
    });
  }

  function addRecent(project: LoadedProject, handleKey: string) {
    const recent: RecentProject = {
      id: project.meta.id,
      nome: project.meta.nome,
      autor: project.meta.autor,
      tipo: project.meta.tipo,
      handleKey,
      abertoEm: new Date().toISOString(),
    };
    const others = get().recents.filter((r) => r.id !== recent.id);
    const recents = [recent, ...others].slice(0, 12);
    set({ recents });
    void persistConfig(get());
  }

  return {
    ready: false,
    previewMode: false,
    previewEpisodes: {},
    projectsFolderSet: false,
    theme: "system",
    prefs: DEFAULT_PREFS,
    recents: [],
    current: null,
    workspaceTab: "editor",
    saving: false,
    lastSavedAt: null,
    error: null,
    notice: null,
    history: [],
    pendingFocusElement: null,
    focusMode: false,
    spPast: [],
    spFuture: [],
    spLastSnap: 0,

    init: async () => {
      const cfg = await loadConfig();
      set({
        ready: true,
        projectsFolderSet: cfg.projectsFolderSet,
        theme: cfg.theme,
        recents: cfg.recents,
        prefs: { ...DEFAULT_PREFS, ...(cfg.prefs ?? {}) },
      });
    },

    chooseProjectsFolder: async () => {
      try {
        if (!(await askFolderAccess("projetos"))) return;
        const dir = await pickDirectory(tt("Pasta dos projetos"));
        if (!dir) return; // a pessoa cancelou
        const ok = await ensurePermission(dir, true);
        if (!ok) {
          set({ error: tt("Permissão de acesso à pasta negada.") });
          return;
        }
        await saveHandle(PROJECTS_FOLDER_KEY, dir);
        set({ projectsFolderSet: true, error: null });
        await persistConfig(get());
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    setTheme: (theme) => {
      set({ theme });
      void persistConfig(get());
    },

    setPrefs: (patch) => {
      set({ prefs: { ...get().prefs, ...patch } });
      void persistConfig(get());
    },

    createNewProject: async ({ nome, autor, tipo, formato, livro, modelo }) => {
      try {
        const folder = await loadHandle(PROJECTS_FOLDER_KEY);
        if (!folder) {
          set({ error: tt("Pasta de projetos não configurada.") });
          return;
        }
        const ok = await ensurePermission(folder, true);
        if (!ok) {
          set({ error: tt("Permissão de acesso à pasta de projetos negada.") });
          return;
        }

        const folderName = sanitizeFolderName(nome);
        const root = await childDir(folder, folderName, true);

        const project = await createProject(root, {
          nome,
          autor,
          tipo,
          formato,
          livro,
          modelo,
        });

        // Guarda o handle desta pasta para reabrir depois.
        const handleKey = makeHandleKey(project.meta.id);
        await saveHandle(handleKey, root);

        const cur = await hydrate(root, project);
        set({
          current: cur,
          workspaceTab: "editor",
          error: null,
          spPast: [],
          spFuture: [],
          spLastSnap: 0,
        });
        addRecent(project, handleKey);
        void get().refreshHistory();
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    openProjectFromPicker: async () => {
      try {
        if (!(await askFolderAccess("projeto"))) return;
        const root = await pickDirectory(tt("Abrir projeto"));
        if (!root) return; // a pessoa cancelou
        const ok = await ensurePermission(root, true);
        if (!ok) {
          set({ error: tt("Permissão de acesso à pasta negada.") });
          return;
        }
        const project = await loadProject(root);
        const handleKey = makeHandleKey(project.meta.id);
        await saveHandle(handleKey, root);
        const cur = await hydrate(root, project);
        set({
          current: cur,
          workspaceTab: "editor",
          error: null,
          spPast: [],
          spFuture: [],
          spLastSnap: 0,
        });
        addRecent(project, handleKey);
        void get().createBackup("abrir");
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    openRecent: async (recent) => {
      try {
        const root = await loadHandle(recent.handleKey);
        if (!root) {
          set({ error: tt("Não foi possível localizar a pasta deste projeto.") });
          return;
        }
        // navegador: a permissão vale só por sessão; avisa antes do pedido nativo
        if (!(await ensurePermission(root, false))) {
          const ok = await confirmDialog({
            title: tt("Liberar a pasta de \"{nome}\"?", { nome: recent.nome }),
            message: tt("O navegador pede para confirmar o acesso à pasta do projeto a cada vez que ele é aberto."),
            confirmLabel: tt("Liberar e abrir"),
            icon: "folderOpen",
          });
          if (!ok || !(await ensurePermission(root, true))) {
            set({ error: tt("Sem permissão para acessar a pasta do projeto.") });
            return;
          }
        }
        const project = await loadProject(root);
        const cur = await hydrate(root, project);
        set({
          current: cur,
          workspaceTab: "editor",
          error: null,
          spPast: [],
          spFuture: [],
          spLastSnap: 0,
        });
        addRecent(project, recent.handleKey);
        void get().createBackup("abrir");
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    renameRecent: async (id, nome) => {
      const nomeTrim = nome.trim();
      if (!nomeTrim) return;
      // Atualiza a lista de recentes.
      set({
        recents: get().recents.map((r) =>
          r.id === id ? { ...r, nome: nomeTrim } : r
        ),
      });
      void persistConfig(get());
      // Se estiver aberto, atualiza o meta em memória (e o autosave grava).
      const cur = get().current;
      if (cur && cur.project.meta.id === id) {
        get().updateMeta({ nome: nomeTrim });
        return;
      }
      // Senão, atualiza o meta.json no disco.
      const rec = get().recents.find((r) => r.id === id);
      if (!rec) return;
      try {
        const root = await loadHandle(rec.handleKey);
        if (!root) return;
        if (!(await ensurePermission(root, true))) return;
        const project = await loadProject(root);
        await saveMeta(root, { ...project.meta, nome: nomeTrim });
      } catch {
        // sem acesso ao disco: a lista de recentes já foi renomeada
      }
    },

    deleteRecent: async (id, deleteFiles) => {
      const rec = get().recents.find((r) => r.id === id);
      set({ recents: get().recents.filter((r) => r.id !== id) });
      void persistConfig(get());
      if (!deleteFiles || !rec) return;
      // Só apaga do disco se a pasta estiver DENTRO da pasta de projetos e for
      // exatamente este projeto (evita apagar outra pasta de mesmo nome).
      try {
        const parent = await loadHandle(PROJECTS_FOLDER_KEY);
        const root = await loadHandle(rec.handleKey);
        if (!parent || !root) return;
        if (!(await ensurePermission(parent, true))) return;
        const candidate = await childDir(parent, root.name, false);
        if (await sameDir(root, candidate)) {
          await removeChildDir(parent, root.name);
        }
      } catch {
        // pasta fora da pasta de projetos ou já removida: só sai dos recentes
      }
    },

    closeProject: () =>
      set({ current: null, history: [], spPast: [], spFuture: [], focusMode: false }),

    setWorkspaceTab: (tab) => set({ workspaceTab: tab }),
    setFocusMode: (on) => set({ focusMode: on }),

    selectEpisode: async (id) => {
      const cur = get().current;
      if (!cur || id === cur.currentEpisodeId) return;
      // grava o que ainda está pendente da parte atual antes de trocar
      // (os salvamentos agendados usam a mesma chave para todas as partes)
      await flushPendingSaves();
      let content: EpisodeContent;
      if (get().previewMode) {
        content =
          get().previewEpisodes[id] ?? {
            screenplay: emptyScreenplayContent(),
            cover: initialCover(cur.project.meta.nome, cur.project.meta.autor),
            outline: { atos: [], cartoes: [] },
          };
      } else {
        content = await loadEpisodeContent(cur.root, cur.project.meta, id);
      }
      set({
        current: { ...cur, currentEpisodeId: id, project: { ...cur.project, ...content } },
        spPast: [],
        spFuture: [],
        spLastSnap: 0,
      });
    },

    addEpisode: async (temporada, titulo) => {
      const cur = get().current;
      if (!cur) return;
      const nums = cur.episodes
        .filter((e) => e.temporada === temporada)
        .map((e) => e.numero);
      const numero = (nums.length ? Math.max(...nums) : 0) + 1;
      const ep: Episode = {
        id: newId(),
        temporada,
        numero,
        titulo: titulo.trim() || (cur.project.meta.tipo === "roteiro" ? tt("Episódio {n}", { n: numero }) : tt("Capítulo {n}", { n: numero })),
      };
      const episodes = [...cur.episodes, ep].sort(
        (a, b) => a.temporada - b.temporada || a.numero - b.numero
      );
      const cover = initialCover(cur.project.meta.nome, cur.project.meta.autor);
      if (get().previewMode) {
        set({
          previewEpisodes: {
            ...get().previewEpisodes,
            [ep.id]: {
              screenplay: emptyScreenplayContent(),
              cover,
              outline: { atos: [], cartoes: [] },
            },
          },
        });
      } else {
        try {
          await createEpisodeFiles(cur.root, cur.project.meta, ep.id, cover);
          await saveEpisodes(cur.root, cur.project.meta, episodes);
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err) });
          return;
        }
      }
      set({ current: { ...get().current!, episodes } });
      await get().selectEpisode(ep.id);
    },

    renameEpisode: (id, patch) => {
      const cur = get().current;
      if (!cur) return;
      const episodes = cur.episodes
        .map((e) => (e.id === id ? { ...e, ...patch } : e))
        .sort((a, b) => a.temporada - b.temporada || a.numero - b.numero);
      set({ current: { ...cur, episodes } });
      if (!get().previewMode) {
        autosave("episodes", () => saveEpisodes(cur.root, cur.project.meta, episodes));
      }
    },

    removeEpisode: async (id) => {
      const cur = get().current;
      if (!cur || cur.episodes.length <= 1) return;
      const episodes = cur.episodes.filter((e) => e.id !== id);
      if (get().previewMode) {
        const pe = { ...get().previewEpisodes };
        delete pe[id];
        set({ previewEpisodes: pe });
      } else {
        try {
          await saveEpisodes(cur.root, cur.project.meta, episodes);
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err) });
          return;
        }
      }
      set({ current: { ...get().current!, episodes } });
      if (cur.currentEpisodeId === id) {
        await get().selectEpisode(episodes[0].id);
      }
    },

    createBackup: async (tipo = "auto") => {
      const cur = get().current;
      if (!cur || get().previewMode) return false;
      try {
        // não guarda dois backups iguais seguidos da mesma parte
        const ep = cur.currentEpisodeId;
        const sig = projectSig(cur.project);
        const key = `${cur.project.meta.id}:${ep ?? ""}`;
        if (lastBackupSig[key] === sig && tipo !== "restaurar" && tipo !== "importar") return false;
        await writeBackup(cur.root, cur.project, tipo, ep);
        lastBackupSig[key] = sig;
        await get().refreshHistory();
        return true;
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
        return false;
      }
    },

    refreshHistory: async () => {
      const cur = get().current;
      if (!cur || get().previewMode) {
        set({ history: [] });
        return;
      }
      try {
        set({ history: await listBackups(cur.root) });
      } catch {
        set({ history: [] });
      }
    },

    restoreBackup: async (name) => {
      if (!get().current || get().previewMode) return;
      try {
        // o que estava agendado para gravar vai antes, senão sobrescreveria a versão restaurada
        await flushPendingSaves();
        const snap = await readBackup(get().current!.root, name);
        if (!snap) {
          set({ error: tt("Backup não encontrado.") });
          return;
        }
        // backup de outra parte (episódio/capítulo): abre essa parte primeiro
        const epAlvo = snap.episodioId ?? null;
        if (epAlvo && epAlvo !== get().current!.currentEpisodeId && get().current!.episodes.some((e) => e.id === epAlvo)) {
          await get().selectEpisode(epAlvo);
        }
        // Antes de restaurar, salva um backup do estado atual (segurança).
        await get().createBackup("restaurar");
        const cur = get().current!;
        // backups antigos não têm ideias/pesquisa: mantém as atuais
        const project = {
          ...snap.project,
          ideas: snap.project.ideas ?? cur.project.ideas,
          references: snap.project.references ?? cur.project.references,
          pesquisa: snap.project.pesquisa ?? cur.project.pesquisa,
          temporada: snap.project.temporada ?? cur.project.temporada,
        };
        await saveAll(cur.root, project, cur.currentEpisodeId);
        set({
          current: { ...cur, project },
          spPast: [],
          spFuture: [],
          spLastSnap: 0,
          notice: tt("Versão de {data} restaurada.", { data: new Date(snap.criadoEm).toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" }) }),
        });
        lastBackupSig[`${project.meta.id}:${cur.currentEpisodeId ?? ""}`] = projectSig(project);
        await get().refreshHistory();
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    focusElement: (id) =>
      set({ workspaceTab: "editor", pendingFocusElement: id }),
    clearFocusElement: () => set({ pendingFocusElement: null }),

    updateMeta: (patch) => {
      const cur = get().current;
      if (!cur) return;
      const meta = { ...cur.project.meta, ...patch };
      const project = { ...cur.project, meta };
      set({ current: { ...cur, project } });
      autosave("meta", () => saveMeta(cur.root, meta));
    },

    updateCover: (cover) => {
      const cur = get().current;
      if (!cur) return;
      const project = { ...cur.project, cover };
      set({ current: { ...cur, project } });
      autosave("cover", () =>
        saveContent(cur.root, cur.project.meta, cur.currentEpisodeId, "cover", cover)
      );
      updatePreviewEp(cur.currentEpisodeId, { cover });
    },

    updateScreenplay: (screenplay) => {
      const cur = get().current;
      if (!cur) return;
      // Registra o estado anterior para desfazer, agrupando digitação rápida
      // (só cria um novo ponto de undo a cada ~500ms).
      const prev = cur.project.screenplay;
      const now = Date.now();
      const past =
        now - get().spLastSnap > 500
          ? [...get().spPast, prev].slice(-120)
          : get().spPast;
      const project = { ...cur.project, screenplay };
      set({
        current: { ...cur, project },
        spPast: past,
        spFuture: [],
        spLastSnap: now,
      });
      autosave("screenplay", () =>
        saveContent(cur.root, cur.project.meta, cur.currentEpisodeId, "screenplay", screenplay)
      );
      updatePreviewEp(cur.currentEpisodeId, { screenplay });
    },

    undoScreenplay: () => {
      const cur = get().current;
      const past = get().spPast;
      if (!cur || past.length === 0) return;
      const prev = past[past.length - 1];
      const project = { ...cur.project, screenplay: prev };
      set({
        current: { ...cur, project },
        spPast: past.slice(0, -1),
        spFuture: [cur.project.screenplay, ...get().spFuture].slice(0, 120),
        spLastSnap: 0,
      });
      autosave("screenplay", () =>
        saveContent(cur.root, cur.project.meta, cur.currentEpisodeId, "screenplay", prev)
      );
      updatePreviewEp(cur.currentEpisodeId, { screenplay: prev });
    },

    redoScreenplay: () => {
      const cur = get().current;
      const future = get().spFuture;
      if (!cur || future.length === 0) return;
      const next = future[0];
      const project = { ...cur.project, screenplay: next };
      set({
        current: { ...cur, project },
        spFuture: future.slice(1),
        spPast: [...get().spPast, cur.project.screenplay].slice(-120),
        spLastSnap: 0,
      });
      autosave("screenplay", () =>
        saveContent(cur.root, cur.project.meta, cur.currentEpisodeId, "screenplay", next)
      );
      updatePreviewEp(cur.currentEpisodeId, { screenplay: next });
    },

    canUndo: () => get().spPast.length > 0,
    canRedo: () => get().spFuture.length > 0,

    updateCharacters: (characters) => {
      const cur = get().current;
      if (!cur) return;
      const project = { ...cur.project, characters };
      set({ current: { ...cur, project } });
      autosave("characters", () => saveCharacters(cur.root, characters));
    },

    updateLocations: (locations) => {
      const cur = get().current;
      if (!cur) return;
      const project = { ...cur.project, locations };
      set({ current: { ...cur, project } });
      autosave("locations", () => saveLocations(cur.root, locations));
    },

    updateObjects: (objects) => {
      const cur = get().current;
      if (!cur) return;
      const project = { ...cur.project, objects };
      set({ current: { ...cur, project } });
      autosave("objects", () => saveObjects(cur.root, objects));
    },

    updateTemporada: (temporada) => {
      const cur = get().current;
      if (!cur) return;
      set({ current: { ...cur, project: { ...cur.project, temporada } } });
      autosave("temporada", () => saveSeason(cur.root, cur.project.meta, temporada));
    },

    updateOutline: (outline) => {
      const cur = get().current;
      if (!cur) return;
      const project = { ...cur.project, outline };
      set({ current: { ...cur, project } });
      autosave("outline", () =>
        saveContent(cur.root, cur.project.meta, cur.currentEpisodeId, "outline", outline)
      );
      updatePreviewEp(cur.currentEpisodeId, { outline });
    },

    updateIdeas: (ideas) => {
      const cur = get().current;
      if (!cur) return;
      const project = { ...cur.project, ideas };
      set({ current: { ...cur, project } });
      autosave("ideas", () => saveIdeas(cur.root, ideas));
    },

    updateReferences: (references) => {
      const cur = get().current;
      if (!cur) return;
      set({ current: { ...cur, project: { ...cur.project, references } } });
      autosave("references", () => saveReferences(cur.root, references));
    },

    updatePesquisa: (pesquisa) => {
      const cur = get().current;
      if (!cur) return;
      set({ current: { ...cur, project: { ...cur.project, pesquisa } } });
      autosave("pesquisa", () => saveResearch(cur.root, pesquisa));
    },

    researchFocus: null,
    openResearch: (noId, itemId) => set({ workspaceTab: "pesquisa", researchFocus: { noId, itemId } }),
    clearResearchFocus: () => set({ researchFocus: null }),

    setError: (msg) => set({ error: msg }),
    setNotice: (msg) => set({ notice: msg }),
  };
});

export { newId };
