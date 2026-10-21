// Lista os textos da interface (chaves de tradução) usados no código e mostra o
// que falta traduzir em cada idioma.
//
//   node scripts/i18n-chaves.mjs            resumo por idioma
//   node scripts/i18n-chaves.mjs en         lista o que falta em en.json
//   node scripts/i18n-chaves.mjs --json     todas as chaves, em JSON
//
// As chaves são o texto em português passado para tt("...") ou tdoc(lang, "...").

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(RAIZ, "src");
const LOCALES = join(SRC, "i18n", "locales");

function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(n) && !n.endsWith(".d.ts") ? [p] : [];
  });
}

export function chaves() {
  const out = new Set();
  for (const f of arquivos(SRC)) {
    const src = readFileSync(f, "utf8");
    if (!src.includes("tt(") && !src.includes("tdoc(")) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.ESNext, true, f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const nome = n.expression.text;
        const arg = nome === "tt" ? n.arguments[0] : nome === "tdoc" ? n.arguments[1] : undefined;
        if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) out.add(arg.text);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return [...out].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

const todas = chaves();
const arg = process.argv[2];
if (arg === "--json") {
  console.log(JSON.stringify(todas, null, 2));
} else {
  for (const lang of ["en", "es"]) {
    const dict = JSON.parse(readFileSync(join(LOCALES, `${lang}.json`), "utf8"));
    const faltam = todas.filter((k) => !dict[k]);
    const sobram = Object.keys(dict).filter((k) => !todas.includes(k));
    if (arg === lang) {
      console.log(faltam.join("\n"));
    } else {
      console.log(`${lang}: ${todas.length - faltam.length}/${todas.length} traduzidos, faltam ${faltam.length}, ${sobram.length} sem uso`);
    }
  }
}
