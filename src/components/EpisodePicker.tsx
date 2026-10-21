import { useState } from "react";
import { confirmDialog } from "@/components/Dialogs";
import { useApp } from "@/store/appStore";
import { Episode } from "@/types";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { ModalOverlay } from "@/components/ModalOverlay";
import { kindOf } from "@/layout/profiles";
import { tt } from "@/i18n";

function epLabel(e: Episode, comic: boolean): string {
  return comic
    ? `#${e.numero} · ${e.titulo || tt("sem título")}`
    : `T${e.temporada}E${e.numero} · ${e.titulo || tt("sem título")}`;
}

// Seletor de episódios/capítulos (aparece só para projetos em partes).
export function EpisodePicker() {
  const meta = useApp((s) => s.current!.project.meta);
  const kind = kindOf(meta);
  const comic = kind.id !== "roteiro";
  const episodes = useApp((s) => s.current!.episodes);
  const currentEpisodeId = useApp((s) => s.current!.currentEpisodeId);
  const selectEpisode = useApp((s) => s.selectEpisode);
  const removeEpisode = useApp((s) => s.removeEpisode);

  const [modal, setModal] = useState<null | { mode: "add" | "edit"; ep?: Episode }>(
    null
  );

  if (episodes.length === 0) return null;
  const current = episodes.find((e) => e.id === currentEpisodeId);

  return (
    <div style={{ padding: "0 8px 12px" }}>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-faint)",
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {kind.partLabel}
      </div>
      <Select
        className="sel-compact"
        ariaLabel={kind.partLabel}
        value={currentEpisodeId ?? ""}
        onChange={(id) => void selectEpisode(id)}
        options={episodes.map((e) => ({ value: e.id, label: epLabel(e, comic) }))}
      />
      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        <button
          className="btn btn-ghost"
          style={{ flex: 1, padding: "5px 8px", fontSize: 12, justifyContent: "center" }}
          onClick={() => setModal({ mode: "add" })}
        >
          <Icon name="plus" size={13} />
          {tt("Novo")}
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: "5px 8px", fontSize: 12 }}
          title={tt("Editar")}
          onClick={() => current && setModal({ mode: "edit", ep: current })}
        >
          <Icon name="penLine" size={13} />
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: "5px 8px", fontSize: 12, color: "var(--text-muted)" }}
          title={tt("Excluir")}
          disabled={episodes.length <= 1}
          onClick={async () => {
            if (!current) return;
            const ok = await confirmDialog({
              title: tt("Excluir \"{nome}\"?", { nome: current.titulo || epLabel(current, comic) }),
              message: tt("Sai da lista do projeto. Os arquivos continuam guardados na pasta do projeto."),
              confirmLabel: tt("Excluir"),
              tone: "danger",
            });
            if (ok) void removeEpisode(current.id);
          }}
        >
          <Icon name="x" size={13} />
        </button>
      </div>

      {modal && (
        <EpisodeModal
          mode={modal.mode}
          ep={modal.ep}
          comic={comic}
          partLabel={kind.partLabel}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function EpisodeModal({
  mode,
  ep,
  comic,
  partLabel,
  onClose,
}: {
  mode: "add" | "edit";
  ep?: Episode;
  comic: boolean;
  partLabel: string;
  onClose: () => void;
}) {
  const addEpisode = useApp((s) => s.addEpisode);
  const renameEpisode = useApp((s) => s.renameEpisode);
  const [temporada, setTemporada] = useState(ep?.temporada ?? 1);
  const [numero, setNumero] = useState(ep?.numero ?? 1);
  const [titulo, setTitulo] = useState(ep?.titulo ?? "");

  async function save() {
    if (mode === "add") {
      await addEpisode(temporada, titulo);
    } else if (ep) {
      renameEpisode(ep.id, { temporada, numero, titulo });
    }
    onClose();
  }

  return (
    <ModalOverlay
      onClose={onClose}
      title={mode === "add" ? tt("Novo: {parte}", { parte: partLabel.toLowerCase() }) : tt("Editar: {parte}", { parte: partLabel.toLowerCase() })}
      width={380}
    >
      <div style={{ display: "flex", gap: 12 }}>
        {!comic && (
        <div className="field" style={{ width: 90 }}>
          <label>{tt("Temporada")}</label>
          <input
            className="input"
            type="number"
            min={1}
            value={temporada}
            onChange={(e) => setTemporada(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        )}
        {mode === "edit" && (
          <div className="field" style={{ width: 90 }}>
            <label>{tt("Número")}</label>
            <input
              className="input"
              type="number"
              min={1}
              value={numero}
              onChange={(e) => setNumero(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        )}
        <div className="field" style={{ flex: 1 }}>
          <label>{tt("Título")}</label>
          <input
            className="input"
            autoFocus
            value={titulo}
            placeholder={comic ? tt("Título do capítulo") : tt("Piloto")}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void save()}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <button className="btn btn-ghost" onClick={onClose}>
          {tt("Cancelar")}
        </button>
        <button className="btn btn-primary" onClick={() => void save()}>
          {mode === "add" ? tt("Criar") : tt("Salvar")}
        </button>
      </div>
    </ModalOverlay>
  );
}
