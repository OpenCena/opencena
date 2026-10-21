// Marca do OpenCena: três pontos num quadro escuro, o último na cor da marca.
import { tt } from "@/i18n";
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <rect width="32" height="32" rx="8" fill="var(--logo-bg)" />
      <circle cx="9.5" cy="17" r="2.6" fill="var(--logo-dot)" />
      <circle cx="16" cy="17" r="2.6" fill="var(--logo-dot)" />
      <circle cx="22.5" cy="17" r="2.6" fill="var(--brand)" />
    </svg>
  );
}

export function Logo({ size = 22, wordmark = true, beta = true }: { size?: number; wordmark?: boolean; beta?: boolean }) {
  return (
    <span className="logo" style={{ fontSize: size * 0.68 }}>
      <LogoMark size={size} />
      {wordmark && (
        <span className="logo-word">
          Open<b>Cena</b>
        </span>
      )}
      {wordmark && beta && <span className="beta-tag">{tt("beta")}</span>}
    </span>
  );
}
