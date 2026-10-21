import { describe, expect, it } from "vitest";
import { backupName, parseBackupName, projectSig } from "@/domain/backup";
import { el, project } from "./helpers";

describe("nome dos arquivos de backup", () => {
  it("ida e volta com tipo e episódio", () => {
    const n = backupName(1700000000000, "manual", "ep-2");
    expect(n).toBe("bkp-1700000000000-manual-ep-2.json");
    expect(parseBackupName(n)).toMatchObject({ ms: 1700000000000, tipo: "manual", episodioId: "ep-2" });
  });

  it("nomes antigos, sem tipo, contam como automáticos", () => {
    expect(parseBackupName("bkp-123.json")).toMatchObject({ ms: 123, tipo: "auto", episodioId: null });
  });

  it("ignora arquivos que não são backup", () => {
    expect(parseBackupName("notas.txt")).toBeNull();
    expect(parseBackupName("bkp-abc.json")).toBeNull();
  });
});

describe("projectSig", () => {
  it("igual para o mesmo conteúdo e diferente quando algo muda", () => {
    const a = project("roteiro", [el("acao", "texto", "1")]);
    const b = project("roteiro", [el("acao", "texto", "1")]);
    const c = project("roteiro", [el("acao", "texto!", "1")]);
    b.pesquisa = a.pesquisa;
    c.pesquisa = a.pesquisa;
    expect(projectSig(a)).toBe(projectSig(b));
    expect(projectSig(a)).not.toBe(projectSig(c));
  });
});
