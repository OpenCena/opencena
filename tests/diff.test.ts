import { describe, expect, it } from "vitest";
import { countWords, diffBlocks, diffWords } from "@/domain/diff";
import { el } from "./helpers";

const juntar = (ops: { t: string; s: string }[], t: string[]) =>
  ops
    .filter((o) => t.includes(o.t))
    .map((o) => o.s)
    .join("");

describe("diffWords", () => {
  it("devolve um único trecho igual quando os textos são iguais", () => {
    expect(diffWords("a casa azul", "a casa azul")).toEqual([{ t: "eq", s: "a casa azul" }]);
  });

  it("marca só a palavra trocada", () => {
    const ops = diffWords("a casa azul", "a casa verde");
    expect(ops).toEqual([
      { t: "eq", s: "a casa " },
      { t: "del", s: "azul" },
      { t: "add", s: "verde" },
    ]);
  });

  it("reconstrói os dois textos", () => {
    const a = "Ela abre a porta, devagar. Ninguém.";
    const b = "Ela abre a janela devagar. Ninguém responde.";
    const ops = diffWords(a, b);
    expect(juntar(ops, ["eq", "del"])).toBe(a);
    expect(juntar(ops, ["eq", "add"])).toBe(b);
  });

  it("trata pontuação como pedaço separado", () => {
    const ops = diffWords("Oi.", "Oi!");
    expect(ops).toEqual([
      { t: "eq", s: "Oi" },
      { t: "del", s: "." },
      { t: "add", s: "!" },
    ]);
  });
});

describe("diffBlocks", () => {
  it("casa blocos pelo id e detecta alterados, inseridos e removidos", () => {
    const a = [el("acao", "um", "1"), el("acao", "dois", "2"), el("dialogo", "três", "3")];
    const b = [el("acao", "um", "1"), el("acao", "dois!", "2"), el("acao", "novo", "4")];
    const d = diffBlocks(a, b);
    expect(d.map((x) => x.op)).toEqual(["eq", "mod", "del", "add"]);
    expect(d[2].el.id).toBe("3");
    expect(d[3].el.id).toBe("4");
  });

  it("um removido seguido de inserido do mesmo tipo vira edição", () => {
    const a = [el("acao", "velho", "1")];
    const b = [el("acao", "novo", "2")];
    const d = diffBlocks(a, b);
    expect(d).toHaveLength(1);
    expect(d[0].op).toBe("mod");
  });

  it("tipos diferentes continuam como removido e inserido", () => {
    const d = diffBlocks([el("acao", "x", "1")], [el("dialogo", "x", "2")]);
    expect(d.map((x) => x.op)).toEqual(["del", "add"]);
  });

  it("bloco movido aparece como removido e inserido, não como igual", () => {
    const a = [el("acao", "A", "1"), el("acao", "B", "2"), el("acao", "C", "3")];
    const b = [a[2], a[0], a[1]];
    const d = diffBlocks(a, b);
    // a maior sequência em ordem (A, B) fica igual; C mudou de lugar
    expect(d.filter((x) => x.op === "eq").map((x) => x.el.id)).toEqual(["1", "2"]);
  });
});

describe("countWords", () => {
  it("conta palavras e ignora blocos vazios", () => {
    expect(countWords([el("acao", "  duas palavras "), el("acao", ""), el("acao", "três")])).toBe(3);
  });
});
