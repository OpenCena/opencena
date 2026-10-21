import { useRef, useState } from "react";
import { useApp } from "@/store/appStore";
import { OutlineCard, Plant } from "@/types";
import { newId } from "@/domain/project";
import { parseHeadingLocation } from "@/domain/screenplay";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { Picker } from "@/components/Picker";
import { startAttachment, useProjectImageUrl } from "@/storage/images";
import { OutlineCtx, STATUS, nextStatus, tamanhoLabel } from "./shared";
import { tt } from "@/i18n";

const CARD_LABEL: Record<string, { label: string; placeholder: string; upper: boolean }> = {
  roteiro: { label: tt("Cena"), placeholder: tt("INT. LOCAL - DIA"), upper: true },
  quadrinhos: { label: tt("Página"), placeholder: tt("PÁGINA / SEQUÊNCIA"), upper: true },
  novel: { label: tt("Capítulo"), placeholder: tt("Título do capítulo"), upper: false },
};

function CardImage({ ctx, arquivo }: { ctx: OutlineCtx; arquivo: string }) {
  const url = useProjectImageUrl(ctx.root, arquivo);
  return <div className="card-img">{url && <img src={url} alt="" draggable={false} />}</div>;
}

/** Imagem do cartão: escolher entre as imagens da Pesquisa ou um arquivo. */
function ImagePicker({ ctx, card }: { ctx: OutlineCtx; card: OutlineCard }) {
  const refs = useApp((s) => s.current!.project.references ?? []);
  const imagens = refs.filter((r) => r.tipo === "imagem" && r.arquivo);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="card-imgpick">
      {imagens.length > 0 && (
        <Picker
          className="btnlike"
          options={imagens.map((r) => ({ value: r.arquivo!, label: r.titulo || r.arquivoNome || tt("Imagem") }))}
          onPick={(arquivo) => ctx.updateCard(card.id, { imagem: arquivo })}
          placeholder={tt("Buscar imagem da Pesquisa…")}
        >
          <Icon name="bookmark" size={13} />
          {tt("Da Pesquisa")}
        </Picker>
      )}
      <button className="btn btn-ghost card-mini-btn" onClick={() => fileRef.current?.click()}>
        <Icon name="image" size={13} />
        {tt("Arquivo")}
      </button>
      {card.imagem && (
        <button className="btn btn-ghost card-mini-btn" onClick={() => ctx.updateCard(card.id, { imagem: undefined })}>
          {tt("Tirar")}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) ctx.updateCard(card.id, { imagem: startAttachment(ctx.root, f).arquivo });
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function OutlineCardView({
  ctx,
  card,
  dragging,
  insertBefore,
  onOver,
  onDragStart,
  onDragEnd,
}: {
  ctx: OutlineCtx;
  card: OutlineCard;
  dragging: boolean;
  insertBefore: boolean;
  onOver: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [novaEtiqueta, setNovaEtiqueta] = useState("");
  const kindId = ctx.kind.id;
  const cfg = CARD_LABEL[kindId] ?? CARD_LABEL.roteiro;
  const secao = ctx.secaoDoCartao(card);
  const cabecalho = secao ? ctx.tituloSecao(secao) : card.cabecalho;
  // o local só faz sentido quando o cartão está ligado a uma cena do roteiro
  const local = kindId === "roteiro" && secao ? parseHeadingLocation(cabecalho) : "";
  const status = card.status ?? "afazer";
  const trama = ctx.tramas.find((t) => t.id === card.tramaId);
  const pessoas = ctx.personagensDe(card);
  const nomes = new Map(ctx.characters.map((c) => [c.id, c.nome || tt("Sem nome")]));
  const livres = ctx.characters.filter((c) => !pessoas.some((p) => p.id === c.id));
  const tamanho = secao ? tamanhoLabel(kindId, ctx.sizes?.get(secao)) : "";
  const avisos = ctx.warnings.filter((w) => w.cartaoId === card.id);
  // o que é colhido aqui (plantado em outro cartão)
  const colhe = ctx.cartoes.flatMap((c) => (c.plantios ?? []).filter((p) => p.colheitaId === card.id).map((p) => ({ p, de: c })));
  const sel = ctx.sel.has(card.id);
  const dim = !ctx.passa(card);
  const outros = ctx.cartoes.filter((c) => c.id !== card.id);

  const setPlantios = (plantios: Plant[]) => ctx.updateCard(card.id, { plantios }, `plantio:${card.id}`);

  return (
    <div
      ref={ref}
      className={`card ${dragging ? "dragging" : ""} ${insertBefore ? "insert-before" : ""} ${dim ? "dim" : ""} ${sel ? "selected" : ""}`}
      style={trama ? ({ "--trama": trama.cor } as React.CSSProperties) : undefined}
      data-trama={trama ? "1" : undefined}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOver();
      }}
      onClick={(e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          e.preventDefault();
          ctx.toggleSel(card.id, true);
        }
      }}
    >
      {card.imagem && <CardImage ctx={ctx} arquivo={card.imagem} />}
      <div className="card-head">
        <button
          className={`card-check ${sel ? "on" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            ctx.toggleSel(card.id, true);
          }}
          title={tt("Selecionar (Shift + clique também seleciona)")}
        >
          {sel && <Icon name="check" size={10} strokeWidth={3} />}
        </button>
        <span className="card-num">
          {`${cfg.label} ${card.numero}`}
          {local ? ` · ${local}` : ""}
        </span>
        <span style={{ display: "inline-flex", gap: 2, alignItems: "center", marginLeft: "auto" }}>
          <button className={`card-status st-${status}`} onClick={() => ctx.updateCard(card.id, { status: nextStatus(card.status) })} title={tt("Clique para mudar o andamento")}>
            {STATUS.find((s) => s.id === status)!.label}
          </button>
          <span
            className="card-drag"
            draggable
            onDragStart={(e) => {
              if (ref.current) e.dataTransfer.setDragImage(ref.current, 20, 20);
              e.dataTransfer.effectAllowed = "move";
              onDragStart();
            }}
            onDragEnd={onDragEnd}
            title={tt("Arraste para mover")}
          >
            <Icon name="layoutList" size={14} />
          </span>
          <button className="icon-btn danger card-ic" onClick={() => ctx.removeCard(card.id)} title={tt("Excluir")}>
            <Icon name="x" size={13} />
          </button>
        </span>
      </div>

      {(trama || (card.etiquetas ?? []).length > 0) && (
        <div className="card-tags">
          {trama && (
            <span className="card-trama">
              <span className="card-trama-dot" />
              {trama.nome}
            </span>
          )}
          {(card.etiquetas ?? []).map((t) => (
            <span key={t} className="card-tag">
              {t}
            </span>
          ))}
        </div>
      )}

      <input
        className="card-cabecalho"
        value={cabecalho}
        placeholder={cfg.placeholder}
        style={cfg.upper ? undefined : { textTransform: "none" }}
        title={secao ? tt("Ligado ao {doc}: mudar aqui muda lá também", { doc: ctx.docLabel }) : undefined}
        onChange={(e) => ctx.setHeading(card, cfg.upper ? e.target.value.toUpperCase() : e.target.value)}
      />
      {card.guia && !card.resumo && <div className="card-guia">{card.guia}</div>}
      <textarea
        className="card-resumo"
        value={card.resumo}
        placeholder={kindId === "novel" ? tt("Resumo do capítulo…") : kindId === "quadrinhos" ? tt("Resumo da página…") : tt("Resumo da cena…")}
        rows={2}
        onChange={(e) => ctx.updateCard(card.id, { resumo: e.target.value }, `resumo:${card.id}`)}
      />

      {pessoas.length > 0 && (
        <div className="card-chars">
          {pessoas.map((p) => (
            <span key={p.id} className={`card-char ${p.auto ? "auto" : ""}`} title={p.auto ? tt("Aparece aqui (detectado no {doc})", { doc: ctx.docLabel }) : undefined}>
              {nomes.get(p.id) ?? tt("Removido")}
              {open && !p.auto && (
                <button onClick={() => ctx.updateCard(card.id, { personagemIds: card.personagemIds.filter((x) => x !== p.id) })} aria-label={tt("Tirar personagem")}>
                  <Icon name="x" size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {(colhe.length > 0 || avisos.length > 0) && (
        <div className="card-plants">
          {colhe.map(({ p, de }) => (
            <span key={p.id} className="card-plant colhe" title={tt("Plantado em: {lugar}", { lugar: `${cfg.label} ${de.numero}` })}>
              <Icon name="seed" size={11} />
              {tt("Colhe:")} {p.texto} ({de.numero})
            </span>
          ))}
          {avisos.map((w) => (
            <span key={w.plantioId} className="card-plant aviso">
              <Icon name="alert" size={11} />
              {w.motivo === "sem-retorno" ? tt("Plantado sem retorno: {texto}", { texto: w.texto }) : tt("O retorno vem antes: {texto}", { texto: w.texto })}
            </span>
          ))}
        </div>
      )}

      <div className="card-foot">
        <button className="card-toggle" onClick={() => setOpen((v) => !v)}>
          <Icon name={open ? "chevronDown" : "chevronLeft"} size={13} />
          {open ? tt("menos") : tt("detalhes")}
        </button>
        {tamanho && <span className="card-size">{tamanho}</span>}
        {secao ? (
          <button className="card-doc" onClick={() => ctx.abrir(card)} title={tt("Abrir no {doc}", { doc: ctx.docLabel })}>
            <Icon name="external" size={12} />
            {tt("Abrir")}
          </button>
        ) : (
          <button className="card-doc soft" onClick={() => ctx.criarNoDoc(card)} title={tt("Ainda não está no {doc}: criar lá", { doc: ctx.docLabel })}>
            <Icon name="plus" size={12} />
            {tt("Criar")}
          </button>
        )}
      </div>

      {open && (
        <div className="card-more">
          <div>
            <label>{tt("Personagens")}</label>
            {livres.length > 0 ? (
              <Picker
                options={livres.map((c) => ({ value: c.id, label: c.nome || tt("Sem nome") }))}
                onPick={(v) => ctx.updateCard(card.id, { personagemIds: [...card.personagemIds, v] })}
                placeholder={tt("Buscar personagem…")}
              >
                <Icon name="plus" size={11} />
                {tt("Adicionar personagem")}
              </Picker>
            ) : (
              <span className="faint" style={{ fontSize: 12 }}>
                {ctx.characters.length ? tt("Todos já estão aqui.") : tt("Cadastre personagens na aba Personagens.")}
              </span>
            )}
          </div>
          <div>
            <label>{tt("Trama")}</label>
            <Select
              className="sel-compact"
              ariaLabel={tt("Trama")}
              value={card.tramaId ?? ""}
              onChange={(v) => ctx.updateCard(card.id, { tramaId: v || undefined })}
              options={[{ value: "", label: tt("Sem trama") }, ...ctx.tramas.map((t) => ({ value: t.id, label: t.nome }))]}
            />
          </div>
          <div>
            <label>{tt("Etiquetas")}</label>
            <div className="card-tags edit">
              {(card.etiquetas ?? []).map((t) => (
                <span key={t} className="card-tag">
                  {t}
                  <button onClick={() => ctx.updateCard(card.id, { etiquetas: (card.etiquetas ?? []).filter((x) => x !== t) })} aria-label={tt("Tirar etiqueta")}>
                    <Icon name="x" size={9} />
                  </button>
                </span>
              ))}
              <input
                className="card-tag-input"
                value={novaEtiqueta}
                placeholder={tt("flashback, clímax… (Enter)")}
                onChange={(e) => setNovaEtiqueta(e.target.value)}
                onKeyDown={(e) => {
                  const t = novaEtiqueta.trim().toLowerCase();
                  if (e.key === "Enter" && t) {
                    e.preventDefault();
                    if (!(card.etiquetas ?? []).includes(t)) ctx.updateCard(card.id, { etiquetas: [...(card.etiquetas ?? []), t] });
                    setNovaEtiqueta("");
                  }
                }}
              />
            </div>
          </div>
          <div>
            <label>{tt("Imagem (storyboard)")}</label>
            <ImagePicker ctx={ctx} card={card} />
          </div>
          <div>
            <label>{tt("Plantar e colher")}</label>
            {(card.plantios ?? []).map((p) => (
              <div className="card-plant-row" key={p.id}>
                <input
                  value={p.texto}
                  placeholder={tt("O que é plantado (a carta, a arma…)")}
                  onChange={(e) => setPlantios((card.plantios ?? []).map((x) => (x.id === p.id ? { ...x, texto: e.target.value } : x)))}
                />
                <Select
                  className="sel-compact"
                  ariaLabel={tt("Onde volta")}
                  value={p.colheitaId ?? ""}
                  onChange={(v) => setPlantios((card.plantios ?? []).map((x) => (x.id === p.id ? { ...x, colheitaId: v || null } : x)))}
                  options={[
                    { value: "", label: tt("Volta em…") },
                    ...outros.map((c) => ({ value: c.id, label: `${cfg.label} ${c.numero}${c.cabecalho ? `: ${c.cabecalho}` : ""}` })),
                  ]}
                />
                <button className="icon-btn card-ic" onClick={() => setPlantios((card.plantios ?? []).filter((x) => x.id !== p.id))} title={tt("Remover")}>
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
            <button className="btn btn-ghost card-mini-btn" onClick={() => setPlantios([...(card.plantios ?? []), { id: newId(), texto: "", colheitaId: null }])}>
              <Icon name="seed" size={13} />
              {tt("Plantar algo")}
            </button>
          </div>
          {card.guia && (
            <div>
              <label>{tt("Função desta batida")}</label>
              <div className="card-guia">{card.guia}</div>
            </div>
          )}
          <div>
            <label>{tt("Objetivo")}</label>
            <textarea value={card.objetivo} rows={2} placeholder={tt("O que a cena precisa alcançar.")} onChange={(e) => ctx.updateCard(card.id, { objetivo: e.target.value }, `obj:${card.id}`)} />
          </div>
          <div>
            <label>{tt("Conflito")}</label>
            <textarea value={card.conflito} rows={2} placeholder={tt("O que atrapalha / a tensão.")} onChange={(e) => ctx.updateCard(card.id, { conflito: e.target.value }, `conf:${card.id}`)} />
          </div>
          <div>
            <label>{tt("Observações")}</label>
            <textarea value={card.observacoes} rows={2} onChange={(e) => ctx.updateCard(card.id, { observacoes: e.target.value }, `obs:${card.id}`)} />
          </div>
        </div>
      )}
    </div>
  );
}
