import { ReactNode, useRef } from "react";
import { Icon } from "@/components/Icon";
import { tt } from "@/i18n";

// Fecha só quando o clique começa e termina no fundo, para não fechar ao
// selecionar texto num campo e soltar o mouse fora dele.
export function ModalOverlay({
  onClose,
  title,
  children,
  width,
}: {
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number;
}) {
  const downOnBackdrop = useRef(false);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
        downOnBackdrop.current = false;
      }}
    >
      <div
        className="modal-card"
        style={width ? { width } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title !== undefined && (
          <div className="modal-head">
            <h2>{title}</h2>
            <button className="modal-x" onClick={onClose} title={tt("Fechar")}>
              <Icon name="x" size={16} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
