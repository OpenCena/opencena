import { BookParts } from "@/types";
import { Icon } from "@/components/Icon";
import { tt } from "@/i18n";

export const BOOK_PART_INFO: { key: keyof BookParts; label: string; hint: string }[] = [
  { key: "capa", label: tt("Capa"), hint: tt("Com imagem, título e autor") },
  { key: "folhaRosto", label: tt("Folha de rosto"), hint: tt("Título, autor e editora") },
  { key: "creditos", label: tt("Créditos e ISBN"), hint: tt("Copyright, edição, ficha") },
  { key: "dedicatoria", label: tt("Dedicatória"), hint: tt("Página para alguém") },
  { key: "epigrafe", label: tt("Epígrafe"), hint: tt("Citação de abertura") },
  { key: "sumario", label: tt("Sumário"), hint: tt("Capítulos e páginas") },
];

// Escolha das páginas de abertura do livro (cartões marcáveis).
export function BookPartsPicker({
  value,
  onChange,
  compact = false,
}: {
  value: BookParts;
  onChange: (v: BookParts) => void;
  compact?: boolean;
}) {
  return (
    <div className={`parts-grid ${compact ? "compact" : ""}`}>
      {BOOK_PART_INFO.map((p) => {
        const on = value[p.key];
        return (
          <button
            key={p.key}
            type="button"
            role="checkbox"
            aria-checked={on}
            className={`part-opt ${on ? "on" : ""}`}
            onClick={() => onChange({ ...value, [p.key]: !on })}
          >
            <span className="part-box">{on && <Icon name="check" size={12} strokeWidth={2.4} />}</span>
            <span className="part-text">
              <span className="part-label">{p.label}</span>
              {!compact && <span className="part-hint">{p.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
