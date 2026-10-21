import { useApp } from "@/store/appStore";
import { locale, tt } from "@/i18n";

// Mostra o estado do autosave: salvando… / salvo há pouco.
export function SaveStatus() {
  const saving = useApp((s) => s.saving);
  const lastSavedAt = useApp((s) => s.lastSavedAt);

  let text: string;
  if (saving) {
    text = tt("Salvando…");
  } else if (lastSavedAt) {
    text = tt("Salvo {hora}", { hora: new Date(lastSavedAt).toLocaleTimeString(locale()) });
  } else {
    text = tt("Tudo salvo");
  }

  return (
    <span
      className="faint"
      style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: saving ? "var(--brand)" : "var(--text-faint)",
        }}
      />
      {text}
    </span>
  );
}
