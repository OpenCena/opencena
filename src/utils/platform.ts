// Diferenças de sistema: no Mac os atalhos usam ⌘ em vez de Ctrl.
const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

export const isMac = /Mac|iPhone|iPad/.test(ua);

/** Nome da tecla modificadora para mostrar em dicas ("Ctrl" ou "⌘"). */
export const MOD = isMac ? "⌘" : "Ctrl";

/** Monta o texto de um atalho: kbd("Shift", "F") -> "Ctrl+Shift+F" / "⌘⇧F". */
export function kbd(...keys: string[]): string {
  if (!isMac) return [MOD, ...keys].join("+");
  return MOD + keys.map((k) => (k === "Shift" ? "⇧" : k)).join("");
}
