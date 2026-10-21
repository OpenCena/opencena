// Fichas de personagens, locais e objetos: lista com foto e busca à esquerda.

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/appStore";
import { RefLink, Reference } from "@/types";
import { newId } from "@/domain/project";
import { presenceOf } from "@/domain/presence";
import { linkKey } from "@/domain/research";
import { Icon } from "@/components/Icon";
import { confirmDialog } from "@/components/Dialogs";
import { LinkedResearch } from "@/components/LinkedResearch";
import { startAttachment, useAttachmentSaving, useProjectImageUrl } from "@/storage/images";
import type { ProjectDir } from "@/storage/fs";
import { tt } from "@/i18n";
import "@/styles/bible.css";

type Kind = "personagem" | "local" | "objeto";

interface Entity {
  id: string;
  nome: string;
  imagem?: string;
}

export interface FieldDef<T> {
  key: keyof T & string;
  label: string;
  placeholder?: string;
  area?: boolean;
  /** Opções fixas (vira um seletor em pílulas). */
  opcoes?: string[];
  half?: boolean;
}

export interface SectionDef<T> {
  titulo: string;
  campos: FieldDef<T>[];
}

function Thumb({ root, arquivo, nome, size = 28 }: { root: ProjectDir | null; arquivo?: string; nome: string; size?: number }) {
  const url = useProjectImageUrl(root, arquivo);
  const iniciais =
    nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <span className="bb-thumb" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {url ? <img src={url} alt="" /> : iniciais}
    </span>
  );
}

function GalleryImage({
  r,
  root,
  principal,
  onMain,
  onRemove,
  onOpen,
}: {
  r: Reference;
  root: ProjectDir | null;
  principal: boolean;
  onMain: () => void;
  onRemove: () => void;
  onOpen: (url: string) => void;
}) {
  const url = useProjectImageUrl(root, r.arquivo);
  const salvando = useAttachmentSaving(r.arquivo);
  return (
    <div className={`bb-img ${principal ? "main" : ""}`}>
      {url && <img src={url} alt={r.titulo} onClick={() => onOpen(url)} />}
      {salvando && (
        <span className="bd-saving">
          <span className="spin" />
          {tt("Colando…")}
        </span>
      )}
      <div className="bb-img-acts">
        <button onClick={onMain} title={principal ? tt("É a foto principal") : tt("Usar como foto principal")} className={principal ? "on" : ""}>
          <Icon name="pin" size={12} />
        </button>
        <button onClick={onRemove} title={tt("Tirar da ficha")}>
          <Icon name="x" size={12} />
        </button>
      </div>
    </div>
  );
}

