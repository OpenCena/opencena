import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { DocComment, ScreenplayElement } from "@/types";
import { newId } from "@/domain/project";
import { Icon } from "@/components/Icon";
import { confirmDialog } from "@/components/Dialogs";
import { kbd } from "@/utils/platform";
import { tt, locale } from "@/i18n";

function quando(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(locale(), { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
}

/** Intervalos do documento com a marca de um comentário. */
export function rangesDoComentario(editor: Editor, id: string): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    if (node.marks.some((m) => m.type.name === "comentario" && m.attrs.id === id)) {
      const last = out[out.length - 1];
      if (last && last.to === pos) last.to = pos + node.nodeSize;
      else out.push({ from: pos, to: pos + node.nodeSize });
    }
  });
  return out;
}

/**
 * Painel de comentários à direita do editor: cada comentário mostra o trecho,
 * o texto, respostas e as ações de resolver e excluir. Clicar leva ao trecho.
 */
export function CommentsPanel({
  editor,
  comentarios,
  elementos,
  ativo,
  novo,
  onChange,
  onAtivo,
  onClose,
}: {
  editor: Editor;
  comentarios: DocComment[];
  elementos: ScreenplayElement[];
  ativo: string | null;
  /** Comentário recém-criado (recebe o foco). */
  novo: string | null;
  onChange: (c: DocComment[]) => void;
  onAtivo: (id: string | null) => void;
  onClose: () => void;
}) {
  const [verResolvidos, setVerResolvidos] = useState(false);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  // ordem do documento; comentários sem trecho (texto apagado) vão para o fim
  const ordenados = useMemo(() => {
    const pos = new Map<string, number>();
    elementos.forEach((e, i) => e.comentarios?.forEach((c) => !pos.has(c.id) && pos.set(c.id, i * 100000 + c.de)));
    return [...comentarios]
      .filter((c) => verResolvidos || !c.resolvido)
      .sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity));
  }, [comentarios, elementos, verResolvidos]);
  const ancorados = useMemo(() => new Set(elementos.flatMap((e) => e.comentarios?.map((c) => c.id) ?? [])), [elementos]);
  const resolvidos = comentarios.filter((c) => c.resolvido).length;

  useEffect(() => {
    if (!ativo) return;
    listaRef.current?.querySelector(`[data-cm="${ativo}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [ativo]);

  const patch = (id: string, p: Partial<DocComment>) => onChange(comentarios.map((c) => (c.id === id ? { ...c, ...p } : c)));

  function irPara(id: string) {
    onAtivo(id);
    const r = rangesDoComentario(editor, id)[0];
    if (!r) return;
    editor.commands.setTextSelection(r);
    const dom = editor.view.domAtPos(r.from).node as HTMLElement;
    (dom.nodeType === 1 ? dom : dom.parentElement)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function excluir(c: DocComment) {
    if (c.texto.trim()) {
      const ok = await confirmDialog({ title: tt("Excluir este comentário?"), message: tt("O texto comentado continua no documento."), confirmLabel: tt("Excluir"), tone: "danger" });
      if (!ok) return;
    }
    const tipo = editor.schema.marks.comentario;
    let tr = editor.state.tr;
    for (const r of rangesDoComentario(editor, c.id)) tr = tr.removeMark(r.from, r.to, tipo.create({ id: c.id }));
    editor.view.dispatch(tr);
    onChange(comentarios.filter((x) => x.id !== c.id));
    if (ativo === c.id) onAtivo(null);
  }

  return (
    <aside className="cm-panel" aria-label={tt("Comentários")}>
      <div className="cm-head">
        <span>{tt("Comentários")}</span>
        <button className="modal-x" onClick={onClose} title={tt("Fechar")}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="cm-list" ref={listaRef}>
        {ordenados.length === 0 && (
          <p className="cm-empty">
            {tt("Selecione um trecho (ou deixe o cursor num parágrafo) e use o botão de comentário na barra, ou {atalho}.", { atalho: kbd("Alt", "M") })}
          </p>
        )}
        {ordenados.map((c) => (
          <div
            key={c.id}
            data-cm={c.id}
            className={`cm ${ativo === c.id ? "active" : ""} ${c.resolvido ? "resolved" : ""}`}
            onClick={() => irPara(c.id)}
          >
            <div className="cm-quote" title={c.trecho}>
              {ancorados.has(c.id) ? c.trecho : <i>{tt("trecho apagado do texto")}</i>}
            </div>
            <textarea
              className="cm-text"
              value={c.texto}
              autoFocus={novo === c.id}
              placeholder={tt("Escreva o comentário…")}
              rows={Math.max(2, Math.min(8, c.texto.split("\n").length + Math.floor(c.texto.length / 34)))}
              onClick={(e) => e.stopPropagation()}
              onFocus={() => onAtivo(c.id)}
              onChange={(e) => patch(c.id, { texto: e.target.value })}
            />
            {(c.respostas ?? []).map((r) => (
              <div className="cm-reply" key={r.id}>
                <textarea
                  className="cm-text"
                  autoFocus={respondendo === r.id}
                  placeholder={tt("Responder…")}
                  value={r.texto}
                  rows={Math.max(1, Math.min(6, r.texto.split("\n").length + Math.floor(r.texto.length / 34)))}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => patch(c.id, { respostas: (c.respostas ?? []).map((x) => (x.id === r.id ? { ...x, texto: e.target.value } : x)) })}
                />
                <span className="cm-date">{quando(r.criadoEm)}</span>
              </div>
            ))}
            <div className="cm-foot" onClick={(e) => e.stopPropagation()}>
              <span className="cm-date">{quando(c.criadoEm)}</span>
              <span style={{ flex: 1 }} />
              <button
                className="cm-act"
                onClick={() => {
                  const id = newId();
                  patch(c.id, { respostas: [...(c.respostas ?? []), { id, texto: "", criadoEm: new Date().toISOString() }] });
                  setRespondendo(id);
                }}
                title={tt("Responder")}
              >
                {tt("Responder")}
              </button>
              <button className="cm-act" onClick={() => patch(c.id, { resolvido: !c.resolvido })} title={c.resolvido ? tt("Reabrir") : tt("Marcar como resolvido")}>
                <Icon name="check" size={12} />
                {c.resolvido ? tt("Reabrir") : tt("Resolver")}
              </button>
              <button className="cm-act danger" onClick={() => void excluir(c)} title={tt("Excluir")}>
                <Icon name="trash" size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {resolvidos > 0 && (
        <label className="cm-toggle">
          <input type="checkbox" checked={verResolvidos} onChange={(e) => setVerResolvidos(e.target.checked)} />
          {tt("Mostrar resolvidos ({n})", { n: resolvidos })}
        </label>
      )}
    </aside>
  );
}
