import { useState } from "react";
import { useApp } from "@/store/appStore";
import { FontChoice, PageNumbering, PageSettings } from "@/types";
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import { FONTS, NOVEL_TEMPLATES, PAGE_PRESETS, pageSettingsOf, presetById } from "@/layout/profiles";
import { tt, locale } from "@/i18n";

const NUMERACAO: { value: PageNumbering; label: string }[] = [
  { value: "rodape-centro", label: tt("Rodapé, centralizado") },
  { value: "rodape-externo", label: tt("Rodapé, lado externo") },
  { value: "topo-direita", label: tt("Topo, à direita") },
  { value: "topo-externo", label: tt("Topo, lado externo") },
  { value: "nenhuma", label: tt("Sem numeração") },
];

const ENTRELINHAS = [
  { value: "1", label: tt("Simples") },
  { value: "1.15", label: "1,15" },
  { value: "1.2", label: "1,2" },
  { value: "1.3", label: "1,3" },
  { value: "1.5", label: tt("1,5 linha") },
  { value: "2", label: tt("Duplo") },
];

type Section = "modelos" | "formato" | "margens" | "texto" | "paginas";

const SECTIONS: { id: Section; label: string; icon: "layoutList" | "page" | "sidebar" | "penLine" | "book" }[] = [
  { id: "modelos", label: tt("Modelos"), icon: "layoutList" },
  { id: "formato", label: tt("Formato"), icon: "page" },
  { id: "margens", label: tt("Margens"), icon: "sidebar" },
  { id: "texto", label: tt("Texto"), icon: "penLine" },
  { id: "paginas", label: tt("Páginas"), icon: "book" },
];

