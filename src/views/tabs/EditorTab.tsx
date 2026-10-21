import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { beforeClose } from "@/utils/lifecycle";
import { usePageZoom } from "@/hooks/usePageZoom";
import { kbd } from "@/utils/platform";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import { useApp } from "@/store/appStore";
import { ElementType } from "@/types";
import {
  charactersInScreenplay,
  headingsInScreenplay,
  locationsInScreenplay,
  renumberScenes,
} from "@/domain/screenplay";
import { buildExtensions } from "@/editor/schema";
import { docParaElementos, elementosParaDoc, mesmoConteudo } from "@/editor/convert";
import { autocomplete } from "@/editor/autocompleteBridge";
import { paginacaoKey } from "@/editor/pagination";
import { Layout, kindOf, pageSettingsOf, presetById, resolveLayout } from "@/layout/profiles";
import { ensureLayoutCss } from "@/layout/css";
import { pageFurniture } from "@/layout/furniture";
import { PageInfo, pageOf } from "@/layout/paginate";
import { countWords } from "@/layout/engine";
import { Icon } from "@/components/Icon";
import { PageSetupPanel } from "@/components/PageSetupPanel";
import { CommentsPanel } from "@/components/CommentsPanel";
import { comentariosUi } from "@/editor/comments";
import { DocComment } from "@/types";
import { newId } from "@/domain/project";
import { FindBar } from "@/components/FindBar";
import { buscaUi } from "@/editor/search";
import { tocCache } from "@/layout/tocCache";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { tt, locale, uiLang } from "@/i18n";
import "@/styles/editor.css";
import "@/styles/pages.css";

const ZOOMS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

/** Folhas desenhadas por trás do texto (com número de página e cabeçalho). */
const SheetsLayer = memo(
  function SheetsLayer({
    layout,
    pages,
    oddLeft,
    evenLeft,
    title,
    author,
  }: {
    layout: Layout;
    pages: PageInfo[];
    sig: string;
    oddLeft: number;
    evenLeft: number;
    title: string;
    author: string;
  }) {
    const pitch = layout.pageH + layout.gap;
    return (
      <>
        {pages.map((p) => (
          <div
            key={p.index}
            className={`pv-sheet ${p.blank ? "blank" : ""}`}
            style={{
              top: p.index * pitch,
              left: p.index % 2 === 0 ? oddLeft : evenLeft,
              width: layout.pageW,
              height: layout.pageH,
              fontFamily: layout.fontInfo.css,
            }}
          >
            {pageFurniture(layout, p, { title, author }).map((f, k) => (
              <span
                key={k}
                className="pv-furn"
                style={{
                  top: f.y,
                  fontSize: `${f.sizePt}pt`,
                  lineHeight: `${f.lineHeight}px`,
                  fontStyle: f.italic ? "italic" : "normal",
                  ...(f.align === "left"
                    ? { left: f.x }
                    : f.align === "right"
                      ? { right: layout.pageW - f.x }
                      : { left: f.x, transform: "translateX(-50%)" }),
                }}
              >
                {f.text}
              </span>
            ))}
            {p.blank && <span className="pv-blank-tag">{tt("página em branco")}</span>}
          </div>
        ))}
      </>
    );
  },
  // Só redesenha quando muda algo que aparece nas folhas, não a cada tecla.
  (a, b) =>
    a.sig === b.sig &&
    a.layout.sig === b.layout.sig &&
    a.oddLeft === b.oddLeft &&
    a.evenLeft === b.evenLeft &&
    a.title === b.title &&
    a.author === b.author
);

