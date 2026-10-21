import { useApp } from "@/store/appStore";
import { BibleView } from "@/components/BibleView";
import { Location } from "@/types";
import { newId } from "@/domain/project";
import { tt } from "@/i18n";

export function LocationsTab() {
  const locations = useApp((s) => s.current!.project.locations);
  const updateLocations = useApp((s) => s.updateLocations);
  const novel = useApp((s) => s.current!.project.meta.tipo === "novel");

  return (
    <BibleView<Location>
      kind="local"
      titulo={tt("Locais")}
      items={locations}
      onChange={updateLocations}
      makeNew={() => ({ id: newId(), nome: "", descricao: "" })}
      nomeLabel={tt("Nome do local")}
      nomePlaceholder={novel ? tt("A casa da avó, a estação…") : tt("APARTAMENTO, ESTAÇÃO…")}
      subtitulo={(l) => l.ambiente ?? ""}
      secoes={[
        {
          titulo: tt("O lugar"),
          campos: [
            { key: "ambiente", label: tt("Ambiente"), opcoes: [tt("Interno"), tt("Externo"), tt("Interno e externo")] },
            { key: "descricao", label: tt("Descrição"), area: true, placeholder: tt("Como é o lugar, o que se vê, o que tem de especial.") },
            { key: "atmosfera", label: tt("Atmosfera"), area: true, placeholder: tt("Luz, sons, cheiro, clima, sensação.") },
            { key: "epoca", label: tt("Época"), placeholder: tt("Anos 80, futuro próximo…"), half: true },
          ],
        },
        { titulo: tt("Anotações"), campos: [{ key: "notas", label: tt("Notas"), area: true, placeholder: tt("Pesquisa, ideias, o que acontece aqui.") }] },
      ]}
      vazio={tt("Nenhum local ainda. Clique em + para adicionar.")}
    />
  );
}
