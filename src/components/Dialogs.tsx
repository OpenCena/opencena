// Diálogos do próprio app (no lugar de alert/confirm do navegador).

import { useEffect, useRef } from "react";
import { create } from "zustand";
import { Icon } from "@/components/Icon";
import { tt } from "@/i18n";

type IconName = Parameters<typeof Icon>[0]["name"];

export interface DialogOptions {
  title: string;
  message?: string;
  /** Linhas extras em destaque (ex.: o que vai acontecer). */
  details?: string[];
  confirmLabel?: string;
  /** null = só um botão (aviso). */
  cancelLabel?: string | null;
  tone?: "normal" | "danger";
  icon?: IconName;
}

interface Pending extends DialogOptions {
  id: number;
  resolve: (ok: boolean) => void;
}

const useDialogs = create<{ queue: Pending[] }>(() => ({ queue: [] }));
let seq = 0;

/** Pergunta com Confirmar/Cancelar. Resolve true se a pessoa confirmou. */
export function confirmDialog(opts: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogs.setState((s) => ({ queue: [...s.queue, { ...opts, id: ++seq, resolve }] }));
  });
}

/** Aviso com um botão só. */
export function noticeDialog(opts: Omit<DialogOptions, "cancelLabel">): Promise<void> {
  return confirmDialog({ confirmLabel: tt("Entendi"), ...opts, cancelLabel: null }).then(() => undefined);
}

function close(d: Pending, ok: boolean) {
  useDialogs.setState((s) => ({ queue: s.queue.filter((x) => x.id !== d.id) }));
  d.resolve(ok);
}

export function DialogHost() {
  const d = useDialogs((s) => s.queue[0]);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!d) return;
    okRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close(d!, false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [d]);

  if (!d) return null;
  const danger = d.tone === "danger";
  return (
    <div className="dlg-overlay" onMouseDown={(e) => e.target === e.currentTarget && d.cancelLabel !== null && close(d, false)}>
      <div className="dlg" role="alertdialog" aria-modal="true" aria-labelledby={`dlg-${d.id}`}>
        <span className={`dlg-ico ${danger ? "danger" : ""}`}>
          <Icon name={d.icon ?? (danger ? "alert" : "folderOpen")} size={20} />
        </span>
        <h2 id={`dlg-${d.id}`}>{d.title}</h2>
        {d.message && <p>{d.message}</p>}
        {d.details && d.details.length > 0 && (
          <ul>
            {d.details.map((t) => (
              <li key={t}>
                <Icon name="check" size={13} strokeWidth={2.2} />
                {t}
              </li>
            ))}
          </ul>
        )}
        <div className="dlg-actions">
          {d.cancelLabel !== null && (
            <button className="btn btn-ghost" onClick={() => close(d, false)}>
              {d.cancelLabel ?? tt("Cancelar")}
            </button>
          )}
          <button
            ref={okRef}
            className={`btn btn-primary ${danger ? "btn-danger" : ""}`}
            onClick={() => close(d, true)}
          >
            {d.confirmLabel ?? tt("Confirmar")}
          </button>
        </div>
      </div>
    </div>
  );
}
