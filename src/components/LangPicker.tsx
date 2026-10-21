import { Icon } from "@/components/Icon";
import { Picker } from "@/components/Picker";
import { LANGS, setLangChoice, storedLangChoice, tt, uiLang } from "@/i18n";
import { flushPendingSaves } from "@/store/appStore";

/** Globo para trocar o idioma da interface (recarrega a tela). */
export function LangPicker({ compact = false, align = "right" }: { compact?: boolean; align?: "left" | "right" }) {
  const escolha = storedLangChoice();
  const atual = LANGS.find((l) => l.id === uiLang());
  async function trocar(v: string) {
    await flushPendingSaves();
    setLangChoice(v as Parameters<typeof setLangChoice>[0]);
  }
  return (
    <Picker
      className={compact ? "" : "btnlike"}
      align={align}
      title={tt("Idioma")}
      options={[
        { value: "auto", label: `${tt("Do sistema")}${escolha === "auto" ? " ✓" : ""}` },
        ...LANGS.map((l) => ({ value: l.id, label: `${l.nome}${escolha === l.id ? " ✓" : ""}` })),
      ]}
      onPick={(v) => void trocar(v)}
      placeholder={tt("Idioma")}
    >
      <Icon name="globe" size={14} />
      {!compact && atual?.nome}
    </Picker>
  );
}
