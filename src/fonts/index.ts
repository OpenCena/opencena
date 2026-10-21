// Fontes empacotadas com o app (funcionam sem internet).

// tela
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/courier-prime/latin-400.css";
import "@fontsource/courier-prime/latin-700.css";
import "@fontsource/courier-prime/latin-400-italic.css";
import "@fontsource/courier-prime/latin-700-italic.css";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-700.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import "@fontsource/eb-garamond/latin-700-italic.css";
import "@fontsource/libre-baskerville/latin-400.css";
import "@fontsource/libre-baskerville/latin-700.css";
import "@fontsource/libre-baskerville/latin-400-italic.css";
import "@fontsource/libre-baskerville/latin-700-italic.css";
import "@fontsource/crimson-text/latin-400.css";
import "@fontsource/crimson-text/latin-700.css";
import "@fontsource/crimson-text/latin-400-italic.css";
import "@fontsource/crimson-text/latin-700-italic.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-700.css";
import "@fontsource/lora/latin-400-italic.css";
import "@fontsource/lora/latin-700-italic.css";
import "@fontsource/literata/latin-400.css";
import "@fontsource/literata/latin-700.css";
import "@fontsource/literata/latin-400-italic.css";
import "@fontsource/literata/latin-700-italic.css";

// arquivos para o PDF
import garamond400 from "@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff?url";
import garamond700 from "@fontsource/eb-garamond/files/eb-garamond-latin-700-normal.woff?url";
import garamond400i from "@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff?url";
import garamond700i from "@fontsource/eb-garamond/files/eb-garamond-latin-700-italic.woff?url";
import bask400 from "@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff?url";
import bask700 from "@fontsource/libre-baskerville/files/libre-baskerville-latin-700-normal.woff?url";
import bask400i from "@fontsource/libre-baskerville/files/libre-baskerville-latin-400-italic.woff?url";
import bask700i from "@fontsource/libre-baskerville/files/libre-baskerville-latin-700-italic.woff?url";
import crimson400 from "@fontsource/crimson-text/files/crimson-text-latin-400-normal.woff?url";
import crimson700 from "@fontsource/crimson-text/files/crimson-text-latin-700-normal.woff?url";
import crimson400i from "@fontsource/crimson-text/files/crimson-text-latin-400-italic.woff?url";
import crimson700i from "@fontsource/crimson-text/files/crimson-text-latin-700-italic.woff?url";
import lora400 from "@fontsource/lora/files/lora-latin-400-normal.woff?url";
import lora700 from "@fontsource/lora/files/lora-latin-700-normal.woff?url";
import lora400i from "@fontsource/lora/files/lora-latin-400-italic.woff?url";
import lora700i from "@fontsource/lora/files/lora-latin-700-italic.woff?url";
import literata400 from "@fontsource/literata/files/literata-latin-400-normal.woff?url";
import literata700 from "@fontsource/literata/files/literata-latin-700-normal.woff?url";
import literata400i from "@fontsource/literata/files/literata-latin-400-italic.woff?url";
import literata700i from "@fontsource/literata/files/literata-latin-700-italic.woff?url";
import courier400 from "@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff?url";
import courier700 from "@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff?url";
import courier400i from "@fontsource/courier-prime/files/courier-prime-latin-400-italic.woff?url";
import courier700i from "@fontsource/courier-prime/files/courier-prime-latin-700-italic.woff?url";

export type PdfStyle = "normal" | "bold" | "italic" | "bolditalic";

/** Arquivos de cada família embutível no PDF (nome da família = nome no CSS). */
export const EMBED_FILES: Record<string, Record<PdfStyle, string>> = {
  "EB Garamond": { normal: garamond400, bold: garamond700, italic: garamond400i, bolditalic: garamond700i },
  "Libre Baskerville": { normal: bask400, bold: bask700, italic: bask400i, bolditalic: bask700i },
  "Crimson Text": { normal: crimson400, bold: crimson700, italic: crimson400i, bolditalic: crimson700i },
  Lora: { normal: lora400, bold: lora700, italic: lora400i, bolditalic: lora700i },
  Literata: { normal: literata400, bold: literata700, italic: literata400i, bolditalic: literata700i },
  "Courier Prime": { normal: courier400, bold: courier700, italic: courier400i, bolditalic: courier700i },
};

