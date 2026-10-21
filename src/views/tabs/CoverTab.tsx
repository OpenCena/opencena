import { useEffect, useMemo, useRef, useState } from "react";
import { usePageZoom } from "@/hooks/usePageZoom";
import { useApp } from "@/store/appStore";
import { BookParts, Cover, CoverImage, CoverText, Credits, LoadedProject } from "@/types";
import { kindOf, resolveLayout } from "@/layout/profiles";
import { FrontItem, FrontPage, bookPartsOf, buildFrontMatter, coverImageRect } from "@/layout/frontmatter";
import { TocEntry, tocCache } from "@/layout/tocCache";
import { tocFromLayout } from "@/layout/engine";
import { layoutProject } from "@/domain/pdf";
import { saveProjectImage, useProjectImageUrl } from "@/storage/images";
import { BookPartsPicker } from "@/components/BookPartsPicker";
import { Icon } from "@/components/Icon";
import { tt } from "@/i18n";
import "@/styles/editor.css";
import "@/styles/pages.css";

const ZOOMS = [0.4, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5];

function Field({
  label,
  value,
  onChange,
  multiline,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {multiline ? (
        <textarea className="textarea" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg seg-sm">
      {options.map((o) => (
        <button key={o.v} className={`seg-opt ${value === o.v ? "active" : ""}`} onClick={() => onChange(o.v)}>
          <span className="seg-label">{o.l}</span>
        </button>
      ))}
    </div>
  );
}

/** Uma página de abertura desenhada (mesmas linhas que o PDF desenha). */
function FrontSheet({
  page,
  l,
  imageUrl,
  zoom,
  onMoveImage,
}: {
  page: FrontPage;
  l: ReturnType<typeof resolveLayout>;
  imageUrl: string | null;
  zoom: number;
  onMoveImage?: (img: CoverImage) => void;
}) {
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<{ x: number; y: number; img: CoverImage; ow: number; oh: number } | null>(null);
  const img = page.image;
  const rect = img && nat ? coverImageRect(nat.w, nat.h, l.pageW, l.pageH, img) : null;

  function down(e: React.PointerEvent) {
    if (!img || !rect || !onMoveImage) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, img, ow: rect.width - l.pageW, oh: rect.height - l.pageH };
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !onMoveImage) return;
    const dx = (e.clientX - d.x) / zoom;
    const dy = (e.clientY - d.y) / zoom;
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    onMoveImage({
      ...d.img,
      x: d.ow > 0 ? clamp(d.img.x - dx / d.ow) : 0.5,
      y: d.oh > 0 ? clamp(d.img.y - dy / d.oh) : 0.5,
    });
  }
  function up() {
    drag.current = null;
  }

  const color = (it: FrontItem) =>
    it.color === "claro" ? "#ffffff" : it.color === "escuro" ? "#111111" : it.color === "suave" ? "var(--text-muted)" : undefined;

  return (
    <div
      className={`cv-sheet ${img && imageUrl ? "has-image" : ""}`}
      style={{ width: l.pageW, height: l.pageH, fontFamily: l.fontInfo.css }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {img && imageUrl && (
        <img
          className="cv-img"
          src={imageUrl}
          draggable={false}
          alt=""
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : { opacity: 0 }}
        />
      )}
      {page.items.map((it, k) => (
        <span
          key={k}
          className="cv-item"
          style={{
            top: it.y,
            fontSize: `${it.sizePt}pt`,
            lineHeight: `${it.lineHeight}px`,
            fontWeight: it.bold ? 700 : 400,
            fontStyle: it.italic ? "italic" : "normal",
            color: color(it),
            textShadow: it.color === "claro" ? "0 1px 8px rgba(0,0,0,0.45)" : undefined,
            ...(it.align === "left"
              ? { left: it.x, width: it.leaderTo ? it.leaderTo - it.x : undefined }
              : it.align === "right"
                ? { right: l.pageW - it.x }
                : { left: it.x, transform: "translateX(-50%)" }),
          }}
        >
          {it.leaderTo ? (
            <span className="cv-leader">
              <span>{it.text}</span>
            </span>
          ) : (
            it.text
          )}
        </span>
      ))}
    </div>
  );
}

