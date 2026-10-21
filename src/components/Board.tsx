// Quadro livre da Pesquisa: notas, imagens, links e arquivos numa área infinita, ligados por setas.

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/appStore";
import { Board, BoardItem, RefLink, Reference } from "@/types";
import { newId } from "@/domain/project";
import { emptyCard, renumber } from "@/domain/outline";
import { Icon } from "@/components/Icon";
import { Picker } from "@/components/Picker";
import { LinkChips } from "@/components/LinkChips";
import { attachmentSize, loadProjectImage, startAttachment, useAttachmentSaving, useProjectImageUrl } from "@/storage/images";
import { isNative, openLink, openWithSystem } from "@/storage/dir";
import type { ProjectDir } from "@/storage/fs";
import type { LinkTarget } from "@/views/tabs/ResearchTab";
import { tt } from "@/i18n";

type IconName = Parameters<typeof Icon>[0]["name"];

const CORES = [
  { id: "amarelo", label: tt("Amarelo") },
  { id: "rosa", label: tt("Rosa") },
  { id: "azul", label: tt("Azul") },
  { id: "verde", label: tt("Verde") },
  { id: "lilas", label: tt("Lilás") },
  { id: "papel", label: tt("Branco") },
];

const ELEMENT_ICON: Record<string, IconName> = {
  personagem: "user",
  local: "mapPin",
  objeto: "box",
  secao: "penLine",
  ideia: "lightbulb",
  obra: "book",
};

const TAB_OF: Record<string, string> = {
  personagem: "personagens",
  local: "locais",
  objeto: "objetos",
  ideia: "ideias",
};

/** Marca dos itens copiados de um quadro (na área de transferência do sistema). */
const CLIP = "opencena-quadro:";
let clipboardInterno: { itens: BoardItem[]; refs: Reference[] } | null = null;

/** Prende o ponteiro no elemento durante o arraste (ignora se o ponteiro já sumiu). */
function capturar(e: React.PointerEvent) {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* ponteiro sintético ou já solto */
  }
}

const isUrl = (t: string) => /^(https?:\/\/|www\.)\S+$/i.test(t);

function extOf(nome?: string) {
  const m = nome?.match(/\.([a-z0-9]{1,5})$/i);
  return m ? m[1].toLowerCase() : "";
}

function fileKind(ext: string): string {
  if (ext === "pdf") return "pdf";
  if (["doc", "docx", "odt", "rtf", "txt", "md", "pages"].includes(ext)) return "doc";
  if (["xls", "xlsx", "ods", "csv", "numbers"].includes(ext)) return "planilha";
  if (["ppt", "pptx", "odp", "key"].includes(ext)) return "apresentacao";
  if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) return "audio";
  if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) return "video";
  if (["zip", "rar", "7z"].includes(ext)) return "zip";
  return "outro";
}

function fmtSize(n: number | null) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

const hostOf = (u: string) => u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");

// corpo de cada tipo de referência
function NoteImage({ root, arquivo }: { root: ProjectDir | null; arquivo: string }) {
  const url = useProjectImageUrl(root, arquivo);
  const salvando = useAttachmentSaving(arquivo);
  return (
    <div className="bd-note-img">
      {url && <img src={url} alt="" draggable={false} />}
      {salvando && (
        <span className="bd-saving">
          <span className="spin" />
          {tt("Colando…")}
        </span>
      )}
    </div>
  );
}

function ImageBody({ r, root, selected }: { r: Reference; root: ProjectDir | null; selected: boolean }) {
  const url = useProjectImageUrl(root, r.arquivo);
  const salvando = useAttachmentSaving(r.arquivo);
  return (
    <div className="bd-image">
      {url ? <img src={url} alt={r.titulo} draggable={false} /> : <div className="bd-image-empty" />}
      {salvando && (
        <span className="bd-saving">
          <span className="spin" />
          {tt("Colando…")}
        </span>
      )}
      {(r.titulo || selected) && r.titulo && <span className="bd-caption">{r.titulo}</span>}
    </div>
  );
}

function LinkBody({ r, editing, onEdit }: { r: Reference; editing: boolean; onEdit: (p: Partial<Reference>) => void }) {
  if (editing) {
    return (
      <div className="bd-linkedit" onPointerDown={(e) => e.stopPropagation()}>
        <input autoFocus value={r.url ?? ""} placeholder={tt("https://")} onChange={(e) => onEdit({ url: e.target.value })} />
        <input value={r.titulo} placeholder={tt("Texto do link (opcional)")} onChange={(e) => onEdit({ titulo: e.target.value })} />
      </div>
    );
  }
  return (
    <a
      className="bd-linktext"
      href={r.url}
      title={`${r.url}\n${tt("Ctrl + clique ou o botão Abrir para abrir")}`}
      onClick={(e) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) void openLink(r.url ?? "");
      }}
      draggable={false}
    >
      <Icon name="link" size={13} />
      <span>{r.titulo || hostOf(r.url ?? "") || tt("link")}</span>
    </a>
  );
}

