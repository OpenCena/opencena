import { useMemo, useState } from "react";
import { useApp } from "@/store/appStore";
import { OutlineCard, Trama } from "@/types";
import { newId } from "@/domain/project";
import { TRAMA_CORES } from "@/domain/outline";
import { Icon } from "@/components/Icon";
import { OutlineCtx, STATUS, nextStatus, tamanhoLabel } from "./shared";
import { tt } from "@/i18n";

const label = (ctx: OutlineCtx) => (ctx.kind.id === "novel" ? tt("Capítulo") : ctx.kind.id === "quadrinhos" ? tt("Página") : tt("Cena"));

// lista compacta
export function OutlineList({ ctx }: { ctx: OutlineCtx }) {
  const grupos = useMemo(() => {
    const out: { titulo: string; cards: OutlineCard[] }[] = ctx.atos.map((a) => ({ titulo: a.titulo, cards: ctx.cartoes.filter((c) => c.atoId === a.id) }));
    const semAto = ctx.cartoes.filter((c) => !c.atoId || !ctx.atos.some((a) => a.id === c.atoId));
    if (semAto.length) out.push({ titulo: tt("Sem ato"), cards: semAto });
    return out;
  }, [ctx.atos, ctx.cartoes]);
  const nomes = new Map(ctx.characters.map((c) => [c.id, c.nome]));
  const tramas = new Map(ctx.tramas.map((t) => [t.id, t]));
  return (
    <div className="ol-table-wrap">
      <table className="ol-table">
        <thead>
          <tr>
            <th className="n">#</th>
            <th>{label(ctx)}</th>
            <th>{tt("Resumo")}</th>
            <th>{tt("Andamento")}</th>
            <th>{tt("Trama")}</th>
            <th>{tt("Personagens")}</th>
            <th className="r">{tt("Tamanho")}</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <GroupRows key={g.titulo} titulo={g.titulo} cards={g.cards} ctx={ctx} nomes={nomes} tramas={tramas} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  titulo,
  cards,
  ctx,
  nomes,
  tramas,
}: {
  titulo: string;
  cards: OutlineCard[];
  ctx: OutlineCtx;
  nomes: Map<string, string>;
  tramas: Map<string, Trama>;
}) {
  return (
    <>
      <tr className="ol-group">
        <td colSpan={7}>
          {titulo} <span className="faint">({cards.length})</span>
        </td>
      </tr>
      {cards.map((c) => {
        const secao = ctx.secaoDoCartao(c);
        const t = c.tramaId ? tramas.get(c.tramaId) : undefined;
        const status = c.status ?? "afazer";
        return (
          <tr key={c.id} className={`${ctx.passa(c) ? "" : "dim"} ${ctx.sel.has(c.id) ? "selected" : ""}`} onClick={(e) => (e.shiftKey || e.ctrlKey || e.metaKey) && ctx.toggleSel(c.id, true)}>
            <td className="n">{c.numero}</td>
            <td className="head">
              <input
                value={secao ? ctx.tituloSecao(secao) : c.cabecalho}
                onChange={(e) => ctx.setHeading(c, ctx.kind.id === "novel" ? e.target.value : e.target.value.toUpperCase())}
                placeholder={tt("Sem cabeçalho")}
              />
            </td>
            <td>
              <input value={c.resumo} onChange={(e) => ctx.updateCard(c.id, { resumo: e.target.value }, `resumo:${c.id}`)} placeholder={tt("Resumo")} />
            </td>
            <td>
              <button className={`card-status st-${status}`} onClick={() => ctx.updateCard(c.id, { status: nextStatus(c.status) })}>
                {STATUS.find((s) => s.id === status)!.label}
              </button>
            </td>
            <td>
              {t && (
                <span className="card-trama" style={{ "--trama": t.cor } as React.CSSProperties}>
                  <span className="card-trama-dot" />
                  {t.nome}
                </span>
              )}
            </td>
            <td className="faint">
              {ctx
                .personagensDe(c)
                .map((p) => nomes.get(p.id))
                .filter(Boolean)
                .join(", ")}
            </td>
            <td className="r faint">
              {secao ? tamanhoLabel(ctx.kind.id, ctx.sizes?.get(secao)) : ""}
              {secao && (
                <button className="card-doc" onClick={() => ctx.abrir(c)} title={tt("Abrir no {doc}", { doc: ctx.docLabel })}>
                  <Icon name="external" size={12} />
                </button>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// tramas: faixas com as cenas de cada linha narrativa
export function OutlinePlots({ ctx }: { ctx: OutlineCtx }) {
  function setTramas(tramas: Trama[]) {
    ctx.commit({ ...ctx.outline, tramas }, { agrupar: "tramas" });
  }
  function nova() {
    const usadas = new Set(ctx.tramas.map((t) => t.cor));
    const cor = TRAMA_CORES.find((c) => !usadas.has(c)) ?? TRAMA_CORES[ctx.tramas.length % TRAMA_CORES.length];
    ctx.commit({ ...ctx.outline, tramas: [...ctx.tramas, { id: newId(), nome: tt("Trama {letra}", { letra: String.fromCharCode(65 + ctx.tramas.length) }), cor }] });
  }
  function remover(t: Trama) {
    ctx.commit({
      ...ctx.outline,
      tramas: ctx.tramas.filter((x) => x.id !== t.id),
      cartoes: ctx.cartoes.map((c) => (c.tramaId === t.id ? { ...c, tramaId: undefined } : c)),
    });
  }
  const linhas = [...ctx.tramas.map((t) => ({ t, id: t.id })), { t: null as Trama | null, id: "" }];
  return (
    <div className="ol-plots">
      <div className="ol-plots-head">
        <p className="faint">{tt("Cada trama é uma linha narrativa (romance, investigação…). Veja como elas se intercalam ao longo da história.")}</p>
        <button className="btn" onClick={nova}>
          <Icon name="plus" size={14} />
          {tt("Nova trama")}
        </button>
      </div>
      <div className="ol-plots-grid" style={{ gridTemplateColumns: `200px repeat(${Math.max(1, ctx.cartoes.length)}, minmax(36px, 1fr))` }}>
        <div className="ol-plots-corner" />
        {ctx.cartoes.map((c) => (
          <div key={c.id} className="ol-plots-col" title={c.cabecalho || c.resumo}>
            {c.numero}
          </div>
        ))}
        {linhas.map(({ t, id }) => (
          <PlotRow key={id || "sem"} ctx={ctx} trama={t} onRename={(nome) => t && setTramas(ctx.tramas.map((x) => (x.id === t.id ? { ...x, nome } : x)))} onColor={(cor) => t && setTramas(ctx.tramas.map((x) => (x.id === t.id ? { ...x, cor } : x)))} onRemove={() => t && remover(t)} />
        ))}
      </div>
      {ctx.cartoes.length === 0 && <p className="ol-hint">{tt("Crie cartões para ver as tramas.")}</p>}
    </div>
  );
}

function PlotRow({
  ctx,
  trama,
  onRename,
  onColor,
  onRemove,
}: {
  ctx: OutlineCtx;
  trama: Trama | null;
  onRename: (n: string) => void;
  onColor: (c: string) => void;
  onRemove: () => void;
}) {
  const [cores, setCores] = useState(false);
  return (
    <>
      <div className="ol-plots-name" style={trama ? ({ "--trama": trama.cor } as React.CSSProperties) : undefined}>
        {trama ? (
          <>
            <button className="card-trama-dot big" onClick={() => setCores((v) => !v)} title={tt("Cor")} />
            <input value={trama.nome} onChange={(e) => onRename(e.target.value)} />
            <button className="icon-btn card-ic" onClick={onRemove} title={tt("Excluir trama")}>
              <Icon name="x" size={12} />
            </button>
            {cores && (
              <div className="ol-colors">
                {TRAMA_CORES.map((c) => (
                  <button
                    key={c}
                    className="card-swatch"
                    style={{ background: c }}
                    onClick={() => {
                      onColor(c);
                      setCores(false);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <span className="faint">{tt("Sem trama")}</span>
        )}
      </div>
      {ctx.cartoes.map((c) => {
        const aqui = (c.tramaId ?? "") === (trama?.id ?? "");
        return (
          <button
            key={c.id}
            className={`ol-plots-cell ${aqui ? "on" : ""}`}
            style={trama ? ({ "--trama": trama.cor } as React.CSSProperties) : undefined}
            title={`${label(ctx)} ${c.numero}${c.cabecalho ? `: ${c.cabecalho}` : ""}${c.resumo ? `\n${c.resumo}` : ""}`}
            onClick={() => ctx.updateCard(c.id, { tramaId: trama ? (aqui ? undefined : trama.id) : undefined })}
          />
        );
      })}
    </>
  );
}

// personagens x cenas
export function OutlineMatrix({ ctx }: { ctx: OutlineCtx }) {
  const linhas = useMemo(() => {
    return ctx.characters
      .map((p) => {
        const presente = ctx.cartoes.map((c) => ctx.personagensDe(c).find((x) => x.id === p.id));
        const idx = presente.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
        // maior ausência entre duas aparições
        let gap = { tam: 0, de: 0, ate: 0 };
        for (let k = 1; k < idx.length; k++) {
          const tam = idx[k] - idx[k - 1] - 1;
          if (tam > gap.tam) gap = { tam, de: ctx.cartoes[idx[k - 1]].numero, ate: ctx.cartoes[idx[k]].numero };
        }
        return { p, presente, total: idx.length, gap };
      })
      .sort((a, b) => b.total - a.total);
  }, [ctx]);
  const limiar = Math.max(4, Math.round(ctx.cartoes.length / 4));
  if (!ctx.characters.length) return <p className="ol-hint">{tt("Cadastre personagens (aba Personagens) para ver em quais cenas cada um aparece.")}</p>;
  return (
    <div className="ol-matrix-wrap">
      <p className="faint ol-matrix-note">
        {tt("Ponto cheio: marcado no cartão. Ponto vazado: aparece no trecho ligado (detectado no {doc}). Clique para marcar ou desmarcar.", { doc: ctx.docLabel })}
      </p>
      <div className="ol-matrix" style={{ gridTemplateColumns: `180px repeat(${Math.max(1, ctx.cartoes.length)}, 28px) auto` }}>
        <div />
        {ctx.cartoes.map((c) => (
          <div key={c.id} className="ol-matrix-col" title={c.cabecalho || c.resumo}>
            {c.numero}
          </div>
        ))}
        <div />
        {linhas.map(({ p, presente, total, gap }) => (
          <MatrixRow key={p.id} ctx={ctx} nome={p.nome || tt("Sem nome")} id={p.id} presente={presente} total={total} gap={gap} alerta={gap.tam >= limiar} />
        ))}
      </div>
    </div>
  );
}

function MatrixRow({
  ctx,
  nome,
  id,
  presente,
  total,
  gap,
  alerta,
}: {
  ctx: OutlineCtx;
  nome: string;
  id: string;
  presente: ({ id: string; auto: boolean } | undefined)[];
  total: number;
  gap: { tam: number; de: number; ate: number };
  alerta: boolean;
}) {
  return (
    <>
      <div className="ol-matrix-name" title={nome}>
        {nome}
      </div>
      {ctx.cartoes.map((c, i) => {
        const x = presente[i];
        return (
          <button
            key={c.id}
            className={`ol-matrix-cell ${x ? (x.auto ? "auto" : "on") : ""}`}
            onClick={() =>
              !x?.auto &&
              ctx.updateCard(c.id, { personagemIds: x ? c.personagemIds.filter((v) => v !== id) : [...c.personagemIds, id] })
            }
            title={`${nome} · ${label(ctx)} ${c.numero}`}
          />
        );
      })}
      <div className={`ol-matrix-info ${alerta ? "alerta" : ""}`}>
        {total} {total === 1 ? tt("cena") : tt("cenas")}
        {gap.tam > 0 && ` · ${tt("some por {n} (da {de} à {ate})", { n: gap.tam, de: gap.de, ate: gap.ate })}`}
      </div>
    </>
  );
}

// temporada (seriados): arcos atravessando episódios
export function SeasonView() {
  const cur = useApp((s) => s.current!);
  const plan = cur.project.temporada ?? { arcos: [], celulas: {} };
  const update = useApp((s) => s.updateTemporada);
  const selectEpisode = useApp((s) => s.selectEpisode);
  const comic = cur.project.meta.tipo === "quadrinhos";
  const eps = cur.episodes;
  const set = (p: Partial<typeof plan>) => update({ ...plan, ...p });
  function novo() {
    const usadas = new Set(plan.arcos.map((a) => a.cor));
    const cor = TRAMA_CORES.find((c) => !usadas.has(c)) ?? TRAMA_CORES[0];
    set({ arcos: [...plan.arcos, { id: newId(), nome: plan.arcos.length ? tt("Arco {n}", { n: plan.arcos.length + 1 }) : tt("Arco principal"), cor }] });
  }
  return (
    <div className="ol-season">
      <div className="ol-plots-head">
        <p className="faint">
          {comic
            ? tt("Os arcos da temporada atravessam os capítulos. Escreva em cada célula o que o arco faz naquele capítulo.")
            : tt("Os arcos da temporada atravessam os episódios. Escreva em cada célula o que o arco faz naquele episódio.")}
        </p>
        <button className="btn" onClick={novo}>
          <Icon name="plus" size={14} />
          {tt("Novo arco")}
        </button>
      </div>
      <div className="ol-season-grid" style={{ gridTemplateColumns: `180px repeat(${Math.max(1, eps.length)}, minmax(180px, 1fr))` }}>
        <div />
        {eps.map((e) => (
          <button key={e.id} className={`ol-season-ep ${e.id === cur.currentEpisodeId ? "on" : ""}`} onClick={() => void selectEpisode(e.id)} title={tt("Abrir este episódio")}>
            {comic ? tt("Cap. {n}", { n: e.numero }) : `T${e.temporada}E${e.numero}`}
            <span>{e.titulo}</span>
          </button>
        ))}
        {plan.arcos.map((a) => (
          <SeasonRow
            key={a.id}
            arco={a}
            eps={eps.map((e) => e.id)}
            celulas={plan.celulas}
            onCell={(ep, v) => set({ celulas: { ...plan.celulas, [`${a.id}:${ep}`]: v } })}
            onRename={(nome) => set({ arcos: plan.arcos.map((x) => (x.id === a.id ? { ...x, nome } : x)) })}
            onRemove={() => set({ arcos: plan.arcos.filter((x) => x.id !== a.id) })}
          />
        ))}
      </div>
      {plan.arcos.length === 0 && <p className="ol-hint">{tt("Crie um arco para planejar a temporada.")}</p>}
    </div>
  );
}

function SeasonRow({
  arco,
  eps,
  celulas,
  onCell,
  onRename,
  onRemove,
}: {
  arco: Trama;
  eps: string[];
  celulas: Record<string, string>;
  onCell: (ep: string, v: string) => void;
  onRename: (n: string) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <div className="ol-plots-name" style={{ "--trama": arco.cor } as React.CSSProperties}>
        <span className="card-trama-dot big" />
        <input value={arco.nome} onChange={(e) => onRename(e.target.value)} />
        <button className="icon-btn card-ic" onClick={onRemove} title={tt("Excluir arco")}>
          <Icon name="x" size={12} />
        </button>
      </div>
      {eps.map((ep) => (
        <textarea
          key={ep}
          className="ol-season-cell"
          style={{ "--trama": arco.cor } as React.CSSProperties}
          value={celulas[`${arco.id}:${ep}`] ?? ""}
          placeholder="…"
          onChange={(e) => onCell(ep, e.target.value)}
        />
      ))}
    </>
  );
}
