import { describe, expect, it } from "vitest";
import { tdoc, tt } from "@/i18n";
import en from "@/i18n/locales/en.json";
import es from "@/i18n/locales/es.json";

const params = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe("tt e tdoc", () => {
  it("português devolve a própria chave, com parâmetros", () => {
    expect(tdoc("pt-BR", "Excluir \"{nome}\"?", { nome: "Lia" })).toBe('Excluir "Lia"?');
  });

  it("traduz para o idioma pedido", () => {
    expect(tdoc("en", "(MAIS)")).toBe("(MORE)");
    expect(tdoc("es", "Capítulo {n}", { n: 3 })).toBe("Capítulo 3");
  });

  it("texto sem tradução cai para o português", () => {
    expect(tdoc("en", "frase que não existe")).toBe("frase que não existe");
  });

  it("contexto some no português", () => {
    expect(tdoc("pt-BR", "HQ|Quadro")).toBe("Quadro");
    expect(tdoc("en", "HQ|Quadro")).toBe("Panel");
  });

  it("parâmetro sem valor fica como está", () => {
    expect(tt("{n} palavras")).toContain("{n}");
  });
});

describe("arquivos de tradução", () => {
  for (const [nome, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    it(`${nome}: mesmos parâmetros do original e nada vazio`, () => {
      const erros = Object.entries(dict as Record<string, string>).filter(([k, v]) => !v.trim() || params(k).join() !== params(v).join());
      expect(erros).toEqual([]);
    });

    it(`${nome}: sem travessão longo`, () => {
      const com = Object.values(dict as Record<string, string>).filter((v) => v.includes("—"));
      expect(com).toEqual([]);
    });
  }
});
