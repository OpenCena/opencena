// Atributos "estáticos" de cada bloco, derivados do documento inteiro.

import { ElementType } from "@/types";
import { Layout, q } from "./profiles";
import { cleanCharacterName, computeContdIds } from "@/domain/screenplay";
import { Lang, tdoc, tt } from "@/i18n";

export interface BlockSource {
  id: string;
  tipo: ElementType;
  texto: string;
}

export interface StaticAttrs {
  /** Rótulo exibido antes do texto (::before), ex.: "PÁGINA 3 (2 QUADROS): ". */
  label?: string;
  /** Número do balão/legenda na página da HQ (na margem; não muda o layout). */
  bn?: number;
  /** Número da cena (roteiro; na margem). */
  scene?: number;
  /** Personagem retomando a fala: " (CONT'D)" depois do nome. */
  contd?: boolean;
  /** Parágrafo sem recuo de primeira linha. */
  noIndent?: boolean;
  /** Espaço antes efetivo (px), já considerando o bloco anterior. */
  sb: number;
  /** Informação só de tela (ex.: "4 quadros · 87 palavras"). */
  info?: string;
  /** Nome do personagem que está falando (para "NOME (CONT'D)" na quebra). */
  speaker?: string;
}

/** Parte da assinatura que afeta a quebra de linha (chave do cache do medidor). */
export function layoutSig(a: StaticAttrs): string {
  return `${a.label ?? ""}|${a.contd ? 1 : 0}|${a.noIndent ? 1 : 0}`;
}

function quadrosLabel(n: number, lang: Lang): string {
  if (n === 1) return tdoc(lang, "1 QUADRO");
  return tdoc(lang, "{n} QUADROS", { n });
}

function words(s: string): number {
  const m = s.trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function computeStatics(
  blocks: BlockSource[],
  layout: Layout,
  opts: { contd: boolean }
): StaticAttrs[] {
  const out: StaticAttrs[] = blocks.map(() => ({ sb: 0 }));
  const st = layout.blocks;

  // espaço antes efetivo
  blocks.forEach((b, i) => {
    const s = st[b.tipo];
    if (!s) return;
    if (i === 0) {
      out[i].sb = 0;
      return;
    }
    const prev = blocks[i - 1];
    const ps = st[prev.tipo];
    const own = s.tightAfter.includes(prev.tipo) ? 0 : s.spaceBefore;
    out[i].sb = q(own + (ps?.spaceAfter ?? 0));
  });

  if (layout.kind === "roteiro") {
    const contd = opts.contd ? computeContdIds(blocks) : new Set<string>();
    let cena = 0;
    let speaker = "";
    blocks.forEach((b, i) => {
      if (b.tipo === "cabecalho") {
        cena += 1;
        if (layout.sceneNumbers) out[i].scene = cena;
      }
      if (b.tipo === "personagem") {
        speaker = cleanCharacterName(b.texto);
        if (contd.has(b.id)) out[i].contd = true;
      }
      if (b.tipo === "dialogo" || b.tipo === "parentese") out[i].speaker = speaker;
      if (b.tipo === "cabecalho" || b.tipo === "acao" || b.tipo === "transicao") speaker = "";
    });
  } else if (layout.kind === "quadrinhos") {
    // Numeração: páginas no documento todo; quadros e balões reiniciam por página.
    let quadro = 0;
    let balao = 0;
    let pageIdx = -1;
    const pageStats: { quadros: number; palavras: number }[] = [];
    blocks.forEach((b, i) => {
      if (b.tipo === "pagina") {
        quadro = 0;
        balao = 0;
        pageIdx = i;
        pageStats[i] = { quadros: 0, palavras: 0 };
      } else if (b.tipo === "quadro") {
        quadro += 1;
        out[i].label = `${tdoc(layout.lang, "QUADRO {n}", { n: quadro })}${b.texto.trim() ? ": " : ""}`;
        if (pageIdx >= 0) pageStats[pageIdx].quadros += 1;
      } else if (b.tipo === "balao" || b.tipo === "legenda") {
        balao += 1;
        out[i].bn = balao;
        if (pageIdx >= 0) pageStats[pageIdx].palavras += words(b.texto);
      } else if (b.tipo === "sfx") {
        if (pageIdx >= 0) pageStats[pageIdx].palavras += words(b.texto);
      }
    });
    // Rótulo da página precisa da contagem de quadros (segunda passada).
    let n = 0;
    blocks.forEach((b, i) => {
      if (b.tipo !== "pagina") return;
      n += 1;
      const ps = pageStats[i] ?? { quadros: 0, palavras: 0 };
      out[i].label = `${tdoc(layout.lang, "PÁGINA {n}", { n })}${ps.quadros ? ` (${quadrosLabel(ps.quadros, layout.lang)})` : ""}${
        b.texto.trim() ? ": " : ""
      }`;
      out[i].info = `${ps.quadros === 1 ? tt("1 quadro") : tt("{n} quadros", { n: ps.quadros })} · ${ps.palavras === 1 ? tt("1 palavra") : tt("{n} palavras", { n: ps.palavras })}`;
    });
  } else {
    // Novel: parágrafo depois de capítulo/separador (ou no início) não tem recuo.
    blocks.forEach((b, i) => {
      if (b.tipo === "separador" && !b.texto.trim()) out[i].label = "*   *   *";
      if (b.tipo !== "paragrafo") return;
      const prev = blocks[i - 1];
      if (!prev || st[prev.tipo]?.noIndentNext) out[i].noIndent = true;
    });
  }
  return out;
}

/** Texto do prefixo/rótulo desenhado antes da 1ª linha (para o PDF). */
export function prefixText(layout: Layout, tipo: ElementType, a: StaticAttrs): string {
  return (layout.blocks[tipo]?.prefix ?? "") + (a.label ?? "");
}
