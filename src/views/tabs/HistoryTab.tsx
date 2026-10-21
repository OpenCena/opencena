import { Fragment, useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/appStore";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { confirmDialog } from "@/components/Dialogs";
import { BACKUP_KIND_LABEL, BackupInfo, readBackup } from "@/domain/backup";
import { BlockDiff, countWords, diffBlocks, diffProjectAreas } from "@/domain/diff";
import { ELEMENT_LABEL, KindDef, kindOf } from "@/layout/profiles";
import { LoadedProject } from "@/types";
import { tt, locale } from "@/i18n";
import "@/styles/history.css";

const CURRENT = "__atual__";

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString(locale())} ${d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}`;
}

function Block({ d, kind }: { d: BlockDiff; kind: KindDef }) {
  const label = (t: string) => kind.blocks.find((b) => b.tipo === t)?.short ?? ELEMENT_LABEL[t as never] ?? t;
  return (
    <div className={`hd-block op-${d.op} t-${d.el.tipo}`}>
      <span className="hd-type">{label(d.el.tipo)}</span>
      <div className="hd-text">
        {d.op === "mod"
          ? d.palavras.map((w, k) =>
              w.t === "eq" ? (
                <Fragment key={k}>{w.s}</Fragment>
              ) : w.t === "add" ? (
                <ins key={k}>{w.s}</ins>
              ) : (
                <del key={k}>{w.s}</del>
              )
            )
          : d.el.texto || <span className="faint">{tt("(vazio)")}</span>}
        {d.op === "mod" && d.antes.tipo !== d.el.tipo && (
          <span className="hd-note">{tt("antes era: {tipo}", { tipo: label(d.antes.tipo).toLowerCase() })}</span>
        )}
      </div>
    </div>
  );
}

/** Painel da direita: o que mudou da versão `de` para a versão `para`. */
function ComparePanel({
  base,
  history,
  onClose,
}: {
  base: string;
  history: BackupInfo[];
  onClose: () => void;
}) {
  const cur = useApp((s) => s.current!);
  const [alvo, setAlvo] = useState(CURRENT);
  const [snaps, setSnaps] = useState<Record<string, LoadedProject>>({});
  const [soMudancas, setSoMudancas] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setAlvo(CURRENT), [base]);

  useEffect(() => {
    let vivo = true;
    const faltam = [base, alvo].filter((n) => n !== CURRENT && !snaps[n]);
    if (!faltam.length) return;
    void Promise.all(faltam.map((n) => readBackup(cur.root, n).then((s) => [n, s?.project] as const))).then((res) => {
      if (!vivo) return;
      const novo = { ...snaps };
      for (const [n, p] of res) {
        if (p) novo[n] = p;
        else setErro(tt("Não foi possível ler este backup."));
      }
      setSnaps(novo);
    });
    return () => {
      vivo = false;
    };
  }, [base, alvo]); // eslint-disable-line react-hooks/exhaustive-deps

  const antes = snaps[base];
  const depois = alvo === CURRENT ? cur.project : snaps[alvo];
  // backups mais novos que a base são "depois" naturais; mais antigos invertem
  const baseIdx = history.findIndex((h) => h.name === base);
  const alvoIdx = alvo === CURRENT ? -1 : history.findIndex((h) => h.name === alvo);
  const invertido = alvoIdx > baseIdx;
  const [A, B] = invertido ? [depois, antes] : [antes, depois];

  const blocos = useMemo(() => (A && B ? diffBlocks(A.screenplay.elementos, B.screenplay.elementos) : null), [A, B]);
  const areas = useMemo(() => (A && B ? diffProjectAreas(A, B) : []), [A, B]);

  const stats = useMemo(() => {
    const s = { add: 0, del: 0, mod: 0 };
    blocos?.forEach((b) => b.op !== "eq" && s[b.op]++);
    return s;
  }, [blocos]);

  // com "só mudanças", blocos iguais viram um contador, exceto um de contexto em volta
  const linhas = useMemo(() => {
    if (!blocos) return [];
    if (!soMudancas) return blocos.map((b) => ({ b }));
    const perto = (k: number) => (k > 0 && blocos[k - 1].op !== "eq") || (k + 1 < blocos.length && blocos[k + 1].op !== "eq");
    const out: ({ b: BlockDiff } | { pulados: number })[] = [];
    let pulados = 0;
    blocos.forEach((b, k) => {
      if (b.op === "eq" && !perto(k)) {
        pulados++;
        return;
      }
      if (pulados) out.push({ pulados });
      pulados = 0;
      out.push({ b });
    });
    if (pulados) out.push({ pulados });
    return out;
  }, [blocos, soMudancas]);

  const labelOf = (n: string) => (n === CURRENT ? tt("Versão atual") : fmt(history.find((h) => h.name === n)?.criadoEm ?? ""));
  const nomeA = invertido ? labelOf(alvo) : labelOf(base);
  const nomeB = invertido ? labelOf(base) : labelOf(alvo);

  return (
    <aside className="hd-panel">
      <div className="hd-head">
        <div className="hd-title">
          <span>{tt("Comparar versões")}</span>
          <button className="ed-tool ed-icon" onClick={onClose} title={tt("Fechar")}>
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="hd-pick">
          <span className="hd-from">{labelOf(base)}</span>
          <span className="faint">{tt("com")}</span>
          <Select
            className="sel-compact"
            ariaLabel={tt("Comparar com")}
            value={alvo}
            onChange={setAlvo}
            options={[
              { value: CURRENT, label: tt("Versão atual") },
              ...history.filter((h) => h.name !== base).map((h) => ({ value: h.name, label: fmt(h.criadoEm) })),
            ]}
          />
        </div>
        <p className="hd-dir faint">
          {tt("De")} <b>{nomeA}</b> {tt("para")} <b>{nomeB}</b>
        </p>
      </div>

      {erro && <p className="hd-empty">{erro}</p>}
      {!erro && (!A || !B) && <p className="hd-empty">{tt("Carregando…")}</p>}

      {A && B && blocos && (
        <>
          <div className="hd-stats">
            <span className="s-add">+{stats.add} {tt("inseridos")}</span>
            <span className="s-del">−{stats.del} {tt("removidos")}</span>
            <span className="s-mod">{stats.mod} {tt("alterados")}</span>
            <span className="faint">
              {countWords(A.screenplay.elementos).toLocaleString(locale())} → {countWords(B.screenplay.elementos).toLocaleString(locale())} {tt("palavras")}
            </span>
          </div>

          {areas.length > 0 && (
            <div className="hd-areas">
              {areas.map((a) => (
                <div key={a.area} className="hd-area">
                  <b>{a.area}</b>
                  {a.adicionados.length > 0 && <span className="s-add">+ {a.adicionados.join(", ")}</span>}
                  {a.removidos.length > 0 && <span className="s-del">− {a.removidos.join(", ")}</span>}
                  {a.alterados.length > 0 && <span className="s-mod">{tt("alterado: {lista}", { lista: a.alterados.join(", ") })}</span>}
                </div>
              ))}
            </div>
          )}

          <div className="hd-toggle">
            <label>
              <input type="checkbox" checked={soMudancas} onChange={(e) => setSoMudancas(e.target.checked)} />
              {tt("Mostrar só os trechos que mudaram")}
            </label>
          </div>

          <div className="hd-doc">
            {stats.add + stats.del + stats.mod === 0 ? (
              <p className="hd-empty">{tt("O texto é igual nas duas versões.")}</p>
            ) : (
              linhas.map((l, k) =>
                "pulados" in l ? (
                  <div key={k} className="hd-skip">
                    {l.pulados} {l.pulados === 1 ? tt("bloco igual") : tt("blocos iguais")}
                  </div>
                ) : (
                  <Block key={k} d={l.b} kind={kindOf(cur.project.meta)} />
                )
              )
            )}
          </div>
        </>
      )}
    </aside>
  );
}

export function HistoryTab() {
  const allHistory = useApp((s) => s.history);
  const cur = useApp((s) => s.current!);
  const kind = kindOf(cur.project.meta);
  const parte = cur.episodes.find((e) => e.id === cur.currentEpisodeId);
  // em obras em partes, cada episódio/capítulo tem o seu histórico
  const history = cur.currentEpisodeId
    ? allHistory.filter((h) => !h.episodioId || h.episodioId === cur.currentEpisodeId)
    : allHistory;
  const previewMode = useApp((s) => s.previewMode);
  const createBackup = useApp((s) => s.createBackup);
  const restoreBackup = useApp((s) => s.restoreBackup);
  const refreshHistory = useApp((s) => s.refreshHistory);
  const [busy, setBusy] = useState(false);
  const [comparando, setComparando] = useState<string | null>(null);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  async function backupNow() {
    setBusy(true);
    const ok = await createBackup("manual");
    setBusy(false);
    if (!ok) useApp.getState().setNotice(tt("Nada mudou desde o último backup."));
  }

  async function restore(name: string, criadoEm: string) {
    const ok = await confirmDialog({
      title: tt("Restaurar a versão de {data}?", { data: fmt(criadoEm) }),
      message:
        tt("O texto, a capa, a escaleta, os personagens, locais, objetos e a pesquisa voltam a ser como estavam nessa versão. Antes, o OpenCena guarda um backup do estado atual, então dá para desfazer."),
      confirmLabel: tt("Restaurar"),
      icon: "history",
    });
    if (!ok) return;
    setBusy(true);
    await restoreBackup(name);
    setBusy(false);
    setComparando(null);
  }

  return (
    <div className={`hs-wrap ${comparando ? "with-panel" : ""}`}>
      <div className="hs-list">
        <div className="hs-top">
          <h2>{tt("Histórico de versões")}</h2>
          <button className="btn" onClick={() => void backupNow()} disabled={busy || previewMode}>
            <Icon name="history" size={15} />
            {tt("Criar backup agora")}
          </button>
        </div>
        <p className="muted hs-desc">
          {tt("Backups automáticos são criados ao abrir o projeto e a cada poucos minutos enquanto você escreve. Use Comparar para ver o que mudou entre versões. Restaurar substitui o conteúdo atual, mas antes salva um backup de segurança.")}
          {parte && (
            <>
              {" "}
              {tt("Mostrando as versões de: {parte}.", { parte: parte.titulo || `${kind.partLabel} ${parte.numero}` })}
            </>
          )}
        </p>

        {previewMode && <p className="faint hs-desc">{tt("O histórico funciona apenas em projetos reais (não no modo exemplo).")}</p>}
        {!previewMode && history.length === 0 && <p className="faint hs-desc">{tt("Nenhum backup ainda.")}</p>}

        <div>
          {history.map((b, i) => {
            const d = new Date(b.criadoEm);
            return (
              <div key={b.name} className={`hs-row ${comparando === b.name ? "active" : ""}`}>
                <div style={{ fontSize: 13.5 }}>
                  {d.toLocaleDateString(locale())}{" "}
                  <span className="muted">{d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="faint hs-tag">{BACKUP_KIND_LABEL[b.tipo]}</span>
                  {i === 0 && <span className="faint hs-tag">{tt("mais recente")}</span>}
                </div>
                <span style={{ display: "flex", gap: 4 }}>
                  <button
                    className={`btn btn-ghost ${comparando === b.name ? "on" : ""}`}
                    onClick={() => setComparando(comparando === b.name ? null : b.name)}
                    disabled={busy}
                  >
                    <Icon name="columns" size={14} />
                    {tt("Comparar")}
                  </button>
                  <button className="btn btn-ghost" onClick={() => void restore(b.name, b.criadoEm)} disabled={busy}>
                    {tt("Restaurar")}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {comparando && <ComparePanel base={comparando} history={history} onClose={() => setComparando(null)} />}
    </div>
  );
}
