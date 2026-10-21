import { useState } from "react";
import { ModalOverlay } from "@/components/ModalOverlay";
import { Icon } from "@/components/Icon";
import { StructureTemplate, TEMPLATES, comicTemplate } from "@/domain/outline";
import { ProjectType } from "@/types";
import { tt } from "@/i18n";

/** Escolha de um modelo de estrutura (atos + cartões-guia). */
export function TemplateDialog({
  tipo,
  onPick,
  onClose,
}: {
  tipo: ProjectType;
  onPick: (t: StructureTemplate) => void;
  onClose: () => void;
}) {
  const [paginas, setPaginas] = useState(22);
  // os modelos do tipo da obra aparecem primeiro
  const lista = [...TEMPLATES].sort((a, b) => Number(b.tipos[0] === tipo) - Number(a.tipos[0] === tipo));
  return (
    <ModalOverlay onClose={onClose} title={tt("Modelos de estrutura")} width={560}>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        {tt("O modelo cria os atos e um cartão-guia para cada batida, com a função dela. Os cartões que você já tem continuam onde estão.")}
      </p>
      <div className="tpl-list">
        {tipo === "quadrinhos" && (
          <div className="tpl tpl-hq">
            <div>
              <div className="tpl-name">{tt("HQ por páginas")}</div>
              <div className="tpl-desc">{tt("Um cartão por página do capítulo.")}</div>
            </div>
            <div className="tpl-hq-num">
              <input className="input" type="number" min={1} max={200} value={paginas} onChange={(e) => setPaginas(Number(e.target.value) || 1)} />
              <span className="faint">{tt("páginas")}</span>
              <button className="btn btn-primary" onClick={() => onPick(comicTemplate(paginas))}>
                {tt("Usar")}
              </button>
            </div>
          </div>
        )}
        {lista.map((t) => (
          <button key={t.id} className="tpl" onClick={() => onPick(t)}>
            <div>
              <div className="tpl-name">{t.nome}</div>
              <div className="tpl-desc">{t.descricao}</div>
              <div className="tpl-beats">
                {t.atos.map((a) => a.titulo).join(" · ")} · {t.atos.reduce((n, a) => n + a.batidas.length, 0)} {tt("batidas")}
              </div>
            </div>
            <Icon name="chevronLeft" size={14} className="tpl-go" />
          </button>
        ))}
      </div>
    </ModalOverlay>
  );
}