export function BibleView<T extends Entity>({
  kind,
  titulo,
  items,
  onChange,
  makeNew,
  nomeLabel,
  nomePlaceholder,
  secoes,
  subtitulo,
  extra,
  vazio,
}: {
  kind: Kind;
  titulo: string;
  items: T[];
  onChange: (items: T[]) => void;
  makeNew: () => T;
  nomeLabel: string;
  nomePlaceholder?: string;
  secoes: SectionDef<T>[];
  /** Linha abaixo do nome na lista (ex.: idade, papel). */
  subtitulo?: (item: T) => string;
  /** Conteúdo extra no fim da ficha (ex.: relações). */
  extra?: (item: T, update: (p: Partial<T>) => void) => ReactNode;
  vazio: string;
}) {
  const cur = useApp((s) => s.current!);
  const previewMode = useApp((s) => s.previewMode);
  const focusElement = useApp((s) => s.focusElement);
  const root = previewMode ? null : cur.root;
  const project = cur.project;
  const [selId, setSelId] = useState<string | null>(items[0]?.id ?? null);
  const [busca, setBusca] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sel = items.find((i) => i.id === selId) ?? null;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? items.filter((i) => i.nome.toLowerCase().includes(q)) : items;
  }, [items, busca]);

  function add() {
    const it = makeNew();
    onChange([...items, it]);
    setSelId(it.id);
  }
  function update(p: Partial<T>) {
    if (!sel) return;
    onChange(itemsRef.current.map((i) => (i.id === sel.id ? { ...i, ...p } : i)));
  }
  async function remove() {
    if (!sel) return;
    const ok = await confirmDialog({
      title: tt("Excluir \"{nome}\"?", { nome: sel.nome || tt("sem nome") }),
      message: tt("A ficha sai do projeto. As imagens e anotações continuam na Pesquisa. Dá para voltar pelo Histórico."),
      confirmLabel: tt("Excluir"),
      tone: "danger",
    });
    if (!ok) return;
    const idx = items.findIndex((i) => i.id === sel.id);
    const next = items.filter((i) => i.id !== sel.id);
    onChange(next);
    setSelId(next[Math.max(0, idx - 1)]?.id ?? null);
  }

  // imagens de referência: referências vinculadas a este elemento
  const alvo: RefLink | null = sel ? { tipo: kind, id: sel.id } : null;
  const imagens = useMemo(
    () =>
      alvo
        ? (project.references ?? []).filter((r) => r.tipo === "imagem" && r.vinculos.some((v) => linkKey(v) === linkKey(alvo)))
        : [],
    [project.references, alvo?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function receberImagens(files: File[]) {
    if (!sel || !alvo) return;
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    const st = useApp.getState();
    const novas: Reference[] = imgs.map((f) => {
      const nome = /^image\.\w+$/i.test(f.name) ? `${kind}-${sel.nome || "imagem"}.${f.type.split("/")[1] || "png"}` : f.name;
      const { arquivo } = startAttachment(root, f, nome);
      return { id: newId(), tipo: "imagem", titulo: "", notas: "", arquivo, arquivoNome: nome, vinculos: [alvo], criadaEm: new Date().toISOString() };
    });
    st.updateReferences([...novas, ...(st.current?.project.references ?? [])]);
    if (!sel.imagem) update({ imagem: novas[0].arquivo } as Partial<T>);
  }

  function tirarImagem(r: Reference) {
    if (!alvo) return;
    const st = useApp.getState();
    const vinculos = r.vinculos.filter((v) => linkKey(v) !== linkKey(alvo));
    const emQuadro = st.current!.project.pesquisa.nos.some((n) => n.quadro?.itens.some((i) => i.refId === r.id));
    const refs = st.current!.project.references;
    // sem outro vínculo e fora dos quadros: some de vez (o arquivo fica em anexos/)
    st.updateReferences(vinculos.length || emQuadro ? refs.map((x) => (x.id === r.id ? { ...x, vinculos } : x)) : refs.filter((x) => x.id !== r.id));
    if (sel?.imagem === r.arquivo) update({ imagem: imagens.find((i) => i.id !== r.id)?.arquivo } as Partial<T>);
  }

  // Ctrl+V de imagem em qualquer lugar da ficha
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (!files.length || !sel) return;
      e.preventDefault();
      receberImagens(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const presenca = useMemo(
    () =>
      sel
        ? presenceOf(project.screenplay.elementos, project.meta.tipo, {
            tipo: kind,
            nome: sel.nome,
            nomeCompleto: (sel as unknown as { nomeCompleto?: string }).nomeCompleto,
          })
        : null,
    [sel, project.screenplay, project.meta.tipo, kind]
  );
  const secaoNome = kindOrSection(project.meta.tipo);

  function campo(f: FieldDef<T>) {
    if (!sel) return null;
    const v = (sel[f.key] as unknown as string) ?? "";
    return (
      <div className={`field ${f.half ? "half" : ""}`} key={f.key}>
        <label>{f.label}</label>
        {f.opcoes ? (
          <div className="seg seg-sm">
            {f.opcoes.map((o) => (
              <button key={o} className={`seg-opt ${v === o ? "active" : ""}`} onClick={() => update({ [f.key]: v === o ? "" : o } as Partial<T>)}>
                <span className="seg-label">{o}</span>
              </button>
            ))}
          </div>
        ) : f.area ? (
          <textarea
            className="textarea"
            value={v}
            placeholder={f.placeholder}
            rows={Math.min(12, Math.max(3, v.split("\n").length + Math.floor(v.length / 70)))}
            onChange={(e) => update({ [f.key]: e.target.value } as Partial<T>)}
          />
        ) : (
          <input className="input" value={v} placeholder={f.placeholder} onChange={(e) => update({ [f.key]: e.target.value } as Partial<T>)} />
        )}
      </div>
    );
  }

  return (
    <div className="bible">
      <div className="bible-list">
        <div className="bible-list-head">
          <h3>
            {titulo} <span className="bb-count">{items.length}</span>
          </h3>
          <button className="icon-btn" onClick={add} title={tt("Adicionar")}>
            <Icon name="plus" size={15} />
          </button>
        </div>
        {items.length > 6 && (
          <div className="rt-search bb-search">
            <Icon name="search" size={13} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tt("Buscar")} />
          </div>
        )}
        <div className="bible-items">
          {visiveis.map((i) => (
            <button key={i.id} className={`bible-item bb-row ${i.id === selId ? "active" : ""}`} onClick={() => setSelId(i.id)}>
              <Thumb root={root} arquivo={i.imagem} nome={i.nome} />
              <span className="bb-row-text">
                <span className="bb-row-name">{i.nome || tt("sem nome")}</span>
                {subtitulo && subtitulo(i) && <span className="bb-row-sub">{subtitulo(i)}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div
        className={`bible-detail ${arrastando ? "drop" : ""}`}
        onDragOver={(e) => {
          if (sel && Array.from(e.dataTransfer.types).includes("Files")) {
            e.preventDefault();
            setArrastando(true);
          }
        }}
        onDragLeave={(e) => e.currentTarget === e.target && setArrastando(false)}
        onDrop={(e) => {
          setArrastando(false);
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          receberImagens(Array.from(e.dataTransfer.files));
        }}
      >
        {sel ? (
          <div className="bible-form bb-form" key={sel.id}>
            <div className="bb-head">
              <button className="bb-photo" onClick={() => fileRef.current?.click()} title={tt("Escolher a foto (ou cole com Ctrl+V)")}>
                {sel.imagem ? <PhotoImg root={root} arquivo={sel.imagem} /> : <Icon name="image" size={22} />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files) receberImagens(Array.from(e.target.files));
                  e.target.value = "";
                }}
              />
              <div className="bb-head-main">
                <label className="bb-label">{nomeLabel}</label>
                <input
                  className="bb-name"
                  value={sel.nome}
                  placeholder={nomePlaceholder}
                  autoFocus={!sel.nome}
                  onChange={(e) => update({ nome: e.target.value } as Partial<T>)}
                />
                {presenca && (
                  <div className="bb-stats">
                    <span>
                      <b>{presenca.secoes.length}</b> {presenca.secoes.length === 1 ? secaoNome[0] : secaoNome[1]}
                    </span>
                    {kind === "personagem" && project.meta.tipo !== "novel" && (
                      <span>
                        <b>{presenca.falas}</b> {presenca.falas === 1 ? tt("fala") : tt("falas")}
                      </span>
                    )}
                    {presenca.mencoes > 0 && (
                      <span>
                        <b>{presenca.mencoes}</b> {presenca.mencoes === 1 ? tt("menção") : tt("menções")}
                      </span>
                    )}
                    {presenca.secoes[0] && (
                      <button className="bb-first" onClick={() => focusElement(presenca.secoes[0].id)} title={presenca.secoes[0].titulo}>
                        {tt("Primeira aparição: {titulo}", { titulo: presenca.secoes[0].titulo })}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button className="icon-btn danger" onClick={() => void remove()} title={tt("Excluir")}>
                <Icon name="trash" size={14} />
              </button>
            </div>

            {secoes.map((s) => (
              <section className="bb-sec" key={s.titulo}>
                <div className="bb-sec-title">{s.titulo}</div>
                <div className="bb-fields">{s.campos.map(campo)}</div>
              </section>
            ))}

            {extra && <section className="bb-sec">{extra(sel, update)}</section>}

            <section className="bb-sec">
              <div className="bb-sec-title">
                {tt("Imagens de referência")}
                <span className="bb-hint">{tt("Cole com Ctrl+V ou arraste imagens para cá")}</span>
              </div>
              <div className="bb-gallery">
                {imagens.map((r) => (
                  <GalleryImage
                    key={r.id}
                    r={r}
                    root={root}
                    principal={sel.imagem === r.arquivo}
                    onMain={() => update({ imagem: r.arquivo } as Partial<T>)}
                    onRemove={() => tirarImagem(r)}
                    onOpen={setLightbox}
                  />
                ))}
                <button className="bb-add-img" onClick={() => fileRef.current?.click()}>
                  <Icon name="plus" size={16} />
                  {tt("Adicionar")}
                </button>
              </div>
            </section>

            {presenca && presenca.secoes.length > 0 && (
              <section className="bb-sec">
                <div className="bb-sec-title">{tt("Aparece em")}</div>
                <div className="bb-scenes">
                  {presenca.secoes.slice(0, 40).map((s) => (
                    <button key={s.id} className="bb-scene" onClick={() => focusElement(s.id)} title={s.titulo}>
                      {s.n > 0 && <span className="bb-scene-n">{s.n}</span>}
                      {s.titulo}
                    </button>
                  ))}
                  {presenca.secoes.length > 40 && <span className="faint">{tt("e mais {n}", { n: presenca.secoes.length - 40 })}</span>}
                </div>
              </section>
            )}

            {alvo && <LinkedResearch alvo={alvo} nome={sel.nome} semImagens />}
          </div>
        ) : (
          <div className="bible-empty">{vazio}</div>
        )}
      </div>

      {lightbox && (
        <div className="rs-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}

function PhotoImg({ root, arquivo }: { root: ProjectDir | null; arquivo: string }) {
  const url = useProjectImageUrl(root, arquivo);
  return url ? <img src={url} alt="" /> : <Icon name="image" size={22} />;
}

function kindOrSection(tipo: string): [string, string] {
  return tipo === "novel" ? [tt("capítulo"), tt("capítulos")] : tipo === "quadrinhos" ? [tt("página"), tt("páginas")] : [tt("cena"), tt("cenas")];
}