export function EditorTab() {
  const screenplay = useApp((s) => s.current!.project.screenplay);
  const characters = useApp((s) => s.current!.project.characters);
  const locations = useApp((s) => s.current!.project.locations);
  const meta = useApp((s) => s.current!.project.meta);
  const cover = useApp((s) => s.current!.project.cover);
  const updateScreenplay = useApp((s) => s.updateScreenplay);
  const elementos = screenplay.elementos;

  const kind = kindOf(meta);
  const layout = useMemo(() => resolveLayout(meta), [meta.tipo, meta.pagina]); // eslint-disable-line react-hooks/exhaustive-deps
  const layoutCls = useMemo(() => ensureLayoutCss(layout), [layout]);
  const contd = meta.contdEnabled !== false;

  const isMobile = useMediaQuery("(max-width: 760px)");
  const [zoomMode, setZoomMode] = useState<"fit" | number>(isMobile ? "fit" : 1);
  const [showNav, setShowNav] = useState(!isMobile && kind.id !== "roteiro");
  const [showSetup, setShowSetup] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [cmAtivo, setCmAtivo] = useState<string | null>(null);
  const [cmNovo, setCmNovo] = useState<string | null>(null);
  const [find, setFind] = useState<null | "find" | "replace">(null);
  const focusMode = useApp((s) => s.focusMode);
  const setFocusMode = useApp((s) => s.setFocusMode);
  const updateMeta = useApp((s) => s.updateMeta);

  const screenplayRef = useRef(screenplay);
  screenplayRef.current = screenplay;

  // Sincroniza o documento com a store (arquivo, busca, escaleta) agrupando a
  // digitação: em livros grandes, converter tudo a cada tecla pesa.
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => void>(() => {});

  const editor = useEditor(
    {
      extensions: buildExtensions(kind, { layout, contd }) as any,
      content: elementosParaDoc(elementos, kind.defaultType),
      autofocus: false,
      editorProps: {
        attributes: { class: "pv-text", spellcheck: "true", lang: meta.idioma ?? uiLang() },
      },
      onUpdate: ({ editor }) => {
        const doc = editor.state.doc;
        flushRef.current = () => {
          if (syncTimer.current) clearTimeout(syncTimer.current);
          syncTimer.current = null;
          const els = docParaElementos(doc);
          updateScreenplay({
            ...screenplayRef.current,
            elementos: kind.id === "roteiro" ? renumberScenes(els) : els,
          });
        };
        if (syncTimer.current) clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => flushRef.current(), 150);
      },
      // sair do editor (clicar em outra aba, fechar o projeto) grava na hora
      onBlur: () => {
        if (syncTimer.current) flushRef.current();
      },
    },
    [kind.id]
  );

  // Ao fechar o app, leva para a store o que foi digitado por último.
  useEffect(
    () =>
      beforeClose(() => {
        if (syncTimer.current) flushRef.current();
      }),
    []
  );

  // Ao sair do editor, grava o que ainda estiver pendente.
  useEffect(
    () => () => {
      if (syncTimer.current) flushRef.current();
    },
    []
  );

  // Documento trocado por fora (episódio, backup, desfazer da store) -> recarrega.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (syncTimer.current) return; // edição local ainda não sincronizada
    const atual = docParaElementos(editor.state.doc);
    const alvo = elementos.length ? elementos : [{ id: "", tipo: kind.defaultType, texto: "" }];
    if (!mesmoConteudo(atual, alvo)) {
      editor.commands.setContent(elementosParaDoc(elementos, kind.defaultType), { emitUpdate: false });
    }
  }, [editor, elementos, kind.defaultType]);

  // Configuração de página mudou -> repagina com o novo layout.
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const st = paginacaoKey.getState(editor.state);
    if (st && (st.layout.sig !== layout.sig || st.contd !== contd)) {
      editor.view.dispatch(editor.state.tr.setMeta(paginacaoKey, { layout, contd }));
    }
  }, [editor, layout, contd]);

  // Estado de paginação (só re-renderiza quando a paginação ou a página atual mudam).
  const pag = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null;
      const st = paginacaoKey.getState(editor.state);
      if (!st) return null;
      const { dl } = st;
      const head = editor.state.selection.head;
      const $h = editor.state.doc.resolve(Math.min(head, editor.state.doc.content.size));
      const bi = Math.min($h.index(0), dl.nodes.length - 1);
      let page = 0;
      if (bi >= 0 && dl.nodes[bi]) {
        const ch = Math.max(0, head - (dl.nodes[bi].pos + 1));
        page = pageOf(dl.pages, bi, ch, dl.blocks);
      }
      const tipo = $h.depth >= 1 ? ($h.node(1).attrs.tipo as ElementType) : undefined;
      return { version: st.version, page, total: dl.pages.length, tipo };
    },
  });
  const st = editor ? paginacaoKey.getState(editor.state) : undefined;
  const dl = st?.dl;
  const activeTipo = pag?.tipo;

  // atalhos: localizar (Ctrl+F), substituir (Ctrl+H), modo foco
  useEffect(() => {
    buscaUi.open = (r) => setFind(r ? "replace" : "find");
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setFind("find");
      } else if (mod && !e.shiftKey && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        setFind("replace");
      } else if (mod && e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setFocusMode(!useApp.getState().focusMode);
      } else if (e.key === "Escape" && useApp.getState().focusMode && !document.querySelector(".find-bar")) {
        setFocusMode(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      buscaUi.open = () => {};
    };
  }, [setFocusMode]);

  // zoom
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(900);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCanvasW(el.clientWidth));
    ro.observe(el);
    setCanvasW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Na tela as folhas ficam alinhadas umas sob as outras (como no Word). Com
  // margens espelhadas, a mancha de texto fica no meio da folha; o espelhamento
  // par/ímpar vale no PDF e na impressão. A largura do texto é a mesma, então as
  // quebras de linha e de página não mudam.
  const screenLayout = useMemo(() => {
    if (!layout.mirror) return layout;
    const avg = (layout.marginInner + layout.marginOuter) / 2;
    return { ...layout, marginInner: avg, marginOuter: avg };
  }, [layout]);
  const stageW = layout.pageW;
  const zoom =
    zoomMode === "fit" ? Math.max(0.3, Math.min(2, (canvasW - (isMobile ? 16 : 48)) / stageW)) : zoomMode;

  usePageZoom(canvasRef, zoom, setZoomMode);

  function stepZoom(dir: number) {
    const z = zoom;
    const next = dir > 0 ? ZOOMS.find((v) => v > z + 0.001) : [...ZOOMS].reverse().find((v) => v < z - 0.001);
    setZoomMode(next ?? z);
  }

  // ferramentas
  function applyTool(tipo: ElementType) {
    if (!editor) return;
    const { $from, empty } = editor.state.selection;
    const vazio = $from.parent.content.size === 0;
    const noFim = empty && $from.parentOffset === $from.parent.content.size;
    const chain = editor.chain().focus();
    if (vazio || !noFim) chain.updateAttributes("linha", { tipo });
    else chain.splitBlock().updateAttributes("linha", { tipo });
    chain.run();
  }

  const marks = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor && kind.marks
        ? { b: editor.isActive("bold"), i: editor.isActive("italic") }
        : { b: false, i: false },
  });

  // comentários
  const comentarios = screenplay.comentarios ?? [];
  const setNotice = useApp((s) => s.setNotice);
  function setComentarios(lista: DocComment[]) {
    updateScreenplay({ ...screenplayRef.current, comentarios: lista });
  }
  function novoComentario() {
    if (!editor) return;
    const sel = editor.state.selection;
    let { from, to } = sel;
    // sem seleção: comenta o parágrafo inteiro
    if (sel.empty) {
      from = sel.$from.start();
      to = sel.$from.end();
    }
    if (from >= to) {
      setNotice(tt("Escreva algo no parágrafo, ou selecione um trecho, para comentar."));
      return;
    }
    const id = newId();
    const trecho = editor.state.doc.textBetween(from, to, " ").replace(/\s+/g, " ").trim().slice(0, 240);
    editor.chain().focus().setTextSelection({ from, to }).setMark("comentario", { id }).setTextSelection(to).run();
    setComentarios([...(screenplayRef.current.comentarios ?? []), { id, texto: "", criadoEm: new Date().toISOString(), trecho }]);
    setShowSetup(false);
    setShowComments(true);
    setCmAtivo(id);
    setCmNovo(id);
  }
  useEffect(() => {
    comentariosUi.novo = novoComentario;
    return () => {
      comentariosUi.novo = () => {};
    };
  });
  // comentário sob o cursor
  const cmNoCursor = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null;
      const m = editor.state.selection.$from.marks().find((x) => x.type.name === "comentario");
      return (m?.attrs.id as string | undefined) ?? null;
    },
  });
  useEffect(() => {
    if (cmNoCursor) {
      setCmAtivo(cmNoCursor);
      if (comentarios.length) setShowComments(true);
    }
  }, [cmNoCursor]); // eslint-disable-line react-hooks/exhaustive-deps
  const cmCss = [
    ...comentarios.filter((c) => c.resolvido).map((c) => `.cm-mark[data-comentario="${c.id}"]{background:none;border-bottom:none}`),
    cmAtivo ? `.cm-mark[data-comentario="${cmAtivo}"]{background:var(--cm-active)}` : "",
  ].join("");
  const abertos = comentarios.filter((c) => !c.resolvido).length;

  // foco vindo da busca global
  const pendingFocus = useApp((s) => s.pendingFocusElement);
  const clearFocusElement = useApp((s) => s.clearFocusElement);
  function focusBlock(id: string) {
    if (!editor) return;
    let alvo = -1;
    editor.state.doc.forEach((node, pos) => {
      if (node.attrs.id === id) alvo = pos;
    });
    if (alvo >= 0) {
      editor.chain().focus().setTextSelection(alvo + 1).run();
      const dom = editor.view.nodeDOM(alvo) as HTMLElement | null;
      dom?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }
  useEffect(() => {
    if (!pendingFocus || !editor) return;
    focusBlock(pendingFocus);
    clearFocusElement();
  }, [pendingFocus, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // autocomplete (personagem e cabeçalho de cena)
  const characterNames = useMemo(() => {
    const fromScript = charactersInScreenplay(screenplay);
    const fromBible = characters.map((c) => c.nome.trim().toUpperCase()).filter(Boolean);
    return [...new Set([...fromBible, ...fromScript])].sort();
  }, [screenplay, characters]);

  const headingSuggestions = useMemo(() => {
    if (kind.id !== "roteiro") return [];
    const headings = headingsInScreenplay(screenplay);
    const locs = [
      ...locations.map((l) => l.nome.trim().toUpperCase()).filter(Boolean),
      ...locationsInScreenplay(screenplay),
    ];
    const locHeadings = locs.map((l) => `INT. ${l} - `);
    return [...new Set([...headings, ...locHeadings])].sort();
  }, [screenplay, locations, kind.id]);

  const acCtx = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null;
      const sel = editor.state.selection;
      if (!sel.empty) return null;
      const node = sel.$from.parent;
      if (node.type.name !== "linha") return null;
      const tipo = node.attrs.tipo as ElementType;
      if (tipo !== "personagem" && !(tipo === "cabecalho" && kind.id === "roteiro")) return null;
      return { tipo, text: node.textContent, pos: sel.from };
    },
  });

  const [acIndex, setAcIndex] = useState(0);
  const [acClosed, setAcClosed] = useState<string | null>(null);
  const suggestions = useMemo(() => {
    if (!acCtx) return [] as string[];
    const q = acCtx.text.trim().toUpperCase();
    if (!q || acClosed === acCtx.text) return [];
    const src = acCtx.tipo === "personagem" ? characterNames : headingSuggestions;
    const match =
      acCtx.tipo === "personagem"
        ? src.filter((n) => n.startsWith(q) && n !== q)
        : src.filter((n) => n.includes(q) && n !== q);
    return match.slice(0, 6);
  }, [acCtx, characterNames, headingSuggestions, acClosed]);

  useEffect(() => setAcIndex(0), [suggestions]);

  function aceitar(nome: string) {
    if (!editor) return;
    const { $from } = editor.state.selection;
    editor.chain().focus().insertContentAt({ from: $from.start(), to: $from.end() }, nome).run();
  }

  useEffect(() => {
    autocomplete.active = suggestions.length > 0;
    autocomplete.accept = () => {
      if (!suggestions.length) return false;
      aceitar(suggestions[acIndex]);
      return true;
    };
    autocomplete.move = (d) => {
      if (!suggestions.length) return false;
      setAcIndex((i) => (i + d + suggestions.length) % suggestions.length);
      return true;
    };
    autocomplete.close = () => {
      if (!suggestions.length || !acCtx) return false;
      setAcClosed(acCtx.text);
      return true;
    };
    return () => {
      autocomplete.active = false;
    };
  });

  let dropPos: { left: number; top: number } | null = null;
  if (editor && acCtx && suggestions.length > 0) {
    try {
      const c = editor.view.coordsAtPos(acCtx.pos);
      dropPos = { left: c.left, top: c.bottom + 3 };
    } catch {
      dropPos = null;
    }
  }

  // folhas
  const pitch = layout.pageH + layout.gap;
  const pages = dl?.pages ?? [];
  const nPages = Math.max(1, pages.length);
  const stageH = nPages * pitch - layout.gap;
  const oddLeft = 0;
  const evenLeft = 0;
  const flowLeft = screenLayout.marginInner;
  const pagesSig = pages.map((p) => `${p.blank ? "b" : ""}${p.opener ? "o" : ""}`).join(",");
  const furnitureInfo = {
    title: (cover.titulo || meta.nome || "").trim(),
    author: (cover.autor || meta.autor || "").trim(),
  };

  // sumário (cenas / páginas da HQ / capítulos)
  const sections = useMemo(() => {
    if (!dl) return [];
    const out: { id: string; label: string; page: number }[] = [];
    let n = 0;
    const firstPage = new Map<number, number>();
    dl.pages.forEach((p) => p.segs.forEach((s) => !firstPage.has(s.b) && firstPage.set(s.b, p.index)));
    dl.sources.forEach((s, i) => {
      if (s.tipo !== kind.sectionType) return;
      n += 1;
      const txt = s.texto.replace(/\n/g, " ").trim();
      let label: string;
      if (kind.id === "roteiro") label = `${n}. ${txt.toUpperCase() || tt("CENA SEM CABEÇALHO")}`;
      else if (kind.id === "quadrinhos") label = `${tt("Página {n}", { n })}${txt ? ` · ${txt}` : ""}`;
      else label = txt || tt("Capítulo {n}", { n });
      out.push({ id: s.id, label, page: (firstPage.get(i) ?? 0) + 1 });
    });
    return out;
  }, [dl, kind.id, kind.sectionType]);

  // estatísticas (atrasadas, para não pesar a digitação)
  const [stats, setStats] = useState("");
  const [words, setWords] = useState(0);
  useEffect(() => {
    if (!dl) return;
    const t = setTimeout(() => {
      const total = dl.pages.length;
      const words = countWords(dl);
      setWords(words);
      const folhas = total === 1 ? tt("1 página") : tt("{n} páginas", { n: total });
      if (kind.id === "roteiro") {
        const cenas = dl.sources.filter((s) => s.tipo === "cabecalho").length;
        setStats(`${folhas} · ~${total} min · ${cenas === 1 ? tt("1 cena") : tt("{n} cenas", { n: cenas })}`);
      } else if (kind.id === "quadrinhos") {
        const pg = dl.sources.filter((s) => s.tipo === "pagina").length;
        const qd = dl.sources.filter((s) => s.tipo === "quadro").length;
        setStats(`${pg === 1 ? tt("1 página de HQ") : tt("{n} páginas de HQ", { n: pg })} · ${qd === 1 ? tt("1 quadro") : tt("{n} quadros", { n: qd })} · ${tt("{folhas} de roteiro", { folhas })}`);
      } else {
        const chars = dl.sources.reduce((a, s) => a + s.texto.length, 0);
        const min = Math.max(1, Math.round(words / 230));
        const leitura = min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
        setStats(
          `${tt("{n} palavras", { n: words.toLocaleString(locale()) })} · ${tt("{n} caracteres", { n: chars.toLocaleString(locale()) })} · ${folhas} · ${tt("~{tempo} de leitura", { tempo: leitura })}`
        );
      }
    }, 250);
    return () => clearTimeout(t);
  }, [dl, kind.id]);

  // metas de palavras
  const metas = meta.metas;
  const hoje = new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD
  useEffect(() => {
    if (!metas?.diaria || !words) return;
    if (metas.dia !== hoje) updateMeta({ metas: { ...metas, dia: hoje, base: words } });
  }, [metas, words, hoje, updateMeta]);
  const hojeEscritas = metas?.diaria && metas.dia === hoje ? Math.max(0, words - (metas.base ?? words)) : 0;

  // sumário para a aba Capa (novel)
  useEffect(() => {
    if (kind.id !== "novel") return;
    tocCache.src = screenplay.elementos;
    tocCache.entries = sections.map((x) => ({ titulo: x.label, pagina: x.page }));
  }, [sections, screenplay, kind.id]);

  const s = pageSettingsOf(meta);
  const paperLabel = presetById(s.formato)?.label.split(" · ")[0] ?? `${s.largura} × ${s.altura} mm`;

  return (
    <div className="ed-wrap">
      {dropPos && (
        <div className="sp-autocomplete" style={{ position: "fixed", left: dropPos.left, top: dropPos.top, zIndex: 60 }}>
          {suggestions.map((nome, i) => (
            <div
              key={nome}
              className={`sp-ac-item ${i === acIndex ? "active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                aceitar(nome);
              }}
            >
              {nome}
            </div>
          ))}
        </div>
      )}

      <div className="ed-toolbar">
        <button
          className={`ed-tool ed-icon ${showNav ? "active-soft" : ""}`}
          onClick={() => setShowNav((v) => !v)}
          title={`Mostrar/ocultar ${kind.sectionLabel.toLowerCase()}`}
        >
          <Icon name="sidebar" size={15} />
        </button>
        <span className="ed-sep" />
        {kind.blocks.map((b, i) => (
          <button
            key={b.tipo}
            className={`ed-tool ${activeTipo === b.tipo ? "active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              applyTool(b.tipo);
            }}
            title={`${b.label}  (${kbd(String(i + 1))})`}
          >
            {b.short}
            <span className="k">{i + 1}</span>
          </button>
        ))}
        {kind.marks && (
          <>
            <span className="ed-sep" />
            <button
              className={`ed-tool ed-icon ${marks?.b ? "active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                editor?.chain().focus().toggleBold().run();
              }}
              title={`Negrito (${kbd("B")})`}
            >
              <b>{tt("N")}</b>
            </button>
            <button
              className={`ed-tool ed-icon ${marks?.i ? "active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                editor?.chain().focus().toggleItalic().run();
              }}
              title={`${tt("Itálico")} (${kbd("I")})`}
            >
              <i style={{ fontFamily: "Georgia, serif" }}>{tt("I")}</i>
            </button>
          </>
        )}

        <div className="ed-right">
          <button
            className="ed-tool ed-icon"
            onMouseDown={(e) => {
              e.preventDefault();
              novoComentario();
            }}
            title={`${tt("Comentar o trecho selecionado ou o parágrafo")} (${kbd("Alt", "M")})`}
          >
            <Icon name="message" size={14} />
          </button>
          {comentarios.length > 0 && (
            <button
              className={`ed-tool ${showComments ? "active-soft" : ""}`}
              onClick={() => {
                setShowComments(!showComments);
                setShowSetup(false);
              }}
              title={tt("Mostrar ou ocultar os comentários")}
            >
              {abertos} {abertos === 1 ? tt("comentário") : tt("comentários")}
            </button>
          )}
          <span className="ed-sep" />
          <button className="ed-tool ed-icon" onClick={() => setFind("find")} title={`${tt("Localizar e substituir")} (${kbd("F")})`}>
            <Icon name="search" size={14} />
          </button>
          <button
            className={`ed-tool ed-icon ${focusMode ? "active-soft" : ""}`}
            onClick={() => setFocusMode(!focusMode)}
            title={focusMode ? tt("Sair do modo foco (Esc)") : `Modo foco (${kbd("Shift", "F")})`}
          >
            <Icon name={focusMode ? "minimize" : "maximize"} size={14} />
          </button>
          {kind.id === "novel" && (
            <button
              className={`ed-tool ${showSetup ? "active-soft" : ""}`}
              onClick={() => {
                if (!showSetup) setZoomMode("fit");
                setShowSetup(!showSetup);
                setShowComments(false);
              }}
              title={tt("Configurar página")}
            >
              <Icon name="page" size={14} />
              <span className="ed-paper">{paperLabel}</span>
            </button>
          )}
          <span className="ed-sep" />
          <button className="ed-tool ed-icon" onClick={() => stepZoom(-1)} title={tt("Diminuir zoom")}>
            −
          </button>
          <span className="ed-zoom-val" onClick={() => setZoomMode(1)} title={tt("Zoom 100%")}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="ed-tool ed-icon" onClick={() => stepZoom(1)} title={tt("Aumentar zoom")}>
            +
          </button>
          <button
            className={`ed-tool ${zoomMode === "fit" ? "active-soft" : ""}`}
            style={{ marginLeft: 2 }}
            onClick={() => setZoomMode("fit")}
            title={tt("Ajustar à largura")}
          >
            {tt("Ajustar")}
          </button>
        </div>
      </div>

      <div className="ed-body">
        {editor && find && (
          <FindBar
            editor={editor}
            replace={find === "replace"}
            onClose={() => setFind(null)}
            onToggleReplace={() => setFind(find === "replace" ? "find" : "replace")}
          />
        )}
        {showNav && !focusMode && (
          <aside className="ed-nav">
            <div className="ed-nav-head">{kind.sectionLabel}</div>
            {sections.length === 0 && (
              <div className="ed-nav-empty">
                {kind.id === "novel"
                  ? tt("Use “Capítulo” ({atalho}) para criar capítulos.", { atalho: kbd("1") })
                  : kind.id === "quadrinhos"
                    ? tt("Use “Página” ({atalho}) para abrir uma página da HQ.", { atalho: kbd("1") })
                    : tt("Cabeçalhos de cena aparecem aqui.")}
              </div>
            )}
            {sections.map((sec) => (
              <button key={sec.id} className="ed-nav-item" onClick={() => focusBlock(sec.id)} title={sec.label}>
                <span className="ed-nav-label">{sec.label}</span>
                <span className="ed-nav-page">{sec.page}</span>
              </button>
            ))}
          </aside>
        )}

        <div
          className="pv-canvas"
          ref={canvasRef}
          onDragStart={(e) => e.preventDefault()}
          onMouseDown={(e) => {
            // clique no fundo cinza: foca o editor no fim (como no Word)
            if (e.target === e.currentTarget && editor) {
              e.preventDefault();
              editor.commands.focus("end");
            }
          }}
        >
          <div className="pv-zoomer" style={{ width: stageW * zoom, height: stageH * zoom }}>
            <div className="pv-stage" style={{ width: stageW, height: stageH, transform: `scale(${zoom})` }}>
              <SheetsLayer
                layout={screenLayout}
                pages={pages}
                sig={pagesSig}
                oddLeft={oddLeft}
                evenLeft={evenLeft}
                title={furnitureInfo.title}
                author={furnitureInfo.author}
              />
              <div
                className={`pv-flow ${layoutCls} kind-${kind.id}`}
                style={{
                  left: flowLeft,
                  width: layout.contentW,
                  paddingTop: layout.marginTop,
                }}
              >
                <EditorContent
                  editor={editor}
                  style={{ minHeight: Math.max(0, stageH - layout.marginTop - layout.marginBottom) }}
                />
              </div>
            </div>
          </div>
        </div>
        {showSetup && kind.id === "novel" && <PageSetupPanel onClose={() => setShowSetup(false)} />}
        {showComments && editor && !focusMode && (
          <CommentsPanel
            editor={editor}
            comentarios={comentarios}
            elementos={elementos}
            ativo={cmAtivo}
            novo={cmNovo}
            onChange={setComentarios}
            onAtivo={setCmAtivo}
            onClose={() => setShowComments(false)}
          />
        )}
        {cmCss && <style>{cmCss}</style>}
      </div>

      <div className="ed-footer">
        <span>
          {tt("Página")} {(pag?.page ?? 0) + 1} {tt("de")} {pag?.total ?? 1}
        </span>
        <span className="ed-footer-stats">{stats}</span>
        {metas?.diaria ? (
          <span className="goal" title={tt("Meta diária: {n} palavras", { n: metas.diaria.toLocaleString(locale()) })}>
            {tt("Hoje {feito}/{meta}", { feito: hojeEscritas.toLocaleString(locale()), meta: metas.diaria.toLocaleString(locale()) })}
            <span className="goal-bar">
              <span style={{ width: `${Math.min(100, (hojeEscritas / metas.diaria) * 100)}%` }} />
            </span>
          </span>
        ) : null}
        {metas?.total ? (
          <span className="goal" title={tt("Meta do projeto: {n} palavras", { n: metas.total.toLocaleString(locale()) })}>
            {tt("{n}% da meta", { n: Math.min(100, Math.round((words / metas.total) * 100)) })}
            <span className="goal-bar">
              <span style={{ width: `${Math.min(100, (words / metas.total) * 100)}%` }} />
            </span>
          </span>
        ) : null}
        <span className="ed-footer-paper">{paperLabel}</span>
      </div>

    </div>
  );
}
