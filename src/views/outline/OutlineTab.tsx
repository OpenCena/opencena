// Escaleta (Estrutura, no livro): cartões em atos ligados ao documento.

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/appStore";
import { CardStatus, Outline, OutlineCard, ScreenplayElement } from "@/types";
import { newId } from "@/domain/project";
import {
  StructureTemplate,
  applyTemplate,
  detectCharacters,
  emptyCard,
  headingToSection,
  migrateCardColors,
  moveCardSection,
  plantWarnings,
  renumber,
  reorderDocByCards,
  sectionInfo,
} from "@/domain/outline";
import { SectionSize, sectionSizes } from "@/domain/outlineStats";
import { outlineTitle, outlineToDocx, outlineToPdf } from "@/domain/outlineExport";
import { sanitizeFileName } from "@/domain/export";
import { ideasToBoard } from "@/domain/migrations";
import { renumberScenes } from "@/domain/screenplay";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { Picker } from "@/components/Picker";
import { confirmDialog, noticeDialog } from "@/components/Dialogs";
import { blockDef, kindOf } from "@/layout/profiles";
import { saveToDownloads } from "@/storage/dir";
import { OutlineCardView } from "./OutlineCardView";
import { OutlineList, OutlineMatrix, OutlinePlots, SeasonView } from "./OutlineViews";
import { TemplateDialog } from "./TemplateDialog";
import { OutlineCtx, STATUS, UNASSIGNED, medida } from "./shared";
import { tt, locale } from "@/i18n";
import "@/styles/outline.css";
import "@/styles/outline-views.css";

type Vista = "cartoes" | "lista" | "tramas" | "personagens" | "temporada";
type Snapshot = { outline: Outline; elementos?: ScreenplayElement[] };

const VISTA_KEY = "opencena:escaleta-vista";

