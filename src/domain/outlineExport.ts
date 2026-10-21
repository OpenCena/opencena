// Exportar a escaleta (para pitch, sala de roteiro ou desenhista): PDF e Word.

import { jsPDF } from "jspdf";
import { Character, LoadedProject, OutlineCard } from "@/types";
import { kindOf } from "@/layout/profiles";
import { makeZip } from "./zip";
import { tt } from "@/i18n";

const STATUS: Record<string, string> = { afazer: "A fazer", escrevendo: "Escrevendo", pronto: "Pronto" };

interface Linha {
  ato?: string;
  card?: OutlineCard;
}

function grupos(project: LoadedProject): Linha[] {
  const { atos, cartoes } = project.outline;
  const out: Linha[] = [];
  const semAto = cartoes.filter((c) => !c.atoId || !atos.some((a) => a.id === c.atoId));
  for (const a of atos) {
    out.push({ ato: a.titulo || "Ato" });
    cartoes.filter((c) => c.atoId === a.id).forEach((card) => out.push({ card }));
  }
  if (semAto.length) {
    if (atos.length) out.push({ ato: tt("Sem ato") });
    semAto.forEach((card) => out.push({ card }));
  }
  return out;
}

function detalhes(project: LoadedProject, c: OutlineCard, characters: Character[]): string[] {
  const nomes = new Map(characters.map((p) => [p.id, p.nome]));
  const tramas = new Map((project.outline.tramas ?? []).map((t) => [t.id, t.nome]));
  const linhas: string[] = [];
  const meta = [
    STATUS[c.status ?? "afazer"],
    c.tramaId && tramas.get(c.tramaId),
    c.personagemIds.length ? c.personagemIds.map((id) => nomes.get(id)).filter(Boolean).join(", ") : "",
    (c.etiquetas ?? []).join(", "),
  ].filter(Boolean);
  if (meta.length) linhas.push(meta.join(" · "));
  if (c.objetivo) linhas.push(`Objetivo: ${c.objetivo}`);
  if (c.conflito) linhas.push(`Conflito: ${c.conflito}`);
  for (const p of c.plantios ?? []) if (p.texto.trim()) linhas.push(`Planta: ${p.texto}`);
  if (c.observacoes) linhas.push(`Notas: ${c.observacoes}`);
  return linhas;
}

function rotulo(project: LoadedProject, c: OutlineCard): string {
  const k = kindOf(project.meta).id;
  const nome = k === "novel" ? tt("Capítulo") : k === "quadrinhos" ? tt("Página") : tt("Cena");
  return `${nome} ${c.numero}${c.cabecalho ? `: ${c.cabecalho}` : ""}`;
}

export function outlineTitle(project: LoadedProject): string {
  return `${project.cover.titulo || project.meta.nome} · ${kindOf(project.meta).id === "novel" ? "Estrutura" : "Escaleta"}`;
}

export function outlineToPdf(project: LoadedProject): Blob {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 56;
  let y = M;
  const nova = (alt: number) => {
    if (y + alt > H - M) {
      pdf.addPage();
      y = M;
    }
  };
  const texto = (t: string, size: number, style: "normal" | "bold" | "italic", cor = 20, indent = 0) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    pdf.setTextColor(cor);
    const linhas = pdf.splitTextToSize(t, W - 2 * M - indent) as string[];
    for (const l of linhas) {
      nova(size * 1.35);
      pdf.text(l, M + indent, y);
      y += size * 1.35;
    }
  };
  texto(outlineTitle(project), 18, "bold");
  const autor = project.cover.autor || project.meta.autor;
  if (autor) texto(autor, 11, "normal", 110);
  y += 14;
  for (const l of grupos(project)) {
    if (l.ato) {
      y += 10;
      nova(40);
      texto(l.ato.toUpperCase(), 11, "bold", 60);
      pdf.setDrawColor(200);
      pdf.line(M, y - 6, W - M, y - 6);
      y += 6;
      continue;
    }
    const c = l.card!;
    nova(40);
    texto(rotulo(project, c), 11, "bold");
    if (c.resumo) texto(c.resumo, 10.5, "normal", 30, 12);
    for (const d of detalhes(project, c, project.characters)) texto(d, 9, "italic", 110, 12);
    y += 8;
  }
  return pdf.output("blob");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const run = (t: string, o: { b?: boolean; i?: boolean; sz?: number; cor?: string } = {}) =>
  `<w:r><w:rPr>${o.b ? "<w:b/>" : ""}${o.i ? "<w:i/>" : ""}${o.cor ? `<w:color w:val="${o.cor}"/>` : ""}${o.sz ? `<w:sz w:val="${o.sz}"/>` : ""}</w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
const par = (runs: string, o: { antes?: number; depois?: number; recuo?: number; borda?: boolean } = {}) =>
  `<w:p><w:pPr>${o.borda ? '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="2" w:color="BBBBBB"/></w:pBdr>' : ""}<w:spacing w:before="${o.antes ?? 0}" w:after="${o.depois ?? 80}"/>${o.recuo ? `<w:ind w:left="${o.recuo}"/>` : ""}</w:pPr>${runs}</w:p>`;

export function outlineToDocx(project: LoadedProject): Blob {
  const corpo: string[] = [];
  corpo.push(par(run(outlineTitle(project), { b: true, sz: 36 }), { depois: 60 }));
  const autor = project.cover.autor || project.meta.autor;
  if (autor) corpo.push(par(run(autor, { cor: "666666", sz: 22 }), { depois: 240 }));
  for (const l of grupos(project)) {
    if (l.ato) {
      corpo.push(par(run(l.ato.toUpperCase(), { b: true, sz: 22, cor: "444444" }), { antes: 280, depois: 120, borda: true }));
      continue;
    }
    const c = l.card!;
    corpo.push(par(run(rotulo(project, c), { b: true, sz: 22 }), { antes: 120, depois: 40 }));
    if (c.resumo) corpo.push(par(run(c.resumo, { sz: 21 }), { recuo: 240, depois: 40 }));
    for (const d of detalhes(project, c, project.characters)) corpo.push(par(run(d, { i: true, sz: 18, cor: "777777" }), { recuo: 240, depois: 20 }));
  }
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corpo.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  return makeZip([
    { name: "[Content_Types].xml", data: types },
    { name: "_rels/.rels", data: rels },
    { name: "word/document.xml", data: document },
    { name: "word/styles.xml", data: styles },
    { name: "word/_rels/document.xml.rels", data: docRels },
  ]);
}
