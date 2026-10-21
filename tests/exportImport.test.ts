import { describe, expect, it } from "vitest";
import { sanitizeFileName, toFountain, toMarkdown, webChapters } from "@/domain/export";
import { parseFountain } from "@/domain/import";
import { el, project } from "./helpers";

const roteiro = () =>
  project("roteiro", [
    el("cabecalho", "int. casa - dia"),
    el("acao", "Ana entra."),
    el("personagem", "ana"),
    el("parentese", "baixo"),
    el("dialogo", "Oi."),
    el("transicao", "corta para:"),
  ]);

describe("Fountain", () => {
  it("exporta com a página de rosto e os elementos no padrão", () => {
    const f = toFountain(roteiro());
    expect(f).toContain("Title: Teste");
    expect(f).toContain("Author: Ana");
    expect(f).toContain("INT. CASA - DIA");
    expect(f).toContain("ANA\n(baixo)\nOi.");
    expect(f).toContain("> CORTA PARA:");
  });

  it("importa o que exporta", () => {
    const els = parseFountain(toFountain(roteiro()));
    expect(els.map((e) => [e.tipo, e.texto])).toEqual([
      ["cabecalho", "INT. CASA - DIA"],
      ["acao", "Ana entra."],
      ["personagem", "ANA"],
      ["parentese", "(baixo)"],
      ["dialogo", "Oi."],
      ["transicao", "CORTA PARA:"],
    ]);
  });
});

describe("Markdown", () => {
  it("novel: título, capítulos e negrito/itálico", () => {
    const p = project("novel", [
      el("capitulo", "Um"),
      { ...el("paragrafo", "Era forte e calmo."), marcas: [{ de: 4, ate: 9, tipo: "b" }, { de: 12, ate: 17, tipo: "i" }] },
    ]);
    const md = toMarkdown(p);
    expect(md).toContain("# Teste");
    expect(md).toContain("## Um");
    expect(md).toContain("Era **forte** e *calmo*.");
  });

  it("usa o idioma do documento nas marcas", () => {
    const p = roteiro();
    expect(toMarkdown(p)).toContain("_escrito por Ana_");
    p.meta.idioma = "en";
    expect(toMarkdown(p)).toContain("_written by Ana_");
  });
});

describe("webChapters", () => {
  it("separa por capítulo e escapa o HTML", () => {
    const p = project("novel", [
      el("paragrafo", "Prólogo solto"),
      el("capitulo", ""),
      el("paragrafo", "a < b & c"),
      el("separador", ""),
      el("citacao", "frase"),
    ]);
    const caps = webChapters(p);
    expect(caps).toHaveLength(2);
    expect(caps[0].titulo).toBe("");
    expect(caps[1].titulo).toBe("Capítulo 2");
    expect(caps[1].html).toContain("<p>a &lt; b &amp; c</p>");
    expect(caps[1].html).toContain('class="sep"');
    expect(caps[1].html).toContain("<blockquote>");
  });
});

describe("sanitizeFileName", () => {
  it("tira caracteres proibidos em nomes de arquivo", () => {
    expect(sanitizeFileName('a/b:c*d?"e<f>g|h')).not.toMatch(/[\\/:*?"<>|]/);
  });
});