export function OutlineTab() {
  const cur = useApp((s) => s.current!);
  const previewMode = useApp((s) => s.previewMode);
  const project = cur.project;
  const outline = project.outline;
  const screenplay = project.screenplay;
  const characters = project.characters;
  const updateOutline = useApp((s) => s.updateOutline);
  const updateScreenplay = useApp((s) => s.updateScreenplay);
  const updatePesquisa = useApp((s) => s.updatePesquisa);
  const focusElement = useApp((s) => s.focusElement);
  const setNotice = useApp((s) => s.setNotice);
  const kind = kindOf(project.meta);
  const docLabel = kind.docLabel.toLowerCase();
  const serie = project.meta.formato === "serie";
  const root = previewMode ? null : cur.root;

  const { atos, cartoes } = outline;
  const tramas = outline.tramas ?? [];

  // migrações: "ideias soltas" antigas e cor da trama
  useEffect(() => {
    const soltas = cartoes.filter((c) => c.tipo === "ideia");
    let o = outline;
    if (soltas.length) {
      const agora = new Date().toISOString();
      updatePesquisa(
        ideasToBoard(
          project.pesquisa,
          soltas.map((c) => ({
            id: c.id,
            titulo: c.cabecalho,
            texto: [c.resumo, c.observacoes].filter(Boolean).join("\n\n"),
            tag: "geral" as const,
            fixada: false,
            criadaEm: agora,
          }))
        )
      );
      o = { ...o, cartoes: renumber(o.cartoes.filter((c) => c.tipo !== "ideia")) };
    }
    const comTramas = migrateCardColors(o);
    if (comTramas !== outline) updateOutline(comTramas);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // desfazer
  const pilha = useRef<Snapshot[]>([]);
  const ultimoGrupo = useRef<{ chave: string; t: number } | null>(null);
  const [, refresh] = useState(0);
  const outlineRef = useRef(outline);
  outlineRef.current = outline;
  const elementosRef = useRef(screenplay.elementos);
  elementosRef.current = screenplay.elementos;

  /** Grava a escaleta (e, se vier, o documento), guardando o estado anterior para desfazer. */
  function commit(next: Outline, opts: { elementos?: ScreenplayElement[]; agrupar?: string } = {}) {
    const agora = Date.now();
    const g = ultimoGrupo.current;
    // digitação seguida no mesmo campo vira um passo só
    const mesmo = opts.agrupar && g && g.chave === opts.agrupar && agora - g.t < 1500;
    if (!mesmo) {
      pilha.current = [...pilha.current, { outline: outlineRef.current, elementos: opts.elementos ? elementosRef.current : undefined }].slice(-80);
      refresh((n) => n + 1);
    }
    ultimoGrupo.current = opts.agrupar ? { chave: opts.agrupar, t: agora } : null;
    updateOutline({ ...next, cartoes: renumber(next.cartoes) });
    if (opts.elementos) {
      updateScreenplay({ ...useApp.getState().current!.project.screenplay, elementos: kind.id === "roteiro" ? renumberScenes(opts.elementos) : opts.elementos });
    }
  }

  function desfazer() {
    const s = pilha.current.pop();
    if (!s) return;
    ultimoGrupo.current = null;
    refresh((n) => n + 1);
    updateOutline(s.outline);
    if (s.elementos) updateScreenplay({ ...useApp.getState().current!.project.screenplay, elementos: s.elementos });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && pilha.current.length) {
        e.preventDefault();
        desfazer();
      } else if (e.key === "Escape") setSel(new Set());
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // estado da tela
  const [vista, setVista] = useState<Vista>(() => {
    try {
      return (localStorage.getItem(VISTA_KEY) as Vista) || "cartoes";
    } catch {
      return "cartoes";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(VISTA_KEY, vista);
    } catch {
      /* ignora */
    }
  }, [vista]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overAto, setOverAto] = useState<string | null>(null);
  const [overCard, setOverCard] = useState<string | null>(null);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [modelos, setModelos] = useState(false);
  const [filtros, setFiltros] = useState({ personagem: "", status: "", trama: "", etiqueta: "", local: "", periodo: "" });

  // ligação com o documento
  const infos = useMemo(() => sectionInfo(screenplay.elementos, kind.sectionType), [screenplay.elementos, kind.sectionType]);
  const titulos = useMemo(() => {
    const m = new Map<string, string>();
    let n = 0;
    screenplay.elementos.forEach((e) => {
      if (e.tipo !== kind.sectionType) return;
      n += 1;
      const t = e.texto.replace(/\n/g, " ").trim();
      m.set(e.id, kind.id === "roteiro" ? t.toUpperCase() : kind.id === "quadrinhos" ? `${tt("PÁGINA {n}", { n })}${t ? `: ${t.toUpperCase()}` : ""}` : t || tt("Capítulo {n}", { n }));
    });
    return m;
  }, [screenplay.elementos, kind]);

  // tamanho real de cada seção (medido pelo motor de paginação, com folga para não pesar)
  const [sizes, setSizes] = useState<Map<string, SectionSize> | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setSizes(sectionSizes(useApp.getState().current!.project));
      } catch {
        setSizes(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [screenplay.elementos, project.meta.pagina]); // eslint-disable-line react-hooks/exhaustive-deps

  function secaoDoCartao(c: OutlineCard) {
    if (c.elementoId && titulos.has(c.elementoId)) return c.elementoId;
    const t = c.cabecalho.trim().toUpperCase();
    if (!t) return undefined;
    for (const [id, tit] of titulos) if (tit.toUpperCase() === t) return id;
    return undefined;
  }

  function personagensDe(c: OutlineCard) {
    const out = c.personagemIds.map((id) => ({ id, auto: false }));
    const secao = secaoDoCartao(c);
    const falam = secao ? infos.get(secao)?.falam ?? [] : [];
    for (const id of detectCharacters(falam, characters)) if (!c.personagemIds.includes(id)) out.push({ id, auto: true });
    return out;
  }

  const warnings = useMemo(() => plantWarnings(cartoes), [cartoes]);

  // operações
  const setCartoes = (next: OutlineCard[], agrupar?: string) => commit({ ...outlineRef.current, cartoes: next }, { agrupar });

  function updateCard(id: string, patch: Partial<OutlineCard>, agrupar?: string) {
    setCartoes(outlineRef.current.cartoes.map((c) => (c.id === id ? { ...c, ...patch } : c)), agrupar);
  }

  /** Cabeçalho do cartão; se ligado, muda também a seção no documento. */
  function setHeading(c: OutlineCard, texto: string) {
    const secao = secaoDoCartao(c);
    const cartoesNovos = outlineRef.current.cartoes.map((x) => (x.id === c.id ? { ...x, cabecalho: texto, elementoId: secao ?? x.elementoId } : x));
    if (!secao) return setCartoes(cartoesNovos, `cab:${c.id}`);
    const elementos = elementosRef.current.map((e) => (e.id === secao ? { ...e, texto: headingToSection(kind.id, texto) } : e));
    commit({ ...outlineRef.current, cartoes: cartoesNovos }, { elementos, agrupar: `cab:${c.id}` });
  }

  function addCard(atoId: string | null) {
    setCartoes([...cartoes, emptyCard(atoId)]);
  }
  async function removeCard(id: string) {
    const c = cartoes.find((x) => x.id === id);
    if (c && (c.resumo.trim() || c.objetivo.trim() || c.conflito.trim())) {
      const ok = await confirmDialog({ title: tt("Excluir este cartão?"), message: tt("O texto no {doc} não é apagado. Ctrl+Z desfaz.", { doc: docLabel }), confirmLabel: tt("Excluir"), tone: "danger" });
      if (!ok) return;
    }
    setCartoes(cartoes.filter((x) => x.id !== id));
  }

  function addAto() {
    commit({ ...outline, atos: [...atos, { id: newId(), titulo: `Ato ${atos.length + 1}` }] });
  }
  function renameAto(id: string, titulo: string) {
    commit({ ...outline, atos: atos.map((a) => (a.id === id ? { ...a, titulo } : a)) }, { agrupar: `ato:${id}` });
  }
  async function removeAto(id: string) {
    const n = cartoes.filter((c) => c.atoId === id).length;
    if (n) {
      const ok = await confirmDialog({
        title: tt("Excluir este ato?"),
        message: tt("Os {n} cartões dele não são apagados: vão para \"Sem ato\".", { n }),
        confirmLabel: tt("Excluir ato"),
        tone: "danger",
      });
      if (!ok) return;
    }
    commit({ ...outline, atos: atos.filter((a) => a.id !== id), cartoes: cartoes.map((c) => (c.atoId === id ? { ...c, atoId: null } : c)) });
  }
  function moveAto(id: string, dir: -1 | 1) {
    const i = atos.findIndex((a) => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= atos.length) return;
    const next = [...atos];
    [next[i], next[j]] = [next[j], next[i]];
    const ordem = new Map(next.map((a, k) => [a.id, k]));
    const sorted = [...cartoes].sort((a, b) => (ordem.get(a.atoId ?? "") ?? 1e9) - (ordem.get(b.atoId ?? "") ?? 1e9));
    commit({ ...outline, atos: next, cartoes: sorted }, outline.ordemLigada ? { elementos: reorderDocByCards(elementosRef.current, kind.sectionType, sorted) } : {});
  }
  function semAtoParaAto() {
    const id = newId();
    commit({
      ...outline,
      atos: [...atos, { id, titulo: `Ato ${atos.length + 1}` }],
      cartoes: cartoes.map((c) => ((c.atoId ?? null) === null || !atos.some((a) => a.id === c.atoId) ? { ...c, atoId: id } : c)),
    });
  }

  // documento <-> cartões
  function importFromScreenplay() {
    const ligados = new Set(cartoes.map(secaoDoCartao).filter(Boolean));
    const novos = [...titulos.entries()]
      .filter(([id]) => !ligados.has(id))
      .map(([id, titulo]) => ({ ...emptyCard(null), cabecalho: titulo, elementoId: id }));
    const atualizados = cartoes.map((c) => (c.elementoId ? c : { ...c, elementoId: secaoDoCartao(c) }));
    setCartoes([...atualizados, ...novos]);
    void noticeDialog({
      title: novos.length ? (novos.length === 1 ? tt("1 cartão criado") : tt("{n} cartões criados", { n: novos.length })) : tt("Nada novo para importar"),
      message: novos.length
        ? tt("Cada parte do {doc} virou um cartão em \"Sem ato\".", { doc: docLabel })
        : tt("Tudo o que está no {doc} já tem cartão.", { doc: docLabel }),
      icon: "layoutList",
    });
  }

  function sectionFor(c: OutlineCard): ScreenplayElement[] {
    const body = blockDef(kind, kind.sectionType).enter;
    let texto = headingToSection(kind.id, c.cabecalho.trim());
    if (kind.id === "novel" && !texto) texto = tt("Capítulo {n}", { n: c.numero });
    return [
      { id: newId(), tipo: kind.sectionType, texto },
      { id: newId(), tipo: body, texto: "" },
    ];
  }

  function enviarParaDocumento(alvo: OutlineCard[]) {
    let els = [...elementosRef.current];
    const ordem = renumber(cartoes);
    const ligacoes = new Map<string, string>();
    for (const c of alvo) {
      const novos = sectionFor(c);
      ligacoes.set(c.id, novos[0].id);
      const idx = ordem.findIndex((x) => x.id === c.id);
      const doc = (x: OutlineCard) => ligacoes.get(x.id) ?? secaoDoCartao(x);
      let depoisDe: string | undefined;
      for (let k = idx - 1; k >= 0 && !depoisDe; k--) depoisDe = doc(ordem[k]);
      let antesDe: string | undefined;
      if (!depoisDe) for (let k = idx + 1; k < ordem.length && !antesDe; k++) antesDe = doc(ordem[k]);
      let pos = els.length;
      const i = els.findIndex((e) => e.id === (depoisDe ?? antesDe));
      if (i >= 0 && depoisDe) {
        pos = els.findIndex((e, k) => k > i && e.tipo === kind.sectionType);
        if (pos < 0) pos = els.length;
      } else if (i >= 0) pos = i;
      els = [...els.slice(0, pos), ...novos, ...els.slice(pos)];
    }
    if (els.length > 1 && !els[0].texto.trim() && els[0].tipo !== kind.sectionType && !elementosRef.current.some((e) => e.texto.trim())) els = els.slice(1);
    commit({ ...outline, cartoes: cartoes.map((c) => (ligacoes.has(c.id) ? { ...c, elementoId: ligacoes.get(c.id) } : c)) }, { elementos: els });
    return ligacoes;
  }

  async function enviarTodos() {
    const faltam = renumber(cartoes).filter((c) => !secaoDoCartao(c));
    if (!faltam.length) {
      void noticeDialog({ title: tt("Tudo já está no documento"), message: tt("Todos os cartões já têm correspondente no {doc}.", { doc: docLabel }), icon: "check" });
      return;
    }
    const ok = await confirmDialog({
      title: faltam.length === 1 ? tt("Levar 1 cartão para o {doc}?", { doc: docLabel }) : tt("Levar {n} cartões para o {doc}?", { n: faltam.length, doc: docLabel }),
      message: tt("Cada cartão sem correspondente vira um bloco de {bloco} no {doc}, na ordem da escaleta. Nada do que já está escrito é apagado.", { bloco: blockDef(kind, kind.sectionType).label.toLowerCase(), doc: docLabel }),
      confirmLabel: tt("Levar para o documento"),
      icon: "fileText",
    });
    if (ok) enviarParaDocumento(faltam);
  }

  async function alternarOrdemLigada() {
    if (outline.ordemLigada) {
      commit({ ...outline, ordemLigada: false });
      return;
    }
    const ok = await confirmDialog({
      title: tt("Ligar a ordem dos cartões ao {doc}?", { doc: docLabel }),
      message: tt("Ao mover um cartão, a parte correspondente muda de lugar no {doc}, com tudo o que estiver escrito. O {doc} já passa a seguir a ordem atual dos cartões. Ctrl+Z (ou Desfazer) volta.", { doc: docLabel }),
      confirmLabel: tt("Ligar"),
      icon: "layers",
    });
    if (!ok) return;
    commit({ ...outline, ordemLigada: true }, { elementos: reorderDocByCards(elementosRef.current, kind.sectionType, cartoes) });
  }

  // arrastar
  function reset() {
    setDragId(null);
    setOverAto(null);
    setOverCard(null);
  }
  function drop(targetLane: string) {
    const atoId = targetLane === UNASSIGNED ? null : targetLane;
    // arrasta a seleção inteira quando o cartão faz parte dela
    const ids = dragId && sel.has(dragId) ? cartoes.filter((c) => sel.has(c.id)).map((c) => c.id) : dragId ? [dragId] : [];
    if (!ids.length) return reset();
    const movidos = cartoes.filter((c) => ids.includes(c.id)).map((c) => ({ ...c, atoId }));
    let rest = cartoes.filter((c) => !ids.includes(c.id));
    if (overCard && !ids.includes(overCard)) {
      const idx = rest.findIndex((c) => c.id === overCard);
      rest = idx < 0 ? [...rest, ...movidos] : [...rest.slice(0, idx), ...movidos, ...rest.slice(idx)];
    } else {
      let lastIdx = -1;
      rest.forEach((c, i) => {
        if ((c.atoId ?? null) === atoId) lastIdx = i;
      });
      rest = [...rest.slice(0, lastIdx + 1), ...movidos, ...rest.slice(lastIdx + 1)];
    }
    if (outline.ordemLigada) {
      let els = elementosRef.current;
      for (const m of movidos) els = moveCardSection(els, kind.sectionType, rest, m.id);
      const mudou = els !== elementosRef.current;
      commit({ ...outline, cartoes: rest }, mudou ? { elementos: els } : {});
      if (mudou) setNotice(movidos.length > 1 ? tt("Partes movidas no {doc}. Ctrl+Z desfaz.", { doc: docLabel }) : tt("Parte movida no {doc}. Ctrl+Z desfaz.", { doc: docLabel }));
    } else commit({ ...outline, cartoes: rest });
    reset();
  }

  // seleção múltipla
  function toggleSel(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function emLote(patch: (c: OutlineCard) => Partial<OutlineCard>) {
    setCartoes(cartoes.map((c) => (sel.has(c.id) ? { ...c, ...patch(c) } : c)));
  }
  async function excluirSelecao() {
    const ok = await confirmDialog({ title: tt("Excluir {n} cartões?", { n: sel.size }), message: tt("O texto no {doc} não é apagado. Ctrl+Z desfaz.", { doc: docLabel }), confirmLabel: tt("Excluir"), tone: "danger" });
    if (!ok) return;
    setCartoes(cartoes.filter((c) => !sel.has(c.id)));
    setSel(new Set());
  }

  // filtros
  const etiquetas = useMemo(() => [...new Set(cartoes.flatMap((c) => c.etiquetas ?? []))].sort(), [cartoes]);
  const locais = useMemo(() => [...new Set([...infos.values()].map((i) => i.local).filter(Boolean))].sort(), [infos]);
  const periodos = useMemo(() => [...new Set([...infos.values()].map((i) => i.periodo).filter(Boolean))].sort(), [infos]);
  const filtrando = Object.values(filtros).some(Boolean);
  function passa(c: OutlineCard) {
    if (!filtrando) return true;
    const info = (() => {
      const s = secaoDoCartao(c);
      return s ? infos.get(s) : undefined;
    })();
    return (
      (!filtros.personagem || personagensDe(c).some((p) => p.id === filtros.personagem)) &&
      (!filtros.status || (c.status ?? "afazer") === filtros.status) &&
      (!filtros.trama || (filtros.trama === "-" ? !c.tramaId : c.tramaId === filtros.trama)) &&
      (!filtros.etiqueta || (c.etiquetas ?? []).includes(filtros.etiqueta)) &&
      (!filtros.local || info?.local === filtros.local) &&
      (!filtros.periodo || info?.periodo === filtros.periodo)
    );
  }

  // exportar
  async function exportar(fmt: "pdf" | "docx") {
    const p = useApp.getState().current!.project;
    const nome = `${sanitizeFileName(outlineTitle(p))}.${fmt}`;
    const blob = fmt === "pdf" ? outlineToPdf(p) : outlineToDocx(p);
    const onde = await saveToDownloads(nome, blob);
    setNotice(tt("{arquivo} salvo em {onde}.", { arquivo: nome, onde }));
  }

  // números gerais
  const total = cartoes.length;
  const prontos = cartoes.filter((c) => c.status === "pronto").length;
  const escrevendo = cartoes.filter((c) => c.status === "escrevendo").length;
  const semAto = cartoes.filter((c) => (c.atoId ?? null) === null || !atos.some((a) => a.id === c.atoId));
  const lanes: { id: string; titulo: string | null }[] = [
    ...atos.map((a) => ({ id: a.id, titulo: a.titulo })),
    ...(semAto.length || atos.length === 0 || dragId ? [{ id: UNASSIGNED, titulo: null }] : []),
  ];
  const medidaDoAto = (cards: OutlineCard[]) =>
    cards.reduce((n, c) => {
      const s = secaoDoCartao(c);
      return n + (s ? medida(kind.id, sizes?.get(s)) : 0);
    }, 0);
  const totalMedida = lanes.reduce((n, l) => n + medidaDoAto(l.id === UNASSIGNED ? semAto : cartoes.filter((c) => c.atoId === l.id)), 0);
  const unidade = (v: number) =>
    kind.id === "novel"
      ? tt("{n} palavras", { n: Math.round(v).toLocaleString(locale()) })
      : `${tt("{n} pág", { n: v.toLocaleString(locale(), { maximumFractionDigits: 1 }) })}${kind.id === "roteiro" ? ` · ~${Math.round(v)} min` : ""}`;

  const ctx: OutlineCtx = {
    kind,
    outline,
    cartoes,
    atos,
    tramas,
    characters,
    elementos: screenplay.elementos,
    root,
    secaoDoCartao,
    tituloSecao: (id) => titulos.get(id) ?? "",
    infos,
    sizes,
    personagensDe,
    warnings,
    passa,
    sel,
    toggleSel: (id) => toggleSel(id),
    updateCard,
    setHeading,
    commit,
    removeCard: (id) => void removeCard(id),
    abrir: (c) => {
      const s = secaoDoCartao(c);
      if (s) focusElement(s);
    },
    criarNoDoc: (c) => {
      const id = enviarParaDocumento([c]).get(c.id);
      if (id) focusElement(id);
    },
    docLabel,
  };

  const VISTAS: { id: Vista; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
    { id: "cartoes", label: tt("Cartões"), icon: "grid" },
    { id: "lista", label: tt("Lista"), icon: "list" },
    { id: "tramas", label: tt("Tramas"), icon: "layers" },
    { id: "personagens", label: tt("Personagens"), icon: "matrix" },
    ...(serie ? [{ id: "temporada" as Vista, label: tt("Temporada"), icon: "history" as const }] : []),
  ];

  return (
    <div className="outline-wrap">
      <div className="outline-bar">
        <button className="btn btn-primary" onClick={() => addCard(atos.length ? atos[atos.length - 1].id : null)}>
          <Icon name="plus" size={15} />
          {tt("Novo cartão")}
        </button>
        <button className="btn" onClick={addAto}>
          <Icon name="layoutList" size={15} />
          {tt("Novo ato")}
        </button>
        <button className="btn btn-ghost" onClick={() => setModelos(true)} title={tt("Três atos, Save the Cat, Jornada do Herói…")}>
          <Icon name="layers" size={15} />
          {tt("Modelos")}
        </button>
        <span className="ol-sep" />
        <button className="btn btn-ghost" onClick={importFromScreenplay} title={tt("Cria um cartão para cada parte do {doc}", { doc: docLabel })}>
          <Icon name="download" size={15} />
          {tt("Trazer do {doc}", { doc: docLabel })}
        </button>
        <button className="btn btn-ghost" onClick={() => void enviarTodos()} title={tt("Cria no {doc} os cartões que ainda não estão lá", { doc: docLabel })}>
          <Icon name="upload" size={15} />
          {tt("Levar para o {doc}", { doc: docLabel })}
        </button>
        <button
          className={`btn btn-ghost ol-link ${outline.ordemLigada ? "on" : ""}`}
          onClick={() => void alternarOrdemLigada()}
          title={outline.ordemLigada ? tt("A ordem dos cartões manda na ordem do {doc}. Clique para desligar.", { doc: docLabel }) : tt("Fazer o {doc} seguir a ordem dos cartões", { doc: docLabel })}
        >
          <Icon name="link" size={15} />
          {outline.ordemLigada ? tt("Ordem ligada") : tt("Ligar ordem")}
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={desfazer} disabled={!pilha.current.length} title={tt("Desfazer (Ctrl+Z)")}>
          <Icon name="undo" size={15} />
        </button>
        <Picker
          className="btnlike"
          align="right"
          options={[
            { value: "pdf", label: tt("PDF") },
            { value: "docx", label: tt("Word (.docx)") },
          ]}
          onPick={(v) => void exportar(v as "pdf" | "docx")}
          placeholder={tt("Formato")}
        >
          <Icon name="download" size={14} />
          {tt("Exportar")}
        </Picker>
      </div>

      <div className="ol-views">
        <div className="seg seg-sm">
          {VISTAS.map((v) => (
            <button key={v.id} className={`seg-opt ${vista === v.id ? "active" : ""}`} onClick={() => setVista(v.id)}>
              <span className="seg-label">
                <Icon name={v.icon} size={13} />
                {v.label}
              </span>
            </button>
          ))}
        </div>
        {vista !== "temporada" && (
          <div className="ol-filters">
            <span className="faint">{tt("Filtrar:")}</span>
            {characters.length > 0 && (
              <Select
                className="sel-compact ol-f"
                ariaLabel={tt("Personagem")}
                value={filtros.personagem}
                onChange={(v) => setFiltros({ ...filtros, personagem: v })}
                options={[{ value: "", label: tt("Personagem") }, ...characters.map((c) => ({ value: c.id, label: c.nome || tt("Sem nome") }))]}
              />
            )}
            <Select
              className="sel-compact ol-f"
              ariaLabel={tt("Andamento")}
              value={filtros.status}
              onChange={(v) => setFiltros({ ...filtros, status: v })}
              options={[{ value: "", label: tt("Andamento") }, ...STATUS.map((s) => ({ value: s.id, label: s.label }))]}
            />
            {tramas.length > 0 && (
              <Select
                className="sel-compact ol-f"
                ariaLabel={tt("Trama")}
                value={filtros.trama}
                onChange={(v) => setFiltros({ ...filtros, trama: v })}
                options={[{ value: "", label: tt("Trama") }, ...tramas.map((t) => ({ value: t.id, label: t.nome })), { value: "-", label: tt("Sem trama") }]}
              />
            )}
            {etiquetas.length > 0 && (
              <Select
                className="sel-compact ol-f"
                ariaLabel={tt("Etiqueta")}
                value={filtros.etiqueta}
                onChange={(v) => setFiltros({ ...filtros, etiqueta: v })}
                options={[{ value: "", label: tt("Etiqueta") }, ...etiquetas.map((t) => ({ value: t, label: t }))]}
              />
            )}
            {locais.length > 0 && (
              <Select
                className="sel-compact ol-f"
                ariaLabel={tt("Local")}
                value={filtros.local}
                onChange={(v) => setFiltros({ ...filtros, local: v })}
                options={[{ value: "", label: tt("Local") }, ...locais.map((t) => ({ value: t, label: t }))]}
              />
            )}
            {periodos.length > 0 && (
              <Select
                className="sel-compact ol-f"
                ariaLabel={tt("Dia ou noite")}
                value={filtros.periodo}
                onChange={(v) => setFiltros({ ...filtros, periodo: v })}
                options={[{ value: "", label: tt("Dia/noite") }, ...periodos.map((t) => ({ value: t, label: t }))]}
              />
            )}
            {filtrando && (
              <button className="btn btn-ghost card-mini-btn" onClick={() => setFiltros({ personagem: "", status: "", trama: "", etiqueta: "", local: "", periodo: "" })}>
                {tt("Limpar")}
              </button>
            )}
          </div>
        )}
      </div>

      {total > 0 && vista !== "temporada" && (
        <div className="ol-summary">
          <div className="ol-progress" title={tt("{prontos} prontos, {escrevendo} escrevendo, {afazer} a fazer", { prontos, escrevendo, afazer: total - prontos - escrevendo })}>
            <div className="ol-progress-bar">
              <span className="p-pronto" style={{ width: `${(prontos / total) * 100}%` }} />
              <span className="p-escrevendo" style={{ width: `${(escrevendo / total) * 100}%` }} />
            </div>
            <span>
              {escrevendo
                ? tt("{prontos} de {total} prontos, {escrevendo} escrevendo", { prontos, total, escrevendo })
                : tt("{prontos} de {total} prontos", { prontos, total })}
            </span>
          </div>
          {totalMedida > 0 && lanes.length > 1 && (
            <div className="ol-balance" title={tt("Tamanho de cada ato no texto")}>
              {lanes.map((l, i) => {
                const v = medidaDoAto(l.id === UNASSIGNED ? semAto : cartoes.filter((c) => c.atoId === l.id));
                if (!v) return null;
                const pct = (v / totalMedida) * 100;
                return (
                  <span key={l.id} className={`ol-balance-seg s${i % 4}`} style={{ width: `${pct}%` }} title={`${l.titulo ?? tt("Sem ato")}: ${unidade(v)} (${Math.round(pct)}%)`}>
                    {pct > 9 && `${l.titulo ?? tt("Sem ato")} ${Math.round(pct)}%`}
                  </span>
                );
              })}
            </div>
          )}
          {warnings.length > 0 && (
            <span className="ol-warn" title={warnings.map((w) => w.texto).join("\n")}>
              <Icon name="alert" size={13} />
              {warnings.length} {warnings.length === 1 ? tt("plantio sem retorno") : tt("plantios sem retorno")}
            </span>
          )}
        </div>
      )}

      {sel.size > 0 && (
        <div className="ol-bulk">
          <span>
            <b>{sel.size}</b> {sel.size === 1 ? tt("selecionado") : tt("selecionados")}
          </span>
          <Select
            className="sel-compact ol-f"
            ariaLabel={tt("Mover para o ato")}
            value=""
            onChange={(v) => emLote(() => ({ atoId: v === UNASSIGNED ? null : v }))}
            options={[{ value: "", label: tt("Mover para…") }, ...atos.map((a) => ({ value: a.id, label: a.titulo || tt("Ato") })), { value: UNASSIGNED, label: tt("Sem ato") }]}
          />
          <Select
            className="sel-compact ol-f"
            ariaLabel={tt("Andamento")}
            value=""
            onChange={(v) => v && emLote(() => ({ status: v as CardStatus }))}
            options={[{ value: "", label: tt("Andamento…") }, ...STATUS.map((s) => ({ value: s.id, label: s.label }))]}
          />
          {tramas.length > 0 && (
            <Select
              className="sel-compact ol-f"
              ariaLabel={tt("Trama")}
              value=""
              onChange={(v) => emLote(() => ({ tramaId: v === "-" ? undefined : v }))}
              options={[{ value: "", label: tt("Trama…") }, ...tramas.map((t) => ({ value: t.id, label: t.nome })), { value: "-", label: tt("Sem trama") }]}
            />
          )}
          <button className="btn btn-ghost card-mini-btn" onClick={() => void excluirSelecao()}>
            <Icon name="trash" size={13} />
            {tt("Excluir")}
          </button>
          <button className="btn btn-ghost card-mini-btn" onClick={() => setSel(new Set())}>
            {tt("Limpar seleção")}
          </button>
        </div>
      )}

      {vista === "lista" && <OutlineList ctx={ctx} />}
      {vista === "tramas" && <OutlinePlots ctx={ctx} />}
      {vista === "personagens" && <OutlineMatrix ctx={ctx} />}
      {vista === "temporada" && <SeasonView />}

      {vista === "cartoes" &&
        lanes.map((lane, li) => {
          const laneCards = lane.id === UNASSIGNED ? semAto : cartoes.filter((c) => c.atoId === lane.id);
          const recolhido = recolhidos.has(lane.id);
          const laneProntos = laneCards.filter((c) => c.status === "pronto").length;
          const v = medidaDoAto(laneCards);
          return (
            <div
              key={lane.id}
              className={`lane ${overAto === lane.id ? "drop-active" : ""} ${lane.titulo === null ? "lane-none" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverAto(lane.id);
                setOverCard(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(lane.id);
              }}
            >
              <div className="lane-head">
                <button
                  className="lane-fold"
                  onClick={() =>
                    setRecolhidos((s) => {
                      const n = new Set(s);
                      if (n.has(lane.id)) n.delete(lane.id);
                      else n.add(lane.id);
                      return n;
                    })
                  }
                  title={recolhido ? tt("Mostrar cartões") : tt("Recolher")}
                >
                  <Icon name={recolhido ? "chevronLeft" : "chevronDown"} size={14} />
                </button>
                {lane.titulo !== null ? (
                  <input className="lane-title" value={lane.titulo} placeholder={tt("Nome do ato")} onChange={(e) => renameAto(lane.id, e.target.value)} />
                ) : (
                  <span className="lane-title" style={{ color: "var(--text-faint)" }}>
                    {tt("Sem ato")}
                  </span>
                )}
                <span className="lane-count">
                  {laneCards.length} {laneCards.length === 1 ? tt("cartão") : tt("cartões")}
                  {laneProntos > 0 ? `, ${laneProntos === 1 ? tt("1 pronto") : tt("{n} prontos", { n: laneProntos })}` : ""}
                  {v > 0 ? ` · ${unidade(v)}` : ""}
                </span>
                {lane.titulo === null && laneCards.length > 0 && (
                  <button className="btn btn-ghost lane-btn" onClick={semAtoParaAto} title={tt("Cria um ato com estes cartões")}>
                    <Icon name="layoutList" size={13} />
                    {tt("Transformar em ato")}
                  </button>
                )}
                {lane.titulo !== null && (
                  <>
                    <button className="icon-btn lane-ic" title={tt("Subir ato")} disabled={li === 0} onClick={() => moveAto(lane.id, -1)}>
                      <Icon name="arrowUp" size={13} />
                    </button>
                    <button className="icon-btn lane-ic" title={tt("Descer ato")} disabled={li === atos.length - 1} onClick={() => moveAto(lane.id, 1)}>
                      <Icon name="arrowDown" size={13} />
                    </button>
                  </>
                )}
                <button className="icon-btn lane-ic" title={tt("Adicionar cartão nesta faixa")} onClick={() => addCard(lane.id === UNASSIGNED ? null : lane.id)}>
                  <Icon name="plus" size={14} />
                </button>
                {lane.titulo !== null && (
                  <button className="icon-btn danger lane-ic" title={tt("Excluir ato (mantém os cartões)")} onClick={() => void removeAto(lane.id)}>
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
              {!recolhido && (
                <div className="lane-body">
                  {laneCards.length === 0 && <span className="lane-empty">{tt("Arraste cartões para cá")}</span>}
                  {laneCards.map((card) => (
                    <OutlineCardView
                      key={card.id}
                      ctx={ctx}
                      card={card}
                      dragging={dragId === card.id || (!!dragId && sel.has(dragId) && sel.has(card.id))}
                      insertBefore={overCard === card.id && dragId !== card.id}
                      onOver={() => {
                        setOverAto(lane.id);
                        setOverCard(card.id);
                      }}
                      onDragStart={() => setDragId(card.id)}
                      onDragEnd={reset}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

      {cartoes.length === 0 && vista === "cartoes" && (
        <div className="ol-start">
          <p>
            {kind.id === "novel"
              ? tt("Planeje os capítulos em cartões, organize em atos e arraste para mudar a ordem.")
              : kind.id === "quadrinhos"
                ? tt("Planeje as páginas em cartões, organize em atos e arraste para mudar a ordem.")
                : tt("Planeje as cenas em cartões, organize em atos e arraste para mudar a ordem.")}
          </p>
          <div className="ol-start-acts">
            <button className="btn btn-primary" onClick={() => setModelos(true)}>
              <Icon name="layers" size={15} />
              {tt("Começar com um modelo")}
            </button>
            {titulos.size > 0 && (
              <button className="btn" onClick={importFromScreenplay}>
                <Icon name="download" size={15} />
                {tt("Trazer do {doc}", { doc: docLabel })}
              </button>
            )}
          </div>
        </div>
      )}

      {modelos && (
        <TemplateDialog
          tipo={kind.id}
          onClose={() => setModelos(false)}
          onPick={(t: StructureTemplate) => {
            commit(applyTemplate(outline, t));
            setModelos(false);
            setVista("cartoes");
          }}
        />
      )}
    </div>
  );
}
