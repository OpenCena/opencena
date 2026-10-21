// CSS gerado a partir do Layout.

import { ElementType } from "@/types";
import { Layout } from "./profiles";

export function layoutClass(l: Layout): string {
  return `pvl-${l.sig}`;
}

function px(n: number): string {
  return `${n}px`;
}

function cssFor(l: Layout): string {
  const c = `.${layoutClass(l)}`;
  const rules: string[] = [];
  rules.push(`${c} .pv-text {
  font-family: ${l.fontInfo.css};
  font-size: ${l.basePt}pt;
  line-height: ${px(l.lineHeight)};
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  -webkit-font-variant-ligatures: none;
  font-variant-ligatures: none;
  font-feature-settings: "liga" 0;
  font-kerning: none;
  hyphens: ${l.hyphenate ? "auto" : "manual"};
  -webkit-hyphens: ${l.hyphenate ? "auto" : "manual"};
  text-rendering: geometricPrecision;
}`);
  for (const [tipo, s] of Object.entries(l.blocks) as [ElementType, NonNullable<Layout["blocks"][ElementType]>][]) {
    rules.push(`${c} .blk-${tipo} {
  padding: ${px(s.spaceBefore)} ${px(s.indentRight)} 0 ${px(s.indentLeft)};
  text-align: ${s.align};
  ${s.align === "justify" ? "text-align-last: left;" : ""}
  text-transform: ${s.upper ? "uppercase" : "none"};
  font-weight: ${s.bold ? 700 : 400};
  font-style: ${s.italic ? "italic" : "normal"};
  font-size: ${s.fontPt}pt;
  line-height: ${px(s.lineHeight)};
  text-indent: ${px(s.firstIndent)};
  ${s.muted ? "color: var(--text-muted);" : ""}
}`);
    if (s.prefix) {
      rules.push(`${c} .blk-${tipo}::before { content: "${s.prefix}"; font-weight: 700; font-style: normal; }`);
    }
  }
  // Rótulos automáticos (PÁGINA 3, QUADRO 2, * * *): fazem parte do texto medido.
  rules.push(`${c} .blk[data-label]::before { content: attr(data-label); font-weight: inherit; }`);
  rules.push(`${c} .blk.no-indent { text-indent: 0; }`);
  // Trechos em itálico/negrito usam métricas de fonte um pouco diferentes; com
  // altura de linha zero eles não "esticam" a linha, todas as linhas do bloco
  // ficam com a mesma altura e a paginação não acumula desvio.
  rules.push(`${c} .pv-text em, ${c} .pv-text strong, ${c} .pv-text .pg-hyph { line-height: 0; }`);
  rules.push(`${c} .blk.has-contd::after { content: " ${l.contd}"; }`);
  // Placeholder do bloco vazio (só no editor; flutua com altura zero, então não
  // muda a altura do bloco). Blocos com rótulo/prefixo não mostram placeholder.
  const semPrefixo = (Object.entries(l.blocks) as [ElementType, { prefix: string }][])
    .filter(([, s]) => s.prefix)
    .map(([t]) => `:not(.blk-${t})`)
    .join("");
  rules.push(`${c} .blk.is-empty:not([data-label])${semPrefixo}::before {
  content: attr(data-placeholder);
  color: var(--text-faint);
  pointer-events: none;
  float: left;
  height: 0;
  font-weight: 400;
  font-style: normal;
  text-transform: none;
}`);
  return rules.join("\n");
}

const injected = new Set<string>();

/** Garante que o CSS do layout está na página e devolve a classe a usar. */
export function ensureLayoutCss(l: Layout): string {
  const cls = layoutClass(l);
  if (!injected.has(cls)) {
    const tag = document.createElement("style");
    tag.dataset.layout = cls;
    tag.textContent = cssFor(l);
    document.head.appendChild(tag);
    injected.add(cls);
  }
  return cls;
}
