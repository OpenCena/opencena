import { useApp } from "@/store/appStore";
import { BibleView } from "@/components/BibleView";
import { StoryObject } from "@/types";
import { newId } from "@/domain/project";
import { tt } from "@/i18n";

export function ObjectsTab() {
  const objects = useApp((s) => s.current!.project.objects);
  const updateObjects = useApp((s) => s.updateObjects);

  return (
    <BibleView<StoryObject>
      kind="objeto"
      titulo={tt("Objetos")}
      items={objects}
      onChange={updateObjects}
      makeNew={() => ({ id: newId(), nome: "", descricao: "" })}
      nomeLabel={tt("Nome do objeto")}
      nomePlaceholder={tt("A carta, o relógio, a chave…")}
      secoes={[
        {
          titulo: tt("O objeto"),
          campos: [
            { key: "descricao", label: tt("Descrição"), area: true, placeholder: tt("Como é, do que é feito, detalhes visuais.") },
            { key: "importancia", label: tt("Importância na história"), area: true, placeholder: tt("Por que importa, o que representa, quando volta.") },
            { key: "origem", label: tt("Origem"), area: true, placeholder: tt("De onde veio, a quem pertence.") },
          ],
        },
        { titulo: tt("Anotações"), campos: [{ key: "notas", label: tt("Notas"), area: true }] },
      ]}
      vazio={tt("Nenhum objeto ainda. Clique em + para adicionar.")}
    />
  );
}
