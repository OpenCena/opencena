import { ReactNode, useEffect } from "react";
import { useApp } from "@/store/appStore";
import { Icon } from "@/components/Icon";
import { tt } from "@/i18n";

/** Página da pesquisa ampliada: na lateral direita ou numa janela (Configurações > Geral). */
export function SidePanel({
  title,
  onClose,
  children,
  actions,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const modo = useApp((s) => s.prefs.painel);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const painel = (
    <aside className={`sp-panel ${modo}`} role="dialog" aria-label={typeof title === "string" ? title : undefined}>
      <div className="sp-head">
        <div className="sp-title">{title}</div>
        {actions}
        <button className="sp-x" onClick={onClose} title={tt("Fechar (Esc)")}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="sp-body">{children}</div>
    </aside>
  );

  if (modo === "janela") {
    return (
      <div className="sp-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {painel}
      </div>
    );
  }
  return painel;
}
