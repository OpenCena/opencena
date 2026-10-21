import { describe, expect, it } from "vitest";
import { ideasToBoard, researchFromV1 } from "@/domain/migrations";
import { joinResearch, splitResearch } from "@/domain/researchStore";
import { emptyBoard } from "@/domain/project";
import type { Idea, Reference } from "@/types";

const ref = (id: string, tipo: Reference["tipo"]): Reference => ({ id, tipo, titulo: id, notas: "", vinculos: [], criadaEm: "" });

describe("researchFromV1 (v1 -> v2)", () => {
  it("o quadro antigo vira o primeiro quadro", () => {
    const board = { ...emptyBoard(), itens: [{ id: "i1", tipo: "referencia" as const, refId: "r1", x: 0, y: 0, w: 10, h: 10 }] };
    const t = researchFromV1(board, [ref("r1", "imagem")]);
    expect(t.nos).toHaveLength(1);
    expect(t.nos[0].tipo).toBe("quadro");
    expect(t.nos[0].quadro?.itens).toHaveLength(1);
  });

  it("referências fora do quadro vão para um quadro novo, em grade", () => {
    const t = researchFromV1(undefined, [ref("r1", "imagem"), ref("r2", "link"), ref("r3", "documento")]);
    expect(t.nos).toHaveLength(2);
    const itens = t.nos[1].quadro!.itens;
    expect(itens.map((i) => i.refId)).toEqual(["r1", "r2", "r3"]);
    expect(new Set(itens.map((i) => `${i.x},${i.y}`)).size).toBe(3);
  });
});

describe("ideasToBoard (v3 -> v4)", () => {
  const idea = (id: string, p: Partial<Idea> = {}): Idea => ({ id, titulo: "", texto: "", tag: "geral", fixada: false, criadaEm: "", ...p });

  it("sem ideias, nada muda", () => {
    const tree = { nos: [] };
    expect(ideasToBoard(tree, [])).toBe(tree);
  });

  it("cada ideia vira uma nota, fixadas primeiro, com título e texto", () => {
    const t = ideasToBoard({ nos: [] }, [idea("a", { texto: "solta" }), idea("b", { titulo: "Título", texto: "corpo", fixada: true, tag: "personagem", cartaoId: "k1" })]);
    expect(t.nos).toHaveLength(1);
    const itens = t.nos[0].quadro!.itens;
    expect(itens.map((i) => i.id)).toEqual(["b", "a"]);
    expect(itens[0].texto).toBe("Título\ncorpo");
    expect(itens[0].cor).toBe("lilas");
    expect(itens[0].cartaoId).toBe("k1");
  });

  it("o quadro de ideias entra antes dos outros", () => {
    const t = ideasToBoard({ nos: [{ id: "x", tipo: "pasta", titulo: "P", paiId: null, criadoEm: "" }] }, [idea("a", { texto: "t" })]);
    expect(t.nos.map((n) => n.tipo)).toEqual(["quadro", "pasta"]);
  });
});

describe("splitResearch / joinResearch", () => {
  it("separa conteúdo do índice e junta de volta igual", () => {
    const tree = {
      nos: [
        { id: "p", tipo: "pasta" as const, titulo: "Pasta", paiId: null, criadoEm: "" },
        { id: "q", tipo: "quadro" as const, titulo: "Quadro", paiId: "p", quadro: emptyBoard(), criadoEm: "" },
        { id: "d", tipo: "pagina" as const, titulo: "Página", paiId: "p", doc: { type: "doc", content: [] }, criadoEm: "" },
      ],
    };
    const { indice, conteudos } = splitResearch(tree);
    expect(indice.nos.some((n) => "quadro" in n || "doc" in n)).toBe(false);
    expect([...conteudos.keys()]).toEqual(["q", "d"]);
    expect(joinResearch(indice, conteudos)).toEqual(tree);
  });
});