function FileBody({ r }: { r: Reference }) {
  const ext = extOf(r.arquivoNome);
  const salvando = useAttachmentSaving(r.arquivo);
  const nome = (r.titulo || r.arquivoNome || "arquivo").replace(new RegExp(`\\.${ext}$`, "i"), "");
  return (
    <div className="bd-file">
      <span className={`bd-file-badge fk-${fileKind(ext)}`}>{ext ? ext.toUpperCase().slice(0, 4) : tt("ARQ")}</span>
      <span className="bd-file-info">
        <span className="bd-file-name">{nome}</span>
        <span className="bd-file-meta">{salvando ? tt("Salvando…") : [ext.toUpperCase(), fmtSize(attachmentSize(r.arquivo))].filter(Boolean).join(" · ")}</span>
      </span>
    </div>
  );
}

export function BoardView({
  board,
  onChange,
  targets,
  root,
  focusItem,
}: {
  board: Board;
  onChange: (b: Board) => void;
  targets: LinkTarget[];
  root: ProjectDir | null;
  focusItem?: string | null;
}) {
  const setTab = useApp((s) => s.setWorkspaceTab);
  const focusElement = useApp((s) => s.focusElement);
  const refs = useApp((s) => s.current!.project.references ?? []);
  const cartoes = useApp((s) => s.current!.project.outline.cartoes);
  const cartoesIds = useMemo(() => new Set(cartoes.map((c) => c.id)), [cartoes]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState(board.vista);
  const [sel, setSel] = useState<string[]>([]);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [conectar, setConectar] = useState<null | { de: string | null }>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const boardRef = useRef(board);
  boardRef.current = board;
  const vistaRef = useRef(vista);
  vistaRef.current = vista;
  const refMap = useMemo(() => new Map(refs.map((r) => [r.id, r])), [refs]);

  // a posição/zoom da área é gravada um pouco depois de parar de mexer
  useEffect(() => {
    const t = setTimeout(() => {
      const v = boardRef.current.vista;
      if (v.x !== vista.x || v.y !== vista.y || v.zoom !== vista.zoom) onChange({ ...boardRef.current, vista });
    }, 500);
    return () => clearTimeout(t);
  }, [vista]); // eslint-disable-line react-hooks/exhaustive-deps

  // referências (ficam na lista do projeto; os itens do quadro apontam para elas)
  function addRefs(novas: Reference[]) {
    const st = useApp.getState();
    st.updateReferences([...novas, ...(st.current?.project.references ?? [])]);
  }
  function patchRef(id: string, p: Partial<Reference>) {
    const st = useApp.getState();
    st.updateReferences((st.current?.project.references ?? []).map((r) => (r.id === id ? { ...r, ...p } : r)));
  }
  const newRef = (r: Partial<Reference> & { tipo: Reference["tipo"] }): Reference => ({
    id: newId(),
    titulo: "",
    notas: "",
    vinculos: [],
    criadaEm: new Date().toISOString(),
    ...r,
  });

  // coordenadas
  const toWorld = (cx: number, cy: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    const v = vistaRef.current;
    return { x: (cx - r.left - v.x) / v.zoom, y: (cy - r.top - v.y) / v.zoom };
  };
  const viewCenter = () => {
    const r = wrapRef.current!.getBoundingClientRect();
    // área ainda sem tamanho (acabou de abrir): usa um ponto razoável
    if (r.width < 10) return { x: 400, y: 300 };
    return toWorld(r.left + r.width / 2, r.top + r.height / 2);
  };
  /** Posição livre perto de (x, y): não empilha exatamente em cima de outro item. */
  function livre(x: number, y: number, extra: BoardItem[] = []) {
    const todos = [...boardRef.current.itens, ...extra];
    while (todos.some((o) => Math.abs(o.x - x) < 8 && Math.abs(o.y - y) < 8)) {
      x += 28;
      y += 28;
    }
    return { x: Math.round(x), y: Math.round(y) };
  }

  function commit(itens: BoardItem[], extra?: Partial<Board>) {
    onChange({ ...boardRef.current, itens, vista: vistaRef.current, ...extra });
  }
  function patchItem(id: string, p: Partial<BoardItem>) {
    commit(boardRef.current.itens.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }
  function addItems(novos: BoardItem[], selecionar = true) {
    commit([...boardRef.current.itens, ...novos]);
    if (selecionar) setSel(novos.map((n) => n.id));
  }
  function addItem(it: Omit<BoardItem, "id" | "x" | "y"> & { x?: number; y?: number }) {
    const c = viewCenter();
    const p = livre((it.x ?? c.x) - it.w / 2, (it.y ?? c.y) - it.h / 2);
    const item = { ...it, id: newId(), ...p } as BoardItem;
    addItems([item]);
    if (it.tipo === "nota" || it.tipo === "texto") setEditando(item.id);
    return item;
  }

  // arquivos, imagens, links e texto que chegam por colar ou arrastar
  /** Itens aparecem na hora; o arquivo é gravado no disco em segundo plano. */
  function receberArquivos(files: File[], at?: { x: number; y: number }) {
    const base = at ?? viewCenter();
    const novasRefs: Reference[] = [];
    const novos: BoardItem[] = [];
    files.forEach((f, k) => {
      const img = f.type.startsWith("image/");
      const colada = img && /^image\.\w+$/i.test(f.name);
      const d = new Date();
      const p2 = (n: number) => String(n).padStart(2, "0");
      const quando = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
      const nome = colada ? `imagem-colada-${quando}${k ? `-${k}` : ""}.${f.type.split("/")[1] || "png"}` : f.name;
      const { arquivo, gravado } = startAttachment(root, f, nome);
      const r = newRef({ tipo: img ? "imagem" : "documento", arquivo, arquivoNome: nome, titulo: img ? "" : nome });
      novasRefs.push(r);
      const w = img ? 300 : 250;
      const h = img ? 200 : 64;
      const p = livre(base.x - w / 2 + k * 30, base.y - h / 2 + k * 30, novos);
      const item: BoardItem = { id: newId(), tipo: "referencia", refId: r.id, ...p, w, h };
      novos.push(item);
      gravado.catch((err) => useApp.getState().setError(tt("Não foi possível salvar {nome}: {erro}", { nome, erro: err instanceof Error ? err.message : String(err) })));
      // ajusta a altura à proporção da imagem
      if (img) {
        void createImageBitmap(f)
          .then((bmp) => {
            const nw = Math.min(360, bmp.width);
            const nh = Math.round((nw * bmp.height) / bmp.width);
            bmp.close();
            const atual = boardRef.current.itens.find((i) => i.id === item.id);
            if (atual && atual.w === w && atual.h === h) patchItem(item.id, { w: nw, h: nh });
          })
          .catch(() => {});
      }
    });
    addRefs(novasRefs);
    addItems(novos);
  }

  /** Coloca a imagem dentro da nota (acima do texto) e aumenta a nota. */
  function imagemNaNota(nota: BoardItem, f: File) {
    const { arquivo } = startAttachment(root, f, /^image\.\w+$/i.test(f.name) ? `nota.${f.type.split("/")[1] || "png"}` : f.name);
    patchItem(nota.id, { imagem: arquivo, h: Math.max(nota.h, 260), w: Math.max(nota.w, 220) });
  }

  function receberLink(url: string, at?: { x: number; y: number }) {
    const href = /^www\./i.test(url) ? `https://${url}` : url;
    const r = newRef({ tipo: "link", url: href });
    addRefs([r]);
    const c = at ?? viewCenter();
    const p = livre(c.x - 120, c.y - 18);
    addItems([{ id: newId(), tipo: "referencia", refId: r.id, ...p, w: 240, h: 36 }]);
  }

  function receberTexto(t: string, at?: { x: number; y: number }) {
    const c = at ?? viewCenter();
    const w = Math.min(320, Math.max(200, t.length * 2));
    const h = Math.min(320, 70 + Math.ceil(t.length / 34) * 20);
    const p = livre(c.x - w / 2, c.y - h / 2);
    addItems([{ id: newId(), tipo: "nota", texto: t, cor: "amarelo", ...p, w, h }]);
  }

  // copiar, recortar, colar, duplicar
  function copiar(cortar = false) {
    const itens = boardRef.current.itens.filter((i) => sel.includes(i.id));
    if (!itens.length) return false;
    const rs = itens.map((i) => (i.refId ? refMap.get(i.refId) : undefined)).filter((r): r is Reference => !!r);
    clipboardInterno = { itens, refs: rs };
    void navigator.clipboard?.writeText(`${CLIP}${itens.length}`).catch(() => {});
    if (cortar) apagarSelecao();
    return true;
  }

  function colarItens(dados: { itens: BoardItem[]; refs: Reference[] }) {
    const ids = new Map<string, string>();
    const refIds = new Map<string, string>();
    const novasRefs = dados.refs.map((r) => {
      const id = newId();
      refIds.set(r.id, id);
      return { ...r, id, vinculos: [...r.vinculos], criadaEm: new Date().toISOString() };
    });
    const novos = dados.itens.map((i) => {
      const id = newId();
      ids.set(i.id, id);
      return { ...i, id, x: i.x + 28, y: i.y + 28, refId: i.refId ? refIds.get(i.refId) ?? i.refId : undefined };
    });
    // ligações entre itens copiados também vêm junto
    const lig = boardRef.current.ligacoes
      .filter((l) => ids.has(l.de) && ids.has(l.para))
      .map((l) => ({ id: newId(), de: ids.get(l.de)!, para: ids.get(l.para)! }));
    if (novasRefs.length) addRefs(novasRefs);
    commit([...boardRef.current.itens, ...novos], { ligacoes: [...boardRef.current.ligacoes, ...lig] });
    setSel(novos.map((n) => n.id));
    clipboardInterno = { itens: novos, refs: novasRefs };
  }

  function apagarSelecao() {
    const b = boardRef.current;
    if (selEdge) {
      onChange({ ...b, vista: vistaRef.current, ligacoes: b.ligacoes.filter((l) => l.id !== selEdge) });
      setSelEdge(null);
      return;
    }
    if (!sel.length) return;
    const fora = new Set(sel);
    commit(
      b.itens.filter((i) => !fora.has(i.id)),
      { ligacoes: b.ligacoes.filter((l) => !fora.has(l.de) && !fora.has(l.para)) }
    );
    setSel([]);
  }

  // colar (Ctrl+V): itens copiados, arquivos/imagens, link ou texto
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const texto = e.clipboardData?.getData("text/plain") ?? "";
      if (texto.startsWith(CLIP) && clipboardInterno) {
        e.preventDefault();
        colarItens(clipboardInterno);
        return;
      }
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        // com uma nota selecionada, a imagem entra na nota
        const alvo = sel.length === 1 ? boardRef.current.itens.find((i) => i.id === sel[0]) : undefined;
        if (alvo?.tipo === "nota" && files[0].type.startsWith("image/")) imagemNaNota(alvo, files[0]);
        else receberArquivos(files);
        return;
      }
      const limpo = texto.trim();
      if (!limpo) return;
      e.preventDefault();
      if (isUrl(limpo)) receberLink(limpo);
      else receberTexto(limpo);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  // teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (document.querySelector(".dlg-overlay, .modal-overlay, .sp-overlay")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if ((e.key === "Delete" || e.key === "Backspace") && (sel.length || selEdge)) {
        e.preventDefault();
        apagarSelecao();
      } else if (e.key === "Escape") {
        setConectar(null);
        setSel([]);
        setSelEdge(null);
      } else if (mod && k === "c" && sel.length) {
        if (copiar()) e.preventDefault();
      } else if (mod && k === "x" && sel.length) {
        if (copiar(true)) e.preventDefault();
      } else if (mod && k === "d" && sel.length) {
        e.preventDefault();
        copiar();
        if (clipboardInterno) colarItens(clipboardInterno);
      } else if (mod && k === "a") {
        e.preventDefault();
        setSel(boardRef.current.itens.map((i) => i.id));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // roda: move a área; Ctrl + roda: zoom no ponto do cursor
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if ((e.target as HTMLElement).closest("textarea, .bd-scroll")) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el!.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        setVista((v) => {
          const z = Math.max(0.2, Math.min(3, v.zoom * Math.exp(-e.deltaY * 0.0022)));
          return { zoom: z, x: mx - ((mx - v.x) / v.zoom) * z, y: my - ((my - v.y) / v.zoom) * z };
        });
      } else {
        setVista((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // item pedido de outra aba (ex.: ficha do personagem): centraliza e seleciona
  useEffect(() => {
    if (!focusItem) return;
    const it = boardRef.current.itens.find((i) => i.id === focusItem);
    const el = wrapRef.current;
    if (!it || !el) return;
    const r = el.getBoundingClientRect();
    const z = Math.max(0.6, vistaRef.current.zoom);
    setVista({ zoom: z, x: r.width / 2 - (it.x + it.w / 2) * z, y: r.height / 2 - (it.y + it.h / 2) * z });
    setSel([it.id]);
  }, [focusItem]);

  // arrastar: fundo (mover área), item (mover a seleção), canto (redimensionar)
  const drag = useRef<
    | { kind: "pan"; sx: number; sy: number; vx: number; vy: number }
    | { kind: "move"; sx: number; sy: number; orig: Map<string, { x: number; y: number }> }
    | { kind: "resize"; id: string; sx: number; sy: number; ow: number; oh: number; ratio: number | null }
    | null
  >(null);

  function onPointerDownBg(e: React.PointerEvent) {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains("bd-layer")) return;
    setSel([]);
    setSelEdge(null);
    setEditando(null);
    capturar(e);
    drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: vista.x, vy: vista.y };
  }

  function startItem(e: React.PointerEvent, it: BoardItem, kind: "move" | "resize") {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (conectar) {
      if (!conectar.de) setConectar({ de: it.id });
      else if (conectar.de !== it.id) {
        const b = boardRef.current;
        const existe = b.ligacoes.some((l) => (l.de === conectar.de && l.para === it.id) || (l.de === it.id && l.para === conectar.de));
        if (!existe) onChange({ ...b, vista, ligacoes: [...b.ligacoes, { id: newId(), de: conectar.de, para: it.id }] });
        setConectar({ de: null });
      }
      return;
    }
    setSelEdge(null);
    let atual = sel;
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      atual = sel.includes(it.id) ? sel.filter((x) => x !== it.id) : [...sel, it.id];
      setSel(atual);
      return;
    }
    if (!sel.includes(it.id)) {
      atual = [it.id];
      setSel(atual);
    }
    if (editando === it.id && kind === "move") return;
    capturar(e);
    if (kind === "resize") {
      const ref = it.refId ? refMap.get(it.refId) : undefined;
      drag.current = { kind, id: it.id, sx: e.clientX, sy: e.clientY, ow: it.w, oh: it.h, ratio: ref?.tipo === "imagem" ? it.w / it.h : null };
    } else {
      const orig = new Map(boardRef.current.itens.filter((i) => atual.includes(i.id)).map((i) => [i.id, { x: i.x, y: i.y }]));
      drag.current = { kind, sx: e.clientX, sy: e.clientY, orig };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pan") {
      setVista((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
      return;
    }
    const dx = (e.clientX - d.sx) / vista.zoom;
    const dy = (e.clientY - d.sy) / vista.zoom;
    if (d.kind === "move") {
      commit(
        boardRef.current.itens.map((i) => {
          const o = d.orig.get(i.id);
          return o ? { ...i, x: Math.round(o.x + dx), y: Math.round(o.y + dy) } : i;
        })
      );
    } else {
      const w = Math.max(80, Math.round(d.ow + dx));
      // imagens mantêm a proporção
      const h = d.ratio ? Math.round(w / d.ratio) : Math.max(32, Math.round(d.oh + dy));
      patchItem(d.id, { w, h });
    }
  }
  function onPointerUp() {
    drag.current = null;
  }

  function centralizar() {
    const its = board.itens;
    const r = wrapRef.current!.getBoundingClientRect();
    if (!its.length) {
      setVista({ x: r.width / 2, y: r.height / 2, zoom: 1 });
      return;
    }
    const minX = Math.min(...its.map((i) => i.x));
    const minY = Math.min(...its.map((i) => i.y));
    const maxX = Math.max(...its.map((i) => i.x + i.w));
    const maxY = Math.max(...its.map((i) => i.y + i.h));
    const z = Math.max(0.2, Math.min(1.2, Math.min((r.width - 80) / (maxX - minX), (r.height - 80) / (maxY - minY))));
    setVista({ zoom: z, x: r.width / 2 - ((minX + maxX) / 2) * z, y: r.height / 2 - ((minY + maxY) / 2) * z });
  }

  async function abrirArquivo(r: Reference) {
    if (!r.arquivo) return;
    const win = isNative || r.tipo !== "documento" ? null : window.open("", "_blank");
    const blob = await loadProjectImage(root, r.arquivo);
    if (blob) await openWithSystem(r.arquivoNome || "arquivo", blob, win);
    else win?.close();
  }

  const center = (it: BoardItem) => ({ x: it.x + it.w / 2, y: it.y + it.h / 2 });
  /** Ponto na borda de `it` na direção (dx, dy) a partir do centro, afastado `gap` px. */
  const border = (it: BoardItem, dx: number, dy: number, gap: number) => {
    const c = center(it);
    const tx = dx === 0 ? Infinity : (it.w / 2 + gap) / Math.abs(dx);
    const ty = dy === 0 ? Infinity : (it.h / 2 + gap) / Math.abs(dy);
    const t = Math.min(tx, ty, 1);
    return { x: c.x + dx * t, y: c.y + dy * t };
  };
  const byId = new Map(board.itens.map((i) => [i.id, i]));
  const unico = sel.length === 1 ? byId.get(sel[0]) : undefined;
  const unicoRef = unico?.refId ? refMap.get(unico.refId) : undefined;

  /** Nota/texto vira um cartão na escaleta (no último ato). */
  function paraEscaleta(it: BoardItem) {
    const st = useApp.getState();
    const o = st.current!.project.outline;
    const linhas = (it.texto ?? "").trim().split("\n");
    const curto = linhas.length > 1 && linhas[0].length <= 60;
    const card = {
      ...emptyCard(o.atos.length ? o.atos[o.atos.length - 1].id : null),
      cabecalho: curto ? linhas[0] : "",
      resumo: curto ? linhas.slice(1).join("\n").trim() : (it.texto ?? "").trim(),
    };
    st.updateOutline({ atos: o.atos, cartoes: renumber([...o.cartoes, card]) });
    patchItem(it.id, { cartaoId: card.id });
    st.setNotice(tt("Nota levada para a escaleta."));
  }

  function vinculosDe(it: BoardItem): RefLink[] {
    if (it.refId) return refMap.get(it.refId)?.vinculos ?? [];
    return it.vinculos ?? [];
  }
  function setVinculos(it: BoardItem, v: RefLink[]) {
    if (it.refId) patchRef(it.refId, { vinculos: v });
    else patchItem(it.id, { vinculos: v });
  }

  return (
    <div className="bd">
      <div className="bd-tools">
        <button className="btn rs-add" onClick={() => addItem({ tipo: "nota", w: 200, h: 150, texto: "", cor: "amarelo" })}>
          <Icon name="penLine" size={14} />
          {tt("Nota")}
        </button>
        <button className="btn rs-add" onClick={() => addItem({ tipo: "texto", w: 260, h: 48, texto: "" })}>
          <Icon name="type" size={14} />
          {tt("Texto")}
        </button>
        <button
          className="btn rs-add"
          onClick={() => {
            const r = newRef({ tipo: "link", url: "" });
            addRefs([r]);
            const it = addItem({ tipo: "referencia", refId: r.id, w: 260, h: 36 });
            setEditando(it.id);
          }}
        >
          <Icon name="link" size={14} />
          {tt("Link")}
        </button>
        <button className="btn rs-add" onClick={() => fileRef.current?.click()}>
          <Icon name="image" size={14} />
          {tt("Imagem ou arquivo")}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.length) receberArquivos(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
        <Picker
          className="btnlike"
          options={targets.map((t) => ({ value: t.value, label: t.label, group: t.group }))}
          onPick={(v) => {
            const t = targets.find((x) => x.value === v);
            if (t) addItem({ tipo: "elemento", elemento: t.link, texto: t.label, w: 200, h: 44 });
          }}
          placeholder={tt("Buscar elemento da obra…")}
        >
          <Icon name="user" size={14} />
          {tt("Elemento da obra")}
        </Picker>
        <button
          className={`btn rs-add ${conectar ? "on" : ""}`}
          onClick={() => setConectar(conectar ? null : { de: null })}
          title={tt("Clique num item e depois em outro para ligar os dois")}
        >
          <Icon name="arrowDown" size={14} />
          {conectar ? (conectar.de ? tt("Agora clique no destino") : tt("Clique na origem")) : tt("Ligar")}
        </button>
        <span style={{ flex: 1 }} />
        <button className="ed-tool ed-icon" onClick={() => setVista((v) => ({ ...v, zoom: Math.max(0.2, +(v.zoom / 1.2).toFixed(2)) }))} title={tt("Diminuir zoom")}>
          −
        </button>
        <span className="ed-zoom-val" onClick={() => setVista((v) => ({ ...v, zoom: 1 }))} title={tt("Zoom 100%")}>
          {Math.round(vista.zoom * 100)}%
        </span>
        <button className="ed-tool ed-icon" onClick={() => setVista((v) => ({ ...v, zoom: Math.min(3, +(v.zoom * 1.2).toFixed(2)) }))} title={tt("Aumentar zoom")}>
          +
        </button>
        <button className="ed-tool" onClick={centralizar} title={tt("Mostrar tudo")}>
          {tt("Mostrar tudo")}
        </button>
      </div>

      <div
        ref={wrapRef}
        className={`bd-area ${conectar ? "connecting" : ""}`}
        style={{
          backgroundSize: `${24 * vista.zoom}px ${24 * vista.zoom}px`,
          backgroundPosition: `${vista.x}px ${vista.y}px`,
        }}
        onPointerDown={onPointerDownBg}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const p = toWorld(e.clientX, e.clientY);
          addItem({ tipo: "nota", w: 200, h: 150, texto: "", cor: "amarelo", x: p.x, y: p.y });
        }}
        onDragOver={(e) => {
          const tipos = Array.from(e.dataTransfer.types);
          if (tipos.includes("Files") || tipos.includes("text/uri-list") || tipos.includes("text/plain")) e.preventDefault();
        }}
        onDrop={(e) => {
          const p = toWorld(e.clientX, e.clientY);
          if (e.dataTransfer.files.length) {
            e.preventDefault();
            // soltar uma imagem em cima de uma nota coloca a imagem na nota
            const sobre = (e.target as HTMLElement).closest<HTMLElement>(".bd-item.t-nota");
            const nota = sobre ? boardRef.current.itens.find((i) => i.id === sobre.dataset.id) : undefined;
            const f = e.dataTransfer.files[0];
            if (nota && f.type.startsWith("image/")) imagemNaNota(nota, f);
            else receberArquivos(Array.from(e.dataTransfer.files), p);
            return;
          }
          const t = (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain")).trim();
          if (!t) return;
          e.preventDefault();
          if (isUrl(t.split("\n")[0])) receberLink(t.split("\n")[0], p);
          else receberTexto(t, p);
        }}
      >
        {board.itens.length === 0 && (
          <div className="bd-empty">
            {tt("Cole aqui (Ctrl+V) imagens, links ou textos, arraste arquivos, ou dê um duplo clique para criar uma nota.")}
          </div>
        )}
        <div className="bd-layer" style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.zoom})` }}>
          <svg className="bd-edges" width="1" height="1">
            <defs>
              <marker id="bd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
              </marker>
            </defs>
            {board.ligacoes.map((l) => {
              const a = byId.get(l.de);
              const b = byId.get(l.para);
              if (!a || !b) return null;
              const c1 = center(a);
              const c2 = center(b);
              // a seta sai da borda da origem e termina na borda do destino
              const p1 = border(a, c2.x - c1.x, c2.y - c1.y, 0);
              const end = border(b, c1.x - c2.x, c1.y - c2.y, 3);
              return (
                <g
                  key={l.id}
                  className={`bd-edge ${selEdge === l.id ? "sel" : ""}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSel([]);
                    setSelEdge(l.id);
                  }}
                >
                  <line x1={c1.x} y1={c1.y} x2={end.x} y2={end.y} className="hit" />
                  <line x1={p1.x} y1={p1.y} x2={end.x} y2={end.y} markerEnd="url(#bd-arrow)" />
                </g>
              );
            })}
          </svg>

          {board.itens.map((it) => {
            const ref = it.refId ? refMap.get(it.refId) : undefined;
            const rt = ref?.tipo;
            const isSel = sel.includes(it.id);
            const origem = conectar?.de === it.id;
            const vinc = vinculosDe(it).length;
            const variante = it.tipo === "referencia" ? `r-${rt ?? "removida"}` : `t-${it.tipo}`;
            return (
              <div
                key={it.id}
                data-id={it.id}
                className={`bd-item ${variante} c-${it.cor ?? "papel"} ${isSel ? "sel" : ""} ${origem ? "origem" : ""}`}
                style={{ left: it.x, top: it.y, width: it.w, height: rt === "link" ? undefined : it.h, minHeight: rt === "link" ? it.h : undefined }}
                onPointerDown={(e) => startItem(e, it, "move")}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (it.tipo === "nota" || it.tipo === "texto" || rt === "link") setEditando(it.id);
                  else if (rt === "documento" && ref) void abrirArquivo(ref);
                }}
              >
                {it.tipo === "nota" && it.imagem && <NoteImage root={root} arquivo={it.imagem} />}
                {(it.tipo === "nota" || it.tipo === "texto") &&
                  (editando === it.id ? (
                    <textarea
                      autoFocus
                      className="bd-text"
                      value={it.texto ?? ""}
                      placeholder={it.tipo === "nota" ? tt("Escreva…") : tt("Texto")}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => patchItem(it.id, { texto: e.target.value })}
                      onBlur={() => setEditando(null)}
                    />
                  ) : (
                    <div className={`bd-text ${it.texto ? "" : "vazio"}`}>{it.texto || (it.tipo === "nota" ? tt("Duplo clique para escrever") : tt("Texto"))}</div>
                  ))}
                {it.tipo === "referencia" && !ref && <div className="bd-missing">{tt("Referência removida")}</div>}
                {rt === "imagem" && ref && <ImageBody r={ref} root={root} selected={isSel} />}
                {rt === "link" && ref && (
                  <LinkBody r={ref} editing={editando === it.id || !ref.url} onEdit={(p) => patchRef(ref.id, p)} />
                )}
                {rt === "documento" && ref && <FileBody r={ref} />}
                {rt === "nota" && ref && (
                  <div className="bd-text">
                    {ref.titulo && <b>{ref.titulo}</b>}
                    {ref.titulo && ref.notas ? "\n" : ""}
                    {ref.notas}
                  </div>
                )}
                {it.tipo === "elemento" && it.elemento && (
                  <div className={`bd-el lk-${it.elemento.tipo}`}>
                    <Icon name={ELEMENT_ICON[it.elemento.tipo] ?? "book"} size={15} />
                    <span>{targets.find((t) => t.link.tipo === it.elemento!.tipo && t.link.id === it.elemento!.id)?.label ?? it.texto}</span>
                    <button
                      className="bd-go"
                      title={tt("Abrir")}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        const el = it.elemento!;
                        if (el.tipo === "secao" && el.id) focusElement(el.id);
                        else if (TAB_OF[el.tipo]) setTab(TAB_OF[el.tipo] as never);
                      }}
                    >
                      <Icon name="external" size={12} />
                    </button>
                  </div>
                )}
                {vinc > 0 && it.tipo !== "elemento" && (
                  <span className="bd-vinc" title={vinc === 1 ? tt("Vinculado a 1 elemento da obra") : tt("Vinculado a {n} elementos da obra", { n: vinc })}>
                    <Icon name="link" size={10} />
                    {vinc}
                  </span>
                )}
                {isSel && sel.length === 1 && <span className="bd-resize" onPointerDown={(e) => startItem(e, it, "resize")} />}
              </div>
            );
          })}
        </div>

        {unico && !conectar && (
          <div className="bd-selbar" onPointerDown={(e) => e.stopPropagation()}>
            {unico.tipo === "nota" &&
              CORES.map((c) => (
                <button
                  key={c.id}
                  className={`bd-swatch c-${c.id} ${(unico.cor ?? "papel") === c.id ? "on" : ""}`}
                  title={c.label}
                  onClick={() => patchItem(unico.id, { cor: c.id })}
                />
              ))}
            {unico.tipo === "nota" && unico.imagem && (
              <button className="ed-tool" onClick={() => patchItem(unico.id, { imagem: undefined })} title={tt("Tirar a imagem da nota")}>
                <Icon name="image" size={13} />
                {tt("Tirar imagem")}
              </button>
            )}
            {unicoRef?.tipo === "imagem" && (
              <input
                className="bd-caption-input"
                value={unicoRef.titulo}
                placeholder={tt("Legenda")}
                onChange={(e) => patchRef(unicoRef.id, { titulo: e.target.value })}
              />
            )}
            {unico.tipo !== "elemento" && (
              <LinkChips compact value={vinculosDe(unico)} targets={targets} onChange={(v) => setVinculos(unico, v)} />
            )}
            {(unico.tipo === "nota" || unico.tipo === "texto") &&
              (unico.cartaoId && cartoesIds.has(unico.cartaoId) ? (
                <button className="ed-tool" onClick={() => setTab("escaleta")} title={tt("Abrir a escaleta")}>
                  <Icon name="check" size={13} />
                  {tt("Na escaleta")}
                </button>
              ) : (
                <button className="ed-tool" onClick={() => paraEscaleta(unico)} title={tt("Criar um cartão na escaleta com este texto")}>
                  <Icon name="layoutList" size={13} />
                  {tt("Para a escaleta")}
                </button>
              ))}
            {unicoRef?.tipo === "link" && unicoRef.url && (
              <button className="ed-tool" onClick={() => void openLink(unicoRef.url!)}>
                <Icon name="external" size={13} />
                {tt("Abrir")}
              </button>
            )}
            {unicoRef?.tipo === "link" && (
              <button className="ed-tool" onClick={() => setEditando(unico.id)}>
                <Icon name="pencil" size={13} />
                {tt("Editar")}
              </button>
            )}
            {unicoRef?.arquivo && (
              <button className="ed-tool" onClick={() => void abrirArquivo(unicoRef)}>
                <Icon name="external" size={13} />
                {tt("Abrir")}
              </button>
            )}
            <button className="ed-tool" onClick={apagarSelecao} title={tt("Apagar (Delete)")}>
              <Icon name="trash" size={13} />
            </button>
          </div>
        )}
        {sel.length > 1 && (
          <div className="bd-selbar" onPointerDown={(e) => e.stopPropagation()}>
            <span className="bd-selcount">{sel.length} {tt("itens")}</span>
            <button className="ed-tool" onClick={() => copiar()}>
              <Icon name="copy" size={13} />
              {tt("Copiar")}
            </button>
            <button className="ed-tool" onClick={apagarSelecao}>
              <Icon name="trash" size={13} />
              {tt("Apagar")}
            </button>
          </div>
        )}
        {selEdge && (
          <div className="bd-selbar">
            <button className="ed-tool" onClick={apagarSelecao}>
              <Icon name="trash" size={13} />
              {tt("Apagar ligação")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
