import { useEffect, useRef, useState } from "react";
import { kbd } from "@/utils/platform";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Icon } from "@/components/Icon";
import { buscaKey, limparBusca, moverBusca, setBusca, substituir, substituirTodos } from "@/editor/search";
import { tt } from "@/i18n";

// Barra de localizar/substituir (Ctrl+F / Ctrl+H), no canto do editor.
export function FindBar({
  editor,
  replace,
  onClose,
  onToggleReplace,
}: {
  editor: Editor;
  replace: boolean;
  onClose: () => void;
  onToggleReplace: () => void;
}) {
  const [query, setQuery] = useState(() => {
    const { from, to } = editor.state.selection;
    const sel = editor.state.doc.textBetween(from, to, " ");
    return sel && sel.length < 80 && !sel.includes("\n") ? sel : buscaKey.getState(editor.state)?.query ?? "";
  });
  const [caso, setCaso] = useState(false);
  const [troca, setTroca] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const info = useEditorState({
    editor,
    selector: ({ editor }) => {
      const st = editor ? buscaKey.getState(editor.state) : undefined;
      return { n: st?.hits.length ?? 0, atual: st?.atual ?? 0 };
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [replace]);

  useEffect(() => {
    setBusca(editor.view, query, caso);
    setMsg(null);
  }, [query, caso, editor]);

  useEffect(() => () => {
    if (!editor.isDestroyed) limparBusca(editor.view);
  }, [editor]);

  function close() {
    onClose();
    editor.commands.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter") {
      e.preventDefault();
      moverBusca(editor.view, e.shiftKey ? -1 : 1);
    }
  }

  const n = info?.n ?? 0;
  return (
    <div className="find-bar" onKeyDown={onKey}>
      <div className="find-row">
        <button className="find-btn" onClick={onToggleReplace} title={replace ? tt("Ocultar substituir") : `${tt("Substituir")} (${kbd("H")})`}>
          <Icon name={replace ? "chevronDown" : "chevronLeft"} size={14} />
        </button>
        <input
          ref={inputRef}
          className="find-input"
          placeholder={tt("Localizar")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="find-count">{query ? (n ? `${(info?.atual ?? 0) + 1} de ${n}` : tt("nenhum")) : ""}</span>
        <button className={`find-btn ${caso ? "on" : ""}`} onClick={() => setCaso((v) => !v)} title={tt("Diferenciar maiúsculas")}>
          {tt("Aa")}
        </button>
        <button className="find-btn" onClick={() => moverBusca(editor.view, -1)} disabled={!n} title={tt("Anterior (Shift+Enter)")}>
          <Icon name="chevronDown" size={14} className="rot180" />
        </button>
        <button className="find-btn" onClick={() => moverBusca(editor.view, 1)} disabled={!n} title={tt("Próximo (Enter)")}>
          <Icon name="chevronDown" size={14} />
        </button>
        <button className="find-btn" onClick={close} title={tt("Fechar (Esc)")}>
          <Icon name="x" size={14} />
        </button>
      </div>
      {replace && (
        <div className="find-row">
          <span style={{ width: 26 }} />
          <input
            className="find-input"
            placeholder={tt("Substituir por")}
            value={troca}
            onChange={(e) => setTroca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                substituir(editor.view, troca);
              }
            }}
          />
          <button className="find-btn text" disabled={!n} onClick={() => substituir(editor.view, troca)}>
            {tt("Substituir")}
          </button>
          <button
            className="find-btn text"
            disabled={!n}
            onClick={() => {
              const k = substituirTodos(editor.view, troca);
              setMsg(k === 1 ? tt("1 substituição") : tt("{n} substituições", { n: k }));
            }}
          >
            {tt("Todos")}
          </button>
        </div>
      )}
      {msg && <div className="find-msg">{msg}</div>}
    </div>
  );
}
