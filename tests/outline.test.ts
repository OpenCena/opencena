import { describe, expect, it } from "vitest";
import {
  applyTemplate,
  detectCharacters,
  headingToSection,
  migrateCardColors,
  moveCardSection,
  moveSection,
  plantWarnings,
  reorderDocByCards,
  sectionInfo,
  sectionRanges,
  TEMPLATES,
} from "@/domain/outline";
import { card, el, ids } from "./helpers";

// Roteiro com três cenas: s1 (a1, p1, d1), s2 (a2), s3 (a3)
const doc = () => [
  el("cabecalho", "INT. CASA - DIA", "s1"),
  el("acao", "Ana entra.", "a1"),
  el("personagem", "ANA", "p1"),
  el("dialogo", "Oi.", "d1"),
  el("cabecalho", "EXT. RUA - NOITE", "s2"),
  el("acao", "Chove.", "a2"),
  el("cabecalho", "INT. CARRO - NOITE", "s3"),
  el("acao", "Silêncio.", "a3"),
];

describe("sectionRanges", () => {
  it("cada seção vai do cabeçalho até o próximo", () => {
    const r = sectionRanges(doc(), "cabecalho");
    expect(r.get("s1")).toEqual({ de: 0, ate: 4 });
    expect(r.get("s2")).toEqual({ de: 4, ate: 6 });
    expect(r.get("s3")).toEqual({ de: 6, ate: 8 });
  });
});

describe("moveSection", () => {
  it("leva a cena inteira para antes de outra", () => {
    const out = moveSection(doc(), "cabecalho", "s3", "s1");
    expect(ids(out)).toEqual(["s3", "a3", "s1", "a1", "p1", "d1", "s2", "a2"]);
  });

  it("leva a cena para o fim", () => {
    const out = moveSection(doc(), "cabecalho", "s1", null);
    expect(ids(out)).toEqual(["s2", "a2", "s3", "a3", "s1", "a1", "p1", "d1"]);
  });

  it("não muda nada com id desconhecido ou igual ao destino", () => {
    const d = doc();
    expect(moveSection(d, "cabecalho", "xx", "s1")).toBe(d);
    expect(moveSection(d, "cabecalho", "s1", "s1")).toBe(d);
  });

  it("não perde nem duplica blocos", () => {
    const out = moveSection(doc(), "cabecalho", "s2", "s1");
    expect([...ids(out)].sort()).toEqual([...ids(doc())].sort());
  });
});

describe("reorderDocByCards", () => {
  it("segue a ordem dos cartões ligados", () => {
    const cartoes = [card({ elementoId: "s3" }), card({ elementoId: "s1" }), card({ elementoId: "s2" })];
    const out = reorderDocByCards(doc(), "cabecalho", cartoes);
    expect(out.filter((e) => e.tipo === "cabecalho").map((e) => e.id)).toEqual(["s3", "s1", "s2"]);
  });

  it("ignora cartões sem ligação", () => {
    const cartoes = [card({ elementoId: "s2" }), card({}), card({ elementoId: "s1" })];
    const out = reorderDocByCards(doc(), "cabecalho", cartoes);
    expect(out.filter((e) => e.tipo === "cabecalho").map((e) => e.id)).toEqual(["s2", "s1", "s3"]);
  });
});

describe("moveCardSection", () => {
  it("põe a cena antes da cena do próximo cartão ligado", () => {
    const cartoes = [card({ id: "k1", elementoId: "s1" }), card({ id: "k3", elementoId: "s3" }), card({ id: "k2", elementoId: "s2" })];
    const out = moveCardSection(doc(), "cabecalho", cartoes, "k3");
    expect(out.filter((e) => e.tipo === "cabecalho").map((e) => e.id)).toEqual(["s1", "s3", "s2"]);
  });

  it("no fim da escaleta, vai para depois da cena do cartão anterior", () => {
    const cartoes = [card({ id: "k2", elementoId: "s2" }), card({ id: "k3", elementoId: "s3" }), card({ id: "k1", elementoId: "s1" })];
    const out = moveCardSection(doc(), "cabecalho", cartoes, "k1");
    expect(out.filter((e) => e.tipo === "cabecalho").map((e) => e.id)).toEqual(["s2", "s3", "s1"]);
  });
});

describe("sectionInfo e detectCharacters", () => {
  it("lê ambiente, período, quem fala e palavras", () => {
    const info = sectionInfo(doc(), "cabecalho");
    const s1 = info.get("s1")!;
    expect(s1.ambiente).toBe("INT");
    expect(s1.periodo).toBe("DIA");
    expect(s1.falam).toEqual(["ANA"]);
    expect(info.get("s2")!.ambiente).toBe("EXT");
  });

  it("reconhece personagens cadastrados pelo nome", () => {
    expect(detectCharacters(["ANA"], [{ id: "x", nome: "Ana" }, { id: "y", nome: "Beto" }])).toEqual(["x"]);
  });
});

describe("headingToSection", () => {
  it("roteiro em maiúsculas; HQ sem o prefixo PÁGINA", () => {
    expect(headingToSection("roteiro", "int. casa - dia")).toBe("INT. CASA - DIA");
    expect(headingToSection("quadrinhos", "PÁGINA 3: a fuga")).toBe("a fuga");
    expect(headingToSection("novel", "O começo")).toBe("O começo");
  });
});

describe("plantWarnings", () => {
  it("avisa plantio sem retorno e retorno antes do plantio", () => {
    const a = card({ id: "a", plantios: [{ id: "p1", texto: "a carta" }, { id: "p2", texto: "a chave", colheitaId: "c" }] });
    const b = card({ id: "b", plantios: [{ id: "p3", texto: "o anel", colheitaId: "a" }] });
    const c = card({ id: "c", plantios: [{ id: "p4", texto: "   " }] });
    const w = plantWarnings([a, b, c]);
    expect(w.map((x) => [x.plantioId, x.motivo])).toEqual([
      ["p1", "sem-retorno"],
      ["p3", "retorno-antes"],
    ]);
  });
});

describe("applyTemplate", () => {
  it("acrescenta atos e um cartão-guia por batida, sem tirar os existentes", () => {
    const t = TEMPLATES[0];
    const antigo = card({ id: "velho" });
    const o = applyTemplate({ atos: [], cartoes: [antigo] }, t);
    const batidas = t.atos.reduce((n, a) => n + a.batidas.length, 0);
    expect(o.atos).toHaveLength(t.atos.length);
    expect(o.cartoes).toHaveLength(1 + batidas);
    expect(o.cartoes[0].id).toBe("velho");
    expect(o.cartoes.slice(1).every((c) => !!c.guia && !!c.atoId)).toBe(true);
    expect(o.cartoes.map((c) => c.numero)).toEqual(o.cartoes.map((_, i) => i + 1));
  });
});

describe("migrateCardColors", () => {
  it("transforma cores antigas em tramas com nome", () => {
    const o = migrateCardColors({ atos: [], cartoes: [card({ cor: "azul" }), card({ cor: "azul" }), card({ cor: "verde" })] });
    expect(o.tramas).toHaveLength(2);
    expect(o.cartoes.every((c) => c.tramaId && !c.cor)).toBe(true);
    expect(o.cartoes[0].tramaId).toBe(o.cartoes[1].tramaId);
  });
});
