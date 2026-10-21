import { useRef, useState } from "react";
import { confirmDialog } from "@/components/Dialogs";
import { isNative, openWithSystem, saveToDownloads } from "@/storage/dir";
import { useApp } from "@/store/appStore";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { writeBlob } from "@/storage/fs";
import { DocExtras, sanitizeFileName, toDocx, toEpub, toFountain, toMarkdown, toPlainText, toWebPage, webChapters, webClipboard } from "@/domain/export";
import { DEFAULT_PDF_OPTIONS, PdfOptions, buildPdf, layoutProject, pdfFileName, renderCoverJpeg } from "@/domain/pdf";
import { buildFrontMatter } from "@/layout/frontmatter";
import { countWords, tocFromLayout } from "@/layout/engine";
import { IMPORT_ACCEPT, importFile } from "@/domain/import";
import { renumberScenes } from "@/domain/screenplay";
import { kindOf, pageSettingsOf, presetById } from "@/layout/profiles";
import { ProjectType } from "@/types";
import { tt } from "@/i18n";

type Fmt = "fountain" | "docx" | "epub" | "web" | "txt" | "md";

type IconName = Parameters<typeof Icon>[0]["name"];

const FORMATS: { fmt: Fmt; ext: string; label: string; desc: string; icon: IconName; kinds: ProjectType[] }[] = [
  {
    fmt: "docx",
    ext: "docx",
    label: tt("Word"),
    icon: "fileText",
    desc: tt("Mesmo papel, margens, fonte e espaçamentos. Abre no Word ou LibreOffice paginado como aqui."),
    kinds: ["roteiro", "quadrinhos", "novel"],
  },
  {
    fmt: "epub",
    ext: "epub",
    label: tt("E-book"),
    icon: "bookOpen",
    desc: tt("Para Kindle (via Send to Kindle), Kobo, Apple Livros e Google Play Livros. Um arquivo por capítulo, com sumário."),
    kinds: ["novel"],
  },
  {
    fmt: "web",
    ext: "html",
    label: tt("Web"),
    icon: "external",
    desc: tt("Página pronta para publicar num site ou blog: leitura confortável no celular, com sumário e modo escuro automático."),
    kinds: ["novel"],
  },
  {
    fmt: "fountain",
    ext: "fountain",
    label: tt("Fountain"),
    icon: "film",
    desc: tt("Formato-texto padrão da indústria, abre no Final Draft, Highland, WriterDuet, Celtx…"),
    kinds: ["roteiro"],
  },
  { fmt: "txt", ext: "txt", label: tt("Texto"), icon: "type", desc: tt("Texto simples, com a indentação tradicional."), kinds: ["roteiro", "quadrinhos", "novel"] },
  { fmt: "md", ext: "md", label: tt("Markdown"), icon: "penLine", desc: tt("Para leitura em qualquer editor ou no GitHub."), kinds: ["roteiro", "quadrinhos", "novel"] },
];

