import { RefLink } from "@/types";
import { Icon } from "@/components/Icon";
import { Picker } from "@/components/Picker";
import { linkKey } from "@/domain/research";
import type { LinkTarget } from "@/views/tabs/ResearchTab";
import { tt } from "@/i18n";

const KIND_CLASS: Record<RefLink["tipo"], string> = {
  obra: "lk-obra",
  personagem: "lk-personagem",
  local: "lk-local",
  objeto: "lk-objeto",
  secao: "lk-secao",
  ideia: "lk-ideia",
};

/** Vínculos com elementos da obra: chips coloridos por tipo + "Vincular a". */
export function LinkChips({
  value,
  targets,
  onChange,
  compact = false,
}: {
  value: RefLink[];
  targets: LinkTarget[];
  onChange: (v: RefLink[]) => void;
  compact?: boolean;
}) {
  const livres = targets.filter((t) => !value.some((v) => linkKey(v) === t.value));
  return (
    <div className={`lk ${compact ? "compact" : ""}`}>
      {value.map((v) => {
        const t = targets.find((x) => x.value === linkKey(v));
        return (
          <span key={linkKey(v)} className={`lk-chip ${KIND_CLASS[v.tipo]}`} title={t?.group}>
            <span className="lk-dot" />
            {t?.label ?? tt("Removido")}
            <button onClick={() => onChange(value.filter((x) => linkKey(x) !== linkKey(v)))} aria-label={tt("Desvincular")}>
              <Icon name="x" size={10} />
            </button>
          </span>
        );
      })}
      {livres.length > 0 && (
        <Picker
          options={livres.map((t) => ({ value: t.value, label: t.label, group: t.group }))}
          onPick={(val) => {
            const t = targets.find((x) => x.value === val);
            if (t) onChange([...value, t.link]);
          }}
          placeholder={tt("Buscar personagem, local, objeto…")}
        >
          <Icon name="plus" size={11} />
          {value.length ? tt("Vincular") : tt("Vincular a personagem, local, objeto…")}
        </Picker>
      )}
    </div>
  );
}