function Num({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit: string;
}) {
  return (
    <div className="field ps-num">
      <label>{label}</label>
      <div className="ps-num-box">
        <input
          className="input"
          type="number"
          step={step}
          min={min}
          max={max}
          value={Number.isFinite(value) ? +value.toFixed(2) : 0}
          onChange={(e) => {
            const v = parseFloat(e.target.value.replace(",", "."));
            if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
        />
        <span className="ps-unit">{unit}</span>
      </div>
    </div>
  );
}

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="ps-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="ps-check-label">{label}</span>
        {hint && <span className="ps-check-hint">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * Configurar página do novel: painel encaixado à esquerda do editor (sem
 * escurecer a tela), com menu de seções. A folha ao lado muda ao vivo.
 */
export function PageSetupPanel({ onClose }: { onClose: () => void }) {
  const meta = useApp((st) => st.current!.project.meta);
  const updateMeta = useApp((st) => st.updateMeta);
  const s = pageSettingsOf(meta);
  const [sec, setSec] = useState<Section>("modelos");

  function set(patch: Partial<PageSettings>) {
    // Mexer à mão em qualquer valor "solta" o modelo escolhido.
    updateMeta({ pagina: { ...s, ...patch, modelo: patch.modelo } });
  }

  function setFormato(id: string) {
    const p = presetById(id);
    if (p) set({ formato: id, largura: p.w, altura: p.h });
    else set({ formato: "personalizado" });
  }

  const formatoOpts = [
    ...PAGE_PRESETS.map((p) => ({ value: p.id, label: p.label })),
    { value: "personalizado", label: tt("Personalizado") },
  ];

  return (
    <aside className="ps-panel" aria-label={tt("Configurar página")}>
      <div className="ps-panel-head">
        <span>{tt("Configurar página")}</span>
        <button className="modal-x" onClick={onClose} title={tt("Fechar")}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="ps-panel-body">
        <nav className="ps-rail">
          {SECTIONS.map((x) => (
            <button key={x.id} className={`ps-rail-item ${sec === x.id ? "active" : ""}`} onClick={() => setSec(x.id)}>
              <Icon name={x.icon} size={15} />
              {x.label}
            </button>
          ))}
        </nav>

        <div className="ps-content">
          {sec === "modelos" && (
            <>
              <p className="ps-note">{tt("Aplica tamanho, margens, fonte e espaçamentos de uma vez. Depois dá para ajustar cada item.")}</p>
              <div className="ps-templates">
                {NOVEL_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    className={`ps-template ${s.modelo === t.id ? "active" : ""}`}
                    onClick={() => set({ ...t.settings, modelo: t.id })}
                  >
                    <span className="ps-template-name">{t.label}</span>
                    <span className="ps-template-desc">{t.desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {sec === "formato" && (
            <>
              <div className="field">
                <label>{tt("Tamanho da página")}</label>
                <Select
                  ariaLabel={tt("Tamanho da página")}
                  value={presetById(s.formato) ? s.formato : "personalizado"}
                  onChange={setFormato}
                  options={formatoOpts}
                />
              </div>
              {(s.formato === "personalizado" || !presetById(s.formato)) && (
                <div className="ps-row">
                  <Num label={tt("Largura")} unit="mm" value={s.largura} min={70} max={420} onChange={(v) => set({ largura: v })} />
                  <Num label={tt("Altura")} unit="mm" value={s.altura} min={90} max={420} onChange={(v) => set({ altura: v })} />
                </div>
              )}
              <p className="ps-note">
                {tt("{largura} × {altura} mm. Para imprimir em casa, A5 e 14 × 21 cabem como livreto em folhas A4 (veja Importar e exportar).", { largura: s.largura.toLocaleString(locale()), altura: s.altura.toLocaleString(locale()) })}
              </p>
            </>
          )}

          {sec === "margens" && (
            <>
              <div className="ps-row">
                <Num label={tt("Superior")} unit="mm" value={s.margemTopo} max={80} onChange={(v) => set({ margemTopo: v })} />
                <Num label={tt("Inferior")} unit="mm" value={s.margemBase} max={80} onChange={(v) => set({ margemBase: v })} />
              </div>
              <div className="ps-row">
                <Num
                  label={s.espelhar ? tt("Interna") : tt("Esquerda")}
                  unit="mm"
                  value={s.margemInterna}
                  max={80}
                  onChange={(v) => set({ margemInterna: v })}
                />
                <Num
                  label={s.espelhar ? tt("Externa") : tt("Direita")}
                  unit="mm"
                  value={s.margemExterna}
                  max={80}
                  onChange={(v) => set({ margemExterna: v })}
                />
              </div>
              <Check
                label={tt("Margens espelhadas")}
                hint={tt("Páginas pares e ímpares, com a margem interna do lado da lombada.")}
                checked={s.espelhar}
                onChange={(v) => set({ espelhar: v })}
              />
            </>
          )}

          {sec === "texto" && (
            <>
              <div className="field">
                <label>{tt("Fonte")}</label>
                <Select
                  ariaLabel={tt("Fonte")}
                  value={s.fonte}
                  onChange={(v) => set({ fonte: v as FontChoice })}
                  options={(Object.keys(FONTS) as FontChoice[]).map((f) => ({ value: f, label: FONTS[f].label }))}
                />
              </div>
              <div className="ps-row">
                <Num label={tt("Tamanho")} unit="pt" step={0.5} min={7} max={20} value={s.tamanho} onChange={(v) => set({ tamanho: v })} />
                <div className="field" style={{ flex: 1 }}>
                  <label>{tt("Entrelinha")}</label>
                  <Select
                    ariaLabel={tt("Entrelinha")}
                    value={String(s.entrelinha)}
                    onChange={(v) => set({ entrelinha: parseFloat(v) })}
                    options={
                      ENTRELINHAS.some((e) => parseFloat(e.value) === s.entrelinha)
                        ? ENTRELINHAS
                        : [...ENTRELINHAS, { value: String(s.entrelinha), label: String(s.entrelinha).replace(".", ",") }]
                    }
                  />
                </div>
              </div>
              <div className="ps-row">
                <Num label={tt("Recuo da 1ª linha")} unit="mm" step={0.5} max={30} value={s.recuo} onChange={(v) => set({ recuo: v })} />
                <Num
                  label={tt("Entre parágrafos")}
                  unit="pt"
                  step={1}
                  max={24}
                  value={s.espacoParagrafo}
                  onChange={(v) => set({ espacoParagrafo: v })}
                />
              </div>
              <Check label={tt("Justificar")} checked={s.justificar} onChange={(v) => set({ justificar: v })} />
              <Check label={tt("Hifenizar")} hint={tt("Divide palavras no fim da linha.")} checked={s.hifenizar} onChange={(v) => set({ hifenizar: v })} />
            </>
          )}

          {sec === "paginas" && (
            <>
              <div className="field">
                <label>{tt("Numeração de página")}</label>
                <Select ariaLabel={tt("Numeração")} value={s.numeracao} onChange={(v) => set({ numeracao: v as PageNumbering })} options={NUMERACAO} />
              </div>
              <Check
                label={tt("Cabeçalho corrente")}
                hint={tt("Autor nas páginas pares, título nas ímpares.")}
                checked={s.cabecalhoCorrente}
                onChange={(v) => set({ cabecalhoCorrente: v })}
              />
              <Check label={tt("Capítulo começa em página nova")} checked={s.capituloNovaPagina} onChange={(v) => set({ capituloNovaPagina: v })} />
              {s.capituloNovaPagina && (
                <Check
                  label={tt("Sempre em página ímpar (direita)")}
                  hint={tt("Insere uma página em branco quando preciso, como nos livros impressos.")}
                  checked={s.capituloImpar}
                  onChange={(v) => set({ capituloImpar: v })}
                />
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