export function ExportTab() {
  const cur = useApp((s) => s.current!);
  const previewMode = useApp((s) => s.previewMode);
  const setError = useApp((s) => s.setError);
  const setNotice = useApp((s) => s.setNotice);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fmtHint, setFmtHint] = useState<Fmt>("docx");

  const project = cur.project;
  const kind = kindOf(project.meta);
  const s = pageSettingsOf(project.meta);
  const base = sanitizeFileName(project.cover.titulo || project.meta.nome);
  const paper = presetById(s.formato)?.label ?? `${s.largura} × ${s.altura} mm`;

  const [pdfOpts, setPdfOpts] = useState<PdfOptions>({
    ...DEFAULT_PDF_OPTIONS,
    titlePage: true,
    sheet: s.formato === "carta" ? "carta" : "a4",
  });

  // Baixa o arquivo (vai para a pasta Downloads) e guarda uma cópia em
  // exportados/ dentro do projeto.
  async function save(filename: string, blob: Blob) {
    const onde = await saveToDownloads(filename, blob);
    let copia = false;
    if (!previewMode) {
      try {
        await writeBlob(cur.root, ["exportados", filename], blob);
        copia = true;
      } catch {
        /* a cópia é opcional; o download já foi feito */
      }
    }
    const local = isNative ? tt("salvo em {onde}", { onde }) : tt("baixado para a pasta Downloads");
    const texto = `${filename} ${local}${copia ? ` ${tt("(cópia em exportados/ no projeto)")}` : ""}.`;
    setMsg(texto);
    setNotice(texto);
  }

  async function run(id: string, fn: () => Promise<void>) {
    setMsg(null);
    setBusy(id);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  // Páginas de abertura e capa (precisam do layout e da imagem).
  async function docExtras(): Promise<DocExtras> {
    const { dl, layout } = layoutProject(project, false);
    const front = buildFrontMatter(project, layout, tocFromLayout(dl), countWords(dl));
    const capa = front.find((f) => f.image);
    const coverJpeg = capa?.image
      ? await renderCoverJpeg(previewMode ? null : cur.root, capa.image, layout, capa.items)
      : null;
    return { front, coverJpeg };
  }

  async function content(fmt: Fmt): Promise<Blob> {
    const text = (t: string) => new Blob([t], { type: "text/plain;charset=utf-8" });
    if (fmt === "fountain") return text(toFountain(project));
    if (fmt === "md") return text(toMarkdown(project));
    if (fmt === "docx") return toDocx(project, await docExtras());
    if (fmt === "epub") return toEpub(project, await docExtras());
    if (fmt === "web") return new Blob([toWebPage(project)], { type: "text/html;charset=utf-8" });
    return text(toPlainText(project));
  }

  const savePdf = () =>
    run("pdf", async () => {
      const pdf = await buildPdf(project, pdfOpts, previewMode ? null : cur.root);
      await save(pdfFileName(project, pdfOpts), pdf.output("blob"));
    });

  const openPdf = () =>
    run("print", async () => {
      // no navegador abre a aba antes de gerar (bloqueiam janelas abertas depois
      // de await); no app instalado abre no leitor de PDF do sistema
      const win = isNative ? null : window.open("", "_blank");
      const pdf = await buildPdf(project, pdfOpts, previewMode ? null : cur.root);
      await openWithSystem(pdfFileName(project, pdfOpts), pdf.output("blob"), win);
    });

  const isBook = kind.id === "novel";

  // copiar para a web (novel)
  const capitulos = isBook ? webChapters(project) : [];
  const [copiarCap, setCopiarCap] = useState("todos");
  const [copiado, setCopiado] = useState(false);
  async function copiarWeb() {
    const { html, text } = webClipboard(project, copiarCap === "todos" ? "todos" : Number(copiarCap));
    try {
      // com formatação (itálico, negrito) onde o site aceitar; texto puro nos outros
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(text);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  // importar
  const updateScreenplay = useApp((st) => st.updateScreenplay);
  const createBackup = useApp((st) => st.createBackup);
  const [modoImport, setModoImport] = useState<"fim" | "substituir">("fim");
  const fileRef = useRef<HTMLInputElement>(null);
  const importar = (file: File | undefined) => {
    if (!file) return;
    void run("import", async () => {
      const novos = await importFile(file, kind.id);
      if (!novos.length) {
        setMsg(tt("Nada para importar em {arquivo}.", { arquivo: file.name }));
        return;
      }
      if (modoImport === "substituir" && project.screenplay.elementos.some((e) => e.texto.trim())) {
        const ok = await confirmDialog({
          title: tt("Substituir o documento inteiro?"),
          message: tt("O texto atual será trocado pelo conteúdo de {arquivo}.", { arquivo: file.name }),
          details: previewMode ? [] : [tt("Antes, um backup é criado (aba Histórico)")],
          confirmLabel: tt("Substituir"),
          tone: "danger",
        });
        if (!ok) return;
      }
      if (!previewMode) await createBackup("importar"); // dá para voltar pelo Histórico
      const atuais = project.screenplay.elementos;
      // documento novo só com o bloco inicial vazio: substitui
      const vazio = atuais.every((e) => !e.texto.trim());
      const lista = modoImport === "substituir" || vazio ? novos : [...atuais, ...novos];
      updateScreenplay({ ...project.screenplay, elementos: kind.id === "roteiro" ? renumberScenes(lista) : lista });
      setMsg(novos.length === 1 ? tt("1 bloco importado de {arquivo}.", { arquivo: file.name }) : tt("{n} blocos importados de {arquivo}.", { n: novos.length, arquivo: file.name }));
    });
  };

  return (
    <div className="exp-wrap">
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600 }}>{tt("Importar e exportar")}</h2>
      <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        {previewMode
          ? tt("Os arquivos vão para a pasta Downloads do computador.")
          : tt("Os arquivos vão para a pasta Downloads, com uma cópia em exportados/ dentro do projeto.")}
      </p>

      {msg && <div className="exp-msg">{msg}</div>}

      <div className="exp-section">{tt("Exportar")}</div>

      {/* PDF em destaque */}
      <div className="exp-card exp-pdf">
        <div className="exp-head">
          <div>
            <div className="exp-title">{tt("PDF para impressão")}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              {tt("Igual às páginas do editor, com as mesmas quebras de linha e de página. Formato: {papel}.", { papel: paper })}
            </div>
          </div>
        </div>

        <div className="exp-opts">
          {isBook && (
            <div className="field" style={{ marginBottom: 10 }}>
              <label>{tt("Saída")}</label>
              <Select
                ariaLabel={tt("Saída do PDF")}
                value={pdfOpts.mode}
                onChange={(v) => setPdfOpts({ ...pdfOpts, mode: v as PdfOptions["mode"] })}
                options={[
                  { value: "paginas", label: tt("Páginas no tamanho do livro"), hint: tt("para gráfica, KDP, e-mail") },
                  { value: "livreto", label: tt("Livreto para imprimir em casa"), hint: tt("2 páginas por folha, dobra e grampeia") },
                ]}
              />
            </div>
          )}
          {pdfOpts.mode === "livreto" && (
            <>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>{tt("Folha da impressora")}</label>
                <Select
                  ariaLabel={tt("Folha")}
                  value={pdfOpts.sheet}
                  onChange={(v) => setPdfOpts({ ...pdfOpts, sheet: v as PdfOptions["sheet"] })}
                  options={[
                    { value: "a4", label: tt("A4 deitada") },
                    { value: "carta", label: tt("Carta deitada") },
                  ]}
                />
              </div>
              <p className="exp-hint">
                {tt("Imprima frente e verso virando pela borda curta, dobre o maço ao meio e grampeie na dobra. Páginas em branco são acrescentadas para completar múltiplos de 4.")}
                {s.largura > 148.5 || s.altura > 210 ? ` ${tt("Este formato é maior que meia folha A4 e será reduzido para caber.")}` : ""}
              </p>
              <label className="ps-check">
                <input
                  type="checkbox"
                  checked={pdfOpts.cropMarks}
                  onChange={(e) => setPdfOpts({ ...pdfOpts, cropMarks: e.target.checked })}
                />
                <span>
                  <span className="ps-check-label">{tt("Marcas de corte e de dobra")}</span>
                </span>
              </label>
            </>
          )}
          <label className="ps-check">
            <input
              type="checkbox"
              checked={pdfOpts.titlePage}
              onChange={(e) => setPdfOpts({ ...pdfOpts, titlePage: e.target.checked })}
            />
            <span>
              <span className="ps-check-label">{isBook ? tt("Incluir capa e páginas de abertura") : tt("Incluir folha de rosto")}</span>
              <span className="ps-check-hint">
                {isBook
                  ? tt("As páginas marcadas na aba Capa (capa, folha de rosto, créditos, dedicatória, epígrafe, sumário).")
                  : tt("Título, autor e contato (aba Capa).")}
              </span>
            </span>
          </label>
        </div>

        <div className="exp-actions">
          <button className="btn" onClick={() => void openPdf()} disabled={!!busy}>
            <Icon name="printer" size={15} />
            {busy === "print" ? tt("Gerando…") : tt("Abrir para imprimir")}
          </button>
          <button className="btn btn-primary" onClick={() => void savePdf()} disabled={!!busy}>
            <Icon name="download" size={15} />
            {busy === "pdf" ? tt("Gerando…") : tt("Salvar PDF")}
          </button>
        </div>
      </div>

      <div className="exp-card">
        <div className="exp-title" style={{ marginBottom: 8 }}>
          {tt("Outros formatos")}
        </div>
        <div className="exp-fmts">
          {FORMATS.filter((f) => f.kinds.includes(kind.id)).map((f) => (
            <button
              key={f.fmt}
              className="exp-fmt"
              title={f.desc}
              disabled={!!busy}
              onMouseEnter={() => setFmtHint(f.fmt)}
              onFocus={() => setFmtHint(f.fmt)}
              onClick={() => void run(f.fmt, async () => save(`${base}.${f.ext}`, await content(f.fmt)))}
            >
              <Icon name={f.icon} size={16} />
              <span className="exp-fmt-label">{busy === f.fmt ? tt("Gerando…") : f.label}</span>
            </button>
          ))}
        </div>
        <p className="exp-hint" style={{ margin: "8px 0 0" }}>
          {(FORMATS.find((f) => f.fmt === fmtHint) ?? FORMATS[0]).desc}
        </p>
        {isBook && (
          <div className="exp-web">
            <span className="exp-web-label">{tt("Copiar para colar no Wattpad, blog ou site")}</span>
            <div className="exp-web-pick">
              <Select
                className="sel-compact"
                ariaLabel={tt("O que copiar")}
                value={copiarCap}
                onChange={setCopiarCap}
                options={[
                  { value: "todos", label: tt("O livro inteiro") },
                  ...capitulos.map((c, i) => ({ value: String(i), label: c.titulo || `Trecho ${i + 1}` })),
                ]}
              />
            </div>
            <button className="btn" onClick={() => void copiarWeb()}>
              <Icon name={copiado ? "check" : "copy"} size={14} />
              {copiado ? tt("Copiado") : tt("Copiar")}
            </button>
          </div>
        )}
      </div>

      <div className="exp-section">{tt("Importar")}</div>
      <div className="exp-card">
        <div className="exp-head">
          <div>
            <div className="exp-title">{tt("Importar texto")}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              {kind.id === "roteiro" && tt("Fountain, Word (.docx), texto ou Markdown. Cenas, personagens e falas são reconhecidos.")}
              {kind.id === "quadrinhos" &&
                tt("Word (.docx), texto ou Markdown com linhas como PÁGINA 1, QUADRO 1, NOME: fala, LEGENDA:, SFX:.")}
              {kind.id === "novel" && tt("Word (.docx), texto ou Markdown. Títulos e linhas \"Capítulo...\" viram capítulos; negrito e itálico são mantidos.")}
            </div>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={IMPORT_ACCEPT[kind.id]}
          style={{ display: "none" }}
          onChange={(e) => {
            importar(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="exp-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="seg seg-sm exp-seg">
            <button className={`seg-opt ${modoImport === "fim" ? "active" : ""}`} onClick={() => setModoImport("fim")}>
              <span className="seg-label">{tt("Adicionar no fim")}</span>
            </button>
            <button
              className={`seg-opt ${modoImport === "substituir" ? "active" : ""}`}
              onClick={() => setModoImport("substituir")}
            >
              <span className="seg-label">{tt("Substituir tudo")}</span>
            </button>
          </div>
          <button className="btn" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={15} />
            {busy === "import" ? tt("Importando…") : tt("Escolher arquivo")}
          </button>
        </div>
        {modoImport === "substituir" && !previewMode && (
          <p className="exp-hint" style={{ margin: "8px 0 0" }}>
            {tt("Antes de substituir, um backup é criado (aba Histórico).")}
          </p>
        )}
      </div>

    </div>
  );
}
