import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { tt } from "@/i18n";

export interface PickerOption {
  value: string;
  label: string;
  /** Grupo (ex.: Personagens, Locais). As opções aparecem agrupadas. */
  group?: string;
}

/**
 * Botão que abre uma lista com busca, para escolher um item entre muitos
 * (personagens, locais, objetos, cenas...). Setas, Enter e Esc funcionam.
 * A lista abre por cima de tudo (fora de painéis e janelas que cortariam o
 * conteúdo), presa à tela.
 */
export function Picker({
  options,
  onPick,
  children,
  className,
  placeholder = tt("Buscar…"),
  empty = tt("Nada encontrado."),
  title,
  align = "left",
}: {
  options: PickerOption[];
  onPick: (value: string) => void;
  children: ReactNode;
  className?: string;
  placeholder?: string;
  empty?: string;
  title?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>({});

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => `${o.label} ${o.group ?? ""}`.toLowerCase().includes(t)) : options;
  }, [options, q]);

  useEffect(() => setIdx(0), [q, open]);

  useEffect(() => {
    if (!open) return;
    const r = ref.current?.getBoundingClientRect();
    if (r) {
      const largura = 260;
      const x = align === "right" ? r.right - largura : r.left;
      const left = Math.max(8, Math.min(x, window.innerWidth - largura - 8));
      const up = window.innerHeight - r.bottom < 300 && r.top > 300;
      setPos(up ? { left, bottom: window.innerHeight - r.top + 4 } : { left, top: r.bottom + 4 });
    }
    function fora(e: MouseEvent) {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    }
    // a lista fica parada na tela: rolar ou redimensionar fecha
    function rolou(e: Event) {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false);
    }
    const fechar = () => setOpen(false);
    document.addEventListener("mousedown", fora);
    window.addEventListener("scroll", rolou, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("scroll", rolou, true);
      window.removeEventListener("resize", fechar);
    };
  }, [open, align]);

  useEffect(() => {
    listRef.current?.querySelector(".pk-opt.active")?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  function escolher(o: PickerOption | undefined) {
    if (!o) return;
    onPick(o.value);
    setOpen(false);
    setQ("");
  }

  let ultimoGrupo: string | undefined;
  return (
    <div className={`pk ${className ?? ""}`} ref={ref} onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className="pk-btn" title={title} onClick={() => setOpen((v) => !v)}>
        {children}
      </button>
      {open &&
        createPortal(
          <div className="pk-pop" ref={popRef} style={pos} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <div className="pk-search">
              <Icon name="search" size={13} />
              <input
                autoFocus
                value={q}
                placeholder={placeholder}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIdx((i) => Math.min(i + 1, filtradas.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIdx((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    escolher(filtradas[idx]);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                  }
                }}
              />
            </div>
            <div className="pk-list" ref={listRef}>
              {filtradas.length === 0 && <div className="pk-empty">{empty}</div>}
              {filtradas.map((o, i) => {
                const cab = o.group && o.group !== ultimoGrupo ? o.group : null;
                ultimoGrupo = o.group;
                return (
                  <div key={o.value}>
                    {cab && <div className="pk-group">{cab}</div>}
                    <button
                      type="button"
                      className={`pk-opt ${i === idx ? "active" : ""}`}
                      onMouseEnter={() => setIdx(i)}
                      onClick={() => escolher(o)}
                    >
                      {o.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
