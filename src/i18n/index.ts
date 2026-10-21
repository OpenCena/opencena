// Tradução da interface (pt-BR, en, es).

import en from "./locales/en.json";
import es from "./locales/es.json";

export type Lang = "pt-BR" | "en" | "es";

export const LANGS: { id: Lang; nome: string }[] = [
  { id: "pt-BR", nome: "Português" },
  { id: "en", nome: "English" },
  { id: "es", nome: "Español" },
];

const DICTS: Record<Lang, Record<string, string>> = {
  "pt-BR": {},
  en: en as Record<string, string>,
  es: es as Record<string, string>,
};

const KEY = "opencena:idioma";

/** Idioma do sistema/navegador, entre os disponíveis. */
export function systemLang(): Lang {
  const prefs = typeof navigator !== "undefined" ? [...(navigator.languages ?? []), navigator.language] : [];
  for (const p of prefs) {
    const l = (p ?? "").toLowerCase();
    if (l.startsWith("pt")) return "pt-BR";
    if (l.startsWith("es")) return "es";
    if (l.startsWith("en")) return "en";
  }
  return "en";
}

/** Escolha guardada ("auto" = do sistema). */
export function storedLangChoice(): Lang | "auto" {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "pt-BR" || v === "en" || v === "es") return v;
  } catch {
    /* sem armazenamento */
  }
  return "auto";
}

let atual: Lang = (() => {
  const c = storedLangChoice();
  return c === "auto" ? systemLang() : c;
})();

if (typeof document !== "undefined") document.documentElement.lang = atual;

/** Idioma da interface agora. */
export function uiLang(): Lang {
  return atual;
}

/** Troca o idioma da interface (grava a escolha e recarrega a tela). */
export function setLangChoice(choice: Lang | "auto", recarregar = true): void {
  try {
    if (choice === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* sem armazenamento */
  }
  atual = choice === "auto" ? systemLang() : choice;
  if (recarregar) window.location.reload();
}

/** Tira o contexto ("HQ|Quadro" -> "Quadro") do texto em português. */
const semContexto = (pt: string) => {
  const i = pt.indexOf("|");
  return i > 0 && !pt.slice(0, i).includes(" ") ? pt.slice(i + 1) : pt;
};

function preencher(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** Texto da interface no idioma atual. */
export function tt(pt: string, params?: Record<string, string | number>): string {
  const tr = atual === "pt-BR" ? undefined : DICTS[atual][pt];
  return preencher(tr || semContexto(pt), params);
}

/** Texto num idioma específico (ex.: o idioma do documento, para "(MAIS)"). */
export function tdoc(lang: Lang | undefined, pt: string, params?: Record<string, string | number>): string {
  const l = lang ?? atual;
  const tr = l === "pt-BR" ? undefined : DICTS[l][pt];
  return preencher(tr || semContexto(pt), params);
}

/** Formatação de números e datas no idioma da interface. */
export const locale = () => (atual === "pt-BR" ? "pt-BR" : atual === "es" ? "es" : "en");
