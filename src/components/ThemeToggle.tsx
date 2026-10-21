import { Theme, useApp } from "@/store/appStore";
import { Icon } from "@/components/Icon";
import { tt } from "@/i18n";

type IconName = Parameters<typeof Icon>[0]["name"];

const OPTIONS: { value: Theme; label: string; icon: IconName }[] = [
  { value: "light", label: tt("Claro"), icon: "sun" },
  { value: "dark", label: tt("Escuro"), icon: "moon" },
  { value: "system", label: tt("Sistema"), icon: "monitor" },
];

export function ThemeToggle({ compact = false, full = false }: { compact?: boolean; full?: boolean }) {
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);

  // versão compacta (menu recolhido): um botão que alterna entre os temas
  if (compact) {
    const i = OPTIONS.findIndex((o) => o.value === theme);
    const cur = OPTIONS[i < 0 ? 2 : i];
    const next = OPTIONS[(Math.max(0, i) + 1) % OPTIONS.length];
    return (
      <button className="ws-nav" onClick={() => setTheme(next.value)} data-tip={tt("Tema: {tema}", { tema: cur.label.toLowerCase() })}>
        <Icon name={cur.icon} size={16} />
      </button>
    );
  }

  return (
    <div
      style={{
        display: full ? "flex" : "inline-flex",
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: 2,
      }}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          style={{
            display: "inline-flex",
            flex: full ? 1 : undefined,
            justifyContent: "center",
            border: "none",
            borderRadius: 2,
            padding: "5px 9px",
            background: theme === opt.value ? "var(--accent)" : "transparent",
            color: theme === opt.value ? "var(--accent-contrast)" : "var(--text-muted)",
          }}
        >
          <Icon name={opt.icon} size={15} />
        </button>
      ))}
    </div>
  );
}
