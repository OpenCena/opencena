import { useApp } from "@/store/appStore";
import { Character, CharacterRelation } from "@/types";
import { newId } from "@/domain/project";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { BibleView } from "@/components/BibleView";
import { tt } from "@/i18n";

function emptyCharacter(): Character {
  return {
    id: newId(),
    nome: "",
    nomeCompleto: "",
    idade: "",
    descricao: "",
    aparencia: "",
    personalidade: "",
    historia: "",
    objetivos: "",
    medos: "",
    conflitos: "",
    arco: "",
    relacoes: [],
  };
}

const PAPEIS = [tt("Protagonista"), tt("Antagonista"), tt("Coadjuvante"), tt("Figurante")];

export function CharactersTab() {
  const characters = useApp((s) => s.current!.project.characters);
  const updateCharacters = useApp((s) => s.updateCharacters);
  const novel = useApp((s) => s.current!.project.meta.tipo === "novel");

  // ao excluir alguém, some das relações dos outros
  function onChange(next: Character[]) {
    const ids = new Set(next.map((c) => c.id));
    updateCharacters(
      next.map((c) =>
        c.relacoes.every((r) => ids.has(r.personagemId)) ? c : { ...c, relacoes: c.relacoes.filter((r) => ids.has(r.personagemId)) }
      )
    );
  }

  return (
    <BibleView<Character>
      kind="personagem"
      titulo={tt("Personagens")}
      items={characters}
      onChange={onChange}
      makeNew={emptyCharacter}
      nomeLabel={novel ? tt("Nome") : tt("Nome (como aparece no roteiro)")}
      nomePlaceholder={novel ? "Lia" : "LIA"}
      subtitulo={(c) => [c.papel, c.idade && tt("{n} anos", { n: c.idade })].filter(Boolean).join(" · ")}
      secoes={[
        {
          titulo: tt("Essencial"),
          campos: [
            { key: "nomeCompleto", label: tt("Nome completo"), placeholder: tt("Lia Ferreira"), half: true },
            { key: "idade", label: tt("Idade"), placeholder: "30", half: true },
            { key: "papel", label: tt("Papel na história"), opcoes: PAPEIS },
            { key: "descricao", label: tt("Em uma frase"), area: true, placeholder: tt("Quem é esta pessoa.") },
          ],
        },
        {
          titulo: tt("Aparência e personalidade"),
          campos: [
            { key: "aparencia", label: tt("Aparência"), area: true },
            { key: "personalidade", label: tt("Personalidade"), area: true },
          ],
        },
        {
          titulo: tt("História e motivação"),
          campos: [
            { key: "historia", label: tt("História"), area: true },
            { key: "objetivos", label: tt("O que quer"), area: true, half: true },
            { key: "medos", label: tt("Do que tem medo"), area: true, half: true },
            { key: "conflitos", label: tt("Conflitos"), area: true },
            { key: "arco", label: tt("Arco (como muda ao longo da história)"), area: true },
          ],
        },
      ]}
      extra={(c, update) => (
        <Relations character={c} others={characters.filter((o) => o.id !== c.id)} onChange={(relacoes) => update({ relacoes })} />
      )}
      vazio={tt("Nenhum personagem ainda. Clique em + para criar.")}
    />
  );
}

function Relations({
  character,
  others,
  onChange,
}: {
  character: Character;
  others: Character[];
  onChange: (r: CharacterRelation[]) => void;
}) {
  const rel = character.relacoes;
  return (
    <>
      <div className="bb-sec-title">{tt("Relações")}</div>
      {rel.length === 0 && (
        <p className="faint" style={{ fontSize: 12.5, margin: "0 0 8px" }}>
          {tt("Nenhuma relação.")} {others.length === 0 && tt("Crie outro personagem para conectar.")}
        </p>
      )}
      {rel.map((r, i) => (
        <div className="rel-row" key={i}>
          <div style={{ width: 180 }}>
            <Select
              className="sel-compact"
              ariaLabel={tt("Personagem")}
              value={r.personagemId}
              onChange={(v) => onChange(rel.map((x, k) => (k === i ? { ...x, personagemId: v } : x)))}
              options={others.map((o) => ({ value: o.id, label: o.nome || tt("sem nome") }))}
            />
          </div>
          <span className="faint" style={{ fontSize: 12 }}>
            {tt("é")}
          </span>
          <input
            style={{ flex: 1 }}
            value={r.tipo}
            placeholder={tt("irmã, amigo, antagonista…")}
            onChange={(e) => onChange(rel.map((x, k) => (k === i ? { ...x, tipo: e.target.value } : x)))}
          />
          <button className="icon-btn danger" onClick={() => onChange(rel.filter((_, k) => k !== i))} title={tt("Remover")}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <button
        className="btn btn-ghost"
        style={{ marginTop: 4, padding: "6px 10px" }}
        onClick={() => others[0] && onChange([...rel, { personagemId: others[0].id, tipo: "" }])}
        disabled={others.length === 0}
      >
        <Icon name="plus" size={14} />
        {tt("Adicionar relação")}
      </button>
    </>
  );
}