// WOFF -> TTF
async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export interface TtfFont {
  ttf: Uint8Array;
  /** Métricas verticais (em "em"), para achar a linha de base como o navegador. */
  ascent: number;
  descent: number;
}

async function woffToTtf(woff: ArrayBuffer): Promise<TtfFont> {
  const dv = new DataView(woff);
  if (dv.getUint32(0) !== 0x774f4646) throw new Error("Fonte em formato inesperado.");
  const flavor = dv.getUint32(4);
  const numTables = dv.getUint16(12);
  const tables: { tag: number; data: Uint8Array; checksum: number }[] = [];
  for (let i = 0; i < numTables; i++) {
    const e = 44 + i * 20;
    const tag = dv.getUint32(e);
    const off = dv.getUint32(e + 4);
    const comp = dv.getUint32(e + 8);
    const orig = dv.getUint32(e + 12);
    const checksum = dv.getUint32(e + 16);
    const raw = new Uint8Array(woff, off, comp);
    tables.push({ tag, checksum, data: comp < orig ? await inflate(raw) : raw.slice() });
  }
  tables.sort((a, b) => a.tag - b.tag);
  const headerLen = 12 + 16 * numTables;
  let size = headerLen;
  for (const t of tables) size += (t.data.length + 3) & ~3;
  const out = new Uint8Array(size);
  const ov = new DataView(out.buffer);
  let pow = 1;
  let log = 0;
  while (pow * 2 <= numTables) {
    pow *= 2;
    log++;
  }
  ov.setUint32(0, flavor);
  ov.setUint16(4, numTables);
  ov.setUint16(6, pow * 16);
  ov.setUint16(8, log);
  ov.setUint16(10, numTables * 16 - pow * 16);
  let off = headerLen;
  let ascent = 0.9;
  let descent = 0.25;
  let upem = 1000;
  tables.forEach((t, i) => {
    const r = 12 + i * 16;
    ov.setUint32(r, t.tag);
    ov.setUint32(r + 4, t.checksum);
    ov.setUint32(r + 8, off);
    ov.setUint32(r + 12, t.data.length);
    out.set(t.data, off);
    off += (t.data.length + 3) & ~3;
  });
  const find = (tag: string) => tables.find((t) => t.tag === new DataView(new TextEncoder().encode(tag).buffer).getUint32(0));
  const head = find("head");
  const hhea = find("hhea");
  if (head) upem = new DataView(head.data.buffer, head.data.byteOffset).getUint16(18);
  if (hhea) {
    const hv = new DataView(hhea.data.buffer, hhea.data.byteOffset);
    ascent = hv.getInt16(4) / upem;
    descent = -hv.getInt16(6) / upem;
  }
  return { ttf: out, ascent, descent };
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const cache = new Map<string, Promise<TtfFont & { b64: string }>>();

/** Carrega (uma vez) o TTF de uma família/estilo, pronto para o jsPDF. */
export function loadEmbedFont(family: string, style: PdfStyle): Promise<TtfFont & { b64: string }> {
  const key = `${family}|${style}`;
  let p = cache.get(key);
  if (!p) {
    const url = EMBED_FILES[family]?.[style];
    if (!url) return Promise.reject(new Error(`Fonte não empacotada: ${family}`));
    p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then(woffToTtf)
      .then((f) => ({ ...f, b64: toBase64(f.ttf) }));
    cache.set(key, p);
  }
  return p;
}

/** Garante que a fonte da tela já carregou (antes de medir o texto). */
export async function ensureScreenFont(family: string): Promise<void> {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load(`400 16px "${family}"`),
    document.fonts.load(`700 16px "${family}"`),
    document.fonts.load(`italic 400 16px "${family}"`),
    document.fonts.load(`italic 700 16px "${family}"`),
  ]).catch(() => undefined);
}
