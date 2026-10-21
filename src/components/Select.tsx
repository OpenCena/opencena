import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { tt } from "@/i18n";
import "@/styles/select.css";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

// Dropdown customizado (não usa o <select> nativo). Minimalista, com popover.
export function Select({
  value,
  options,
  onChange,
  ariaLabel,
  direction = "auto",
  className,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  // "auto" abre para o lado com mais espaço; "up"/"down" forçam a direção.
  direction?: "auto" | "up" | "down";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(direction === "up");
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  // Ao abrir, decide se o popover vai para cima ou para baixo conforme o espaço.
  function toggle() {
    if (!open && ref.current) {
      if (direction === "up") setDropUp(true);
      else if (direction === "down") setDropUp(false);
      else {
        const rect = ref.current.getBoundingClientRect();
        const abaixo = window.innerHeight - rect.bottom;
        const acima = rect.top;
        const estimado = Math.min(260, options.length * 40 + 8);
        setDropUp(abaixo < estimado && acima > abaixo);
      }
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`sel ${className ?? ""}`} ref={ref}>
      <button
        type="button"
        className={`sel-btn ${open ? "open" : ""}`}
        aria-label={ariaLabel}
        onClick={toggle}
      >
        <span title={current?.label}>{current?.label ?? tt("Selecionar")}</span>
        <Icon name="chevronDown" size={15} />
      </button>

      {open && (
        <div className={`sel-pop ${dropUp ? "up" : ""}`} role="listbox">
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`sel-opt ${o.value === value ? "active" : ""}`}
              title={o.label}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="sel-opt-main">{o.label}</span>
              {o.hint && <span className="sel-opt-hint">{o.hint}</span>}
              {o.value === value && (
                <span className="sel-check">
                  <Icon name="check" size={14} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
