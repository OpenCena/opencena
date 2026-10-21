import { useState } from "react";
import { LangPicker } from "@/components/LangPicker";
import { Select } from "@/components/Select";
import { LANGS } from "@/i18n";
import { useApp } from "@/store/appStore";
import { ModalOverlay } from "@/components/ModalOverlay";
import { AboutContent } from "@/components/About";
import { pageSettingsOf } from "@/layout/profiles";
import { tt } from "@/i18n";

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="ps-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="ps-check-label">{label}</span>
        <span className="ps-check-hint">{hint}</span>
      </span>
    </label>
  );
}

function GoalInput({ label, value, onChange }: { label: string; value?: number; onChange: (v?: number) => void }) {
  return (
    <div className="field" style={{ flex: 1 }}>
      <label>{label}</label>
      <div className="ps-num-box">
        <input
          className="input"
          type="number"
          min={0}
          step={100}
          value={value ?? ""}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            onChange(Number.isFinite(v) && v > 0 ? v : undefined);
          }}
        />
        <span className="ps-unit">{tt("palavras")}</span>
      </div>
    </div>
  );
}

type SetTab = "projeto" | "geral" | "sobre";

/** Preferências que valem para todos os projetos. */
export function GeneralSettings() {
  const prefs = useApp((s) => s.prefs);
  const setPrefs = useApp((s) => s.setPrefs);
  return (
    <div className="set-general">
      <div className="muted set-hint">{tt("Valem para todos os projetos neste computador.")}</div>
      <div className="field">
        <label>{tt("Idioma da interface")}</label>
        <div>
          <LangPicker align="left" />
        </div>
      </div>
      <label className="ps-check">
        <input type="checkbox" checked={prefs.atualizar !== false} onChange={(e) => setPrefs({ atualizar: e.target.checked })} />
        <span>
          <span className="ps-check-label">{tt("Procurar atualizações ao abrir")}</span>
          <span className="ps-check-hint">{tt("No app instalado: avisa quando há uma versão nova, que você instala com um clique.")}</span>
        </span>
      </label>
      <div className="field">
        <label>{tt("Ao expandir uma página da pesquisa, abrir")}</label>
        <div className="seg seg-sm">
          <button className={`seg-opt ${prefs.painel === "lateral" ? "active" : ""}`} onClick={() => setPrefs({ painel: "lateral" })}>
            <span className="seg-label">{tt("Na lateral direita")}</span>
          </button>
          <button className={`seg-opt ${prefs.painel === "janela" ? "active" : ""}`} onClick={() => setPrefs({ painel: "janela" })}>
            <span className="seg-label">{tt("Em janela no meio")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsModal({ onClose, initialTab = "projeto" }: { onClose: () => void; initialTab?: SetTab }) {
  const [tab, setTab] = useState<SetTab>(initialTab);
  const meta = useApp((s) => s.current!.project.meta);
  const cover = useApp((s) => s.current!.project.cover);
  const updateMeta = useApp((s) => s.updateMeta);
  const updateCover = useApp((s) => s.updateCover);
  const contd = meta.contdEnabled !== false;
  const pg = pageSettingsOf(meta);
  const metas = meta.metas ?? {};
  const roteiro = meta.tipo === "roteiro";
  const hq = meta.tipo === "quadrinhos";

  function setCover<K extends keyof typeof cover>(key: K, value: (typeof cover)[K]) {
    updateCover({ ...cover, [key]: value });
  }

  return (
    <ModalOverlay onClose={onClose} title={tt("Configurações")} width={560}>
      <div className="set-tabs">
        {(
          [
            ["projeto", tt("Este projeto")],
            ["geral", tt("Geral")],
            ["sobre", tt("Sobre e licença")],
          ] as const
        ).map(([v, l]) => (
          <button key={v} className={`set-tab ${tab === v ? "active" : ""}`} onClick={() => setTab(v)}>
            {l}
          </button>
        ))}
      </div>
      <div className="set-body">
      {tab === "geral" && <GeneralSettings />}
      {tab === "sobre" && <AboutContent />}
      {tab === "projeto" && (
      <>
      <div className="field">
        <label>{tt("Nome do projeto")}</label>
        <input className="input" value={meta.nome} onChange={(e) => updateMeta({ nome: e.target.value })} />
      </div>
      <div className="field">
        <label>{tt("Autor")}</label>
        <input className="input" value={meta.autor} onChange={(e) => updateMeta({ autor: e.target.value })} />
      </div>
      <div className="field">
        <label>{tt("Idioma do documento")}</label>
        <Select
          ariaLabel={tt("Idioma do documento")}
          value={meta.idioma ?? "pt-BR"}
          onChange={(v) => updateMeta({ idioma: v as "pt-BR" | "en" | "es" })}
          options={LANGS.map((l) => ({ value: l.id, label: l.nome }))}
        />
        <span className="faint" style={{ fontSize: 11.5 }}>
          {tt("Usado nas marcas do texto e das exportações, como (MAIS), (CONT'D), \"escrito por\" e \"Sumário\".")}
        </span>
      </div>

      {(roteiro || hq) && (
        <div className="set-section">
          <div className="set-title">{tt("Contato do autor")}</div>
          <div className="muted set-hint">{tt("Opcional. Aparece no rodapé da capa, no padrão de roteiro.")}</div>
          <div className="field">
            <label>{tt("Nome ou agência")}</label>
            <input className="input" value={cover.contato} onChange={(e) => setCover("contato", e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>{tt("Telefone")}</label>
              <input className="input" value={cover.telefone} onChange={(e) => setCover("telefone", e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>{tt("E-mail")}</label>
              <input className="input" value={cover.email} onChange={(e) => setCover("email", e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {(roteiro || hq) && (
        <div className="set-section">
          <div className="set-title">{tt("Documento")}</div>
          {roteiro && (
            <>
              <Check
                label={tt("Numerar cenas")}
                hint={tt("Número da cena na margem (roteiro de filmagem). Desligue para roteiro de venda.")}
                checked={pg.numerarCenas}
                onChange={(v) => updateMeta({ pagina: { ...pg, numerarCenas: v } })}
              />
              <Check
                label={tt("CONT'D automático")}
                hint={tt("Insere (CONT'D) quando o mesmo personagem retoma a fala depois de uma ação, na mesma cena.")}
                checked={contd}
                onChange={(v) => updateMeta({ contdEnabled: v })}
              />
            </>
          )}
          {hq && (
            <Check
              label={tt("Cada página da HQ começa numa folha nova")}
              hint={tt("Padrão de roteiro completo (full script). Facilita para o desenhista.")}
              checked={pg.hqPaginaNova}
              onChange={(v) => updateMeta({ pagina: { ...pg, hqPaginaNova: v } })}
            />
          )}
        </div>
      )}

      <div className="set-section">
        <div className="set-title">{tt("Metas de escrita")}</div>
        <div className="muted set-hint">{tt("Aparecem no rodapé do editor. Deixe em branco para não usar.")}</div>
        <div style={{ display: "flex", gap: 12 }}>
          <GoalInput
            label={tt("Por dia")}
            value={metas.diaria}
            onChange={(v) => updateMeta({ metas: { ...metas, diaria: v } })}
          />
          <GoalInput
            label={tt("Projeto inteiro")}
            value={metas.total}
            onChange={(v) => updateMeta({ metas: { ...metas, total: v } })}
          />
        </div>
      </div>
      </>
      )}
      </div>
    </ModalOverlay>
  );
}