// Capa / páginas de abertura: painel de edição à esquerda e as folhas à direita,
// no mesmo papel e fonte do documento, com zoom.
export function CoverTab() {
  const cur = useApp((s) => s.current!);
  const project = cur.project;
  const cover = project.cover;
  const meta = project.meta;
  const previewMode = useApp((s) => s.previewMode);
  const updateCover = useApp((s) => s.updateCover);
  const updateMeta = useApp((s) => s.updateMeta);
  const setError = useApp((s) => s.setError);
  const kind = kindOf(meta);
  const novel = kind.id === "novel";
  const l = useMemo(() => resolveLayout(meta), [meta.tipo, meta.pagina]); // eslint-disable-line react-hooks/exhaustive-deps
  const parts = bookPartsOf(project);
  const imageUrl = useProjectImageUrl(previewMode ? null : cur.root, cover.imagem?.arquivo);

  // sumário: do editor (se ele já paginou este texto) ou calculado aqui
  const elementos = project.screenplay.elementos;
  const [toc, setToc] = useState<TocEntry[]>(() => (tocCache.src === elementos ? tocCache.entries : []));
  useEffect(() => {
    if (!novel || !parts.sumario) return;
    if (tocCache.src === elementos) {
      setToc(tocCache.entries);
      return;
    }
    const t = setTimeout(() => {
      const { dl } = layoutProject(project as LoadedProject, false);
      const entries = tocFromLayout(dl);
      tocCache.src = elementos;
      tocCache.entries = entries;
      setToc(entries);
    }, 30);
    return () => clearTimeout(t);
  }, [elementos, novel, parts.sumario, meta.pagina]); // eslint-disable-line react-hooks/exhaustive-deps

  const words = useMemo(
    () => elementos.reduce((n, e) => n + (e.texto.match(/[\p{L}\p{N}]+/gu)?.length ?? 0), 0),
    [elementos]
  );
  const pages = buildFrontMatter(project, l, toc, words);

  // zoom
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(800);
  const [zoomMode, setZoomMode] = useState<"fit" | number>("fit");
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCanvasW(el.clientWidth));
    ro.observe(el);
    setCanvasW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const zoom = zoomMode === "fit" ? Math.max(0.3, Math.min(1, (canvasW - 48) / l.pageW)) : zoomMode;
  usePageZoom(canvasRef, zoom, setZoomMode, 18);

  function stepZoom(dir: number) {
    const next = dir > 0 ? ZOOMS.find((v) => v > zoom + 0.001) : [...ZOOMS].reverse().find((v) => v < zoom - 0.001);
    setZoomMode(next ?? zoom);
  }

  // edição
  function set<K extends keyof Cover>(key: K, value: Cover[K]) {
    updateCover({ ...cover, [key]: value });
  }
  const capaTexto: CoverText = cover.capaTexto ?? { mostrar: true, cor: "claro", posicao: "base" };
  const creditos: Credits = cover.creditos ?? { copyright: "", edicao: "", isbn: "", editora: "", ficha: "" };
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    try {
      const arquivo = await saveProjectImage(previewMode ? null : cur.root, file);
      updateCover({ ...cover, imagem: { arquivo, x: 0.5, y: 0.5, zoom: 1 } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="cv-wrap">
      <aside className="cv-panel">
        {novel ? (
          <>
            <div className="cv-sec">
              <div className="cv-sec-title">{tt("Páginas do livro")}</div>
              <BookPartsPicker compact value={parts} onChange={(v: BookParts) => updateMeta({ livro: v })} />
            </div>

            <div className="cv-sec">
              <div className="cv-sec-title">{tt("Título e autor")}</div>
              <Field label={tt("Título")} value={cover.titulo} onChange={(v) => set("titulo", v)} />
              <Field label={tt("Subtítulo")} value={cover.subtitulo} onChange={(v) => set("subtitulo", v)} />
              <Field label={tt("Autor")} value={cover.autor} onChange={(v) => set("autor", v)} />
            </div>

            {parts.capa && (
              <div className="cv-sec">
                <div className="cv-sec-title">{tt("Capa")}</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    void pickImage(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <button className="btn" onClick={() => fileRef.current?.click()}>
                    <Icon name="image" size={15} />
                    {cover.imagem ? tt("Trocar imagem") : tt("Escolher imagem")}
                  </button>
                  {cover.imagem && (
                    <button className="btn btn-ghost" onClick={() => set("imagem", undefined)}>
                      {tt("Remover")}
                    </button>
                  )}
                </div>
                {cover.imagem && (
                  <>
                    <div className="field">
                      <label>{tt("Zoom da imagem")}</label>
                      <input
                        type="range"
                        className="cv-range"
                        min={1}
                        max={3}
                        step={0.01}
                        value={cover.imagem.zoom}
                        onChange={(e) => set("imagem", { ...cover.imagem!, zoom: parseFloat(e.target.value) })}
                      />
                    </div>
                    <p className="cv-hint">{tt("Arraste a imagem na capa para enquadrar.")}</p>
                    <label className="ps-check">
                      <input
                        type="checkbox"
                        checked={capaTexto.mostrar}
                        onChange={(e) => set("capaTexto", { ...capaTexto, mostrar: e.target.checked })}
                      />
                      <span className="ps-check-label">{tt("Título e autor sobre a imagem")}</span>
                    </label>
                    {capaTexto.mostrar && (
                      <>
                        <div className="field">
                          <label>{tt("Posição")}</label>
                          <Seg
                            value={capaTexto.posicao}
                            onChange={(v) => set("capaTexto", { ...capaTexto, posicao: v })}
                            options={[
                              { v: "topo", l: tt("Topo") },
                              { v: "meio", l: tt("Meio") },
                              { v: "base", l: tt("Base") },
                            ]}
                          />
                        </div>
                        <div className="field">
                          <label>{tt("Cor do texto")}</label>
                          <Seg
                            value={capaTexto.cor}
                            onChange={(v) => set("capaTexto", { ...capaTexto, cor: v })}
                            options={[
                              { v: "claro", l: tt("Claro") },
                              { v: "escuro", l: tt("Escuro") },
                            ]}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {parts.folhaRosto && (
              <div className="cv-sec">
                <div className="cv-sec-title">{tt("Folha de rosto")}</div>
                <Field label={tt("Editora")} value={cover.editora ?? ""} onChange={(v) => set("editora", v)} />
                <Field label={tt("Cidade e ano")} value={cover.data} onChange={(v) => set("data", v)} />
              </div>
            )}

            {parts.creditos && (
              <div className="cv-sec">
                <div className="cv-sec-title">{tt("Créditos")}</div>
                <Field label={tt("Copyright")} value={creditos.copyright} onChange={(v) => set("creditos", { ...creditos, copyright: v })} />
                <Field label={tt("Edição")} value={creditos.edicao} onChange={(v) => set("creditos", { ...creditos, edicao: v })} />
                <Field label={tt("ISBN")} value={creditos.isbn} onChange={(v) => set("creditos", { ...creditos, isbn: v })} />
                <Field label={tt("Editora")} value={creditos.editora} onChange={(v) => set("creditos", { ...creditos, editora: v })} />
                <Field
                  label={tt("Ficha catalográfica")}
                  multiline
                  rows={4}
                  value={creditos.ficha}
                  onChange={(v) => set("creditos", { ...creditos, ficha: v })}
                />
              </div>
            )}

            {parts.dedicatoria && (
              <div className="cv-sec">
                <div className="cv-sec-title">{tt("Dedicatória")}</div>
                <Field label={tt("Texto")} multiline value={cover.dedicatoria ?? ""} onChange={(v) => set("dedicatoria", v)} />
              </div>
            )}

            {parts.epigrafe && (
              <div className="cv-sec">
                <div className="cv-sec-title">{tt("Epígrafe")}</div>
                <Field label={tt("Citação")} multiline value={cover.epigrafe ?? ""} onChange={(v) => set("epigrafe", v)} />
                <Field label={tt("Autor da citação")} value={cover.epigrafeAutor ?? ""} onChange={(v) => set("epigrafeAutor", v)} />
              </div>
            )}

            {parts.sumario && (
              <div className="cv-sec">
                <div className="cv-sec-title">{tt("Sumário")}</div>
                <p className="cv-hint">{tt("Montado sozinho a partir dos capítulos, com o número da página de cada um.")}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="cv-sec">
              <div className="cv-sec-title">{tt("Folha de rosto")}</div>
              <Field label={tt("Título")} value={cover.titulo} onChange={(v) => set("titulo", v)} />
              <Field label={tt("Subtítulo")} value={cover.subtitulo} onChange={(v) => set("subtitulo", v)} />
              <Field label={tt("Autor")} value={cover.autor} onChange={(v) => set("autor", v)} />
              <Field label={tt("Baseado em")} value={cover.baseadoEm} onChange={(v) => set("baseadoEm", v)} />
              <Field label={tt("Versão e data")} value={cover.data} onChange={(v) => set("data", v)} />
            </div>
            <div className="cv-sec">
              <div className="cv-sec-title">{tt("Contato")}</div>
              <Field label={tt("Nome ou agência")} value={cover.contato} onChange={(v) => set("contato", v)} />
              <Field label={tt("Telefone")} value={cover.telefone} onChange={(v) => set("telefone", v)} />
              <Field label={tt("E-mail")} value={cover.email} onChange={(v) => set("email", v)} />
            </div>
          </>
        )}
      </aside>

      <div className="cv-main">
        <div className="ed-toolbar cv-toolbar">
          <span className="cv-count">
            {pages.length} {pages.length === 1 ? tt("página") : tt("páginas")}
          </span>
          <div className="ed-right">
            <button className="ed-tool ed-icon" onClick={() => stepZoom(-1)} title={tt("Diminuir zoom")}>
              −
            </button>
            <span className="ed-zoom-val" onClick={() => setZoomMode(1)} title={tt("Zoom 100%")}>
              {Math.round(zoom * 100)}%
            </span>
            <button className="ed-tool ed-icon" onClick={() => stepZoom(1)} title={tt("Aumentar zoom")}>
              +
            </button>
            <button
              className={`ed-tool ${zoomMode === "fit" ? "active-soft" : ""}`}
              style={{ marginLeft: 2 }}
              onClick={() => setZoomMode("fit")}
              title={tt("Ajustar à largura")}
            >
              {tt("Ajustar")}
            </button>
          </div>
        </div>
        <div className="pv-canvas cv-canvas" ref={canvasRef}>
          {pages.length === 0 && <div className="cv-empty">{tt("Nenhuma página de abertura marcada.")}</div>}
          {pages.map((p) => (
            <div key={p.key} className="cv-page">
              <div className="cv-page-label">{p.label}</div>
              <div style={{ width: l.pageW * zoom, height: l.pageH * zoom, margin: "0 auto" }}>
                <div style={{ transform: `scale(${zoom})`, transformOrigin: "0 0", width: l.pageW }}>
                  <FrontSheet
                    page={p}
                    l={l}
                    imageUrl={imageUrl}
                    zoom={zoom}
                    onMoveImage={p.image ? (img) => set("imagem", img) : undefined}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
