import { useState } from "react";
import { useApp } from "@/store/appStore";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { LangPicker } from "@/components/LangPicker";
import { AboutModal, VersionTag } from "@/components/About";
import { ModalOverlay } from "@/components/ModalOverlay";
import { BookParts, DEFAULT_BOOK_PARTS, ProjectType, RecentProject, WorkFormat } from "@/types";
import { KINDS, NOVEL_TEMPLATES } from "@/layout/profiles";
import { Select } from "@/components/Select";
import { BookPartsPicker } from "@/components/BookPartsPicker";
import { tt, locale } from "@/i18n";

const KIND_ICON: Record<ProjectType, "film" | "grid" | "bookOpen"> = {
  roteiro: "film",
  quadrinhos: "grid",
  novel: "bookOpen",
};

export function Home() {
  const recents = useApp((s) => s.recents);
  const openRecent = useApp((s) => s.openRecent);
  const openProjectFromPicker = useApp((s) => s.openProjectFromPicker);
  const chooseProjectsFolder = useApp((s) => s.chooseProjectsFolder);
  const [showNew, setShowNew] = useState(false);
  const [renaming, setRenaming] = useState<RecentProject | null>(null);
  const [deleting, setDeleting] = useState<RecentProject | null>(null);
  const [sobre, setSobre] = useState(false);

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 28,
        }}
      >
        <div>
          <div style={{ marginBottom: 18 }}>
            <Logo size={26} />
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{tt("Projetos")}</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            {tt("Roteiro, quadrinhos ou novel. Crie um projeto ou continue de onde parou.")}
          </p>
        </div>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <LangPicker />
          <ThemeToggle />
        </span>
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 40, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Icon name="plus" size={16} />
          {tt("Novo projeto")}
        </button>
        <button className="btn" onClick={() => void openProjectFromPicker()}>
          <Icon name="folderOpen" size={16} />
          {tt("Abrir projeto")}
        </button>
        <button className="btn btn-ghost" onClick={() => void chooseProjectsFolder()}>
          <Icon name="folder" size={16} />
          {tt("Mudar pasta")}
        </button>
      </div>

      <h2
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-faint)",
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        {tt("Recentes")}
      </h2>

      {recents.length === 0 ? (
        <p className="faint" style={{ fontSize: 13 }}>
          {tt("Nenhum projeto ainda.")}
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
            gap: 10,
          }}
        >
          {recents.map((r) => (
            <div
              key={r.id}
              className="recent-card"
              onClick={() => void openRecent(r)}
              style={{
                position: "relative",
                textAlign: "left",
                background: "var(--bg-panel)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: 14,
                cursor: "pointer",
                display: "flex",
                gap: 11,
                alignItems: "flex-start",
                transition: "border-color 0.1s, background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <span className={`kind-${r.tipo}`} style={{ color: "var(--kind-color)", marginTop: 1 }} title={KINDS[r.tipo]?.label}>
                <Icon name={KIND_ICON[r.tipo] ?? "fileText"} size={18} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    fontWeight: 500,
                    fontSize: 13.5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    paddingRight: 44,
                  }}
                >
                  {r.nome}
                </span>
                <span className="faint" style={{ fontSize: 11.5 }}>
                  {KINDS[r.tipo]?.label ?? tt("Roteiro")} · {r.autor || tt("sem autor")} ·{" "}
                  {new Date(r.abertoEm).toLocaleDateString(locale())}
                </span>
              </span>

              <div className="recent-actions">
                <button
                  className="recent-act"
                  title={tt("Renomear")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenaming(r);
                  }}
                >
                  <Icon name="pencil" size={14} />
                </button>
                <button
                  className="recent-act recent-act-danger"
                  title={tt("Excluir")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(r);
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className="home-foot">
        <button className="btn btn-ghost" onClick={() => setSobre(true)}>
          <Icon name="fileText" size={14} />
          {tt("Sobre e licença")}
        </button>
        <span className="faint">{tt("Software livre, licença GPL-3.0")}</span>
        <VersionTag onClick={() => setSobre(true)} />
      </footer>

      {sobre && <AboutModal onClose={() => setSobre(false)} />}
      {showNew && <NewProjectModal onClose={() => setShowNew(false)} />}
      {renaming && (
        <RenameModal recent={renaming} onClose={() => setRenaming(null)} />
      )}
      {deleting && (
        <DeleteModal recent={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

function RenameModal({
  recent,
  onClose,
}: {
  recent: RecentProject;
  onClose: () => void;
}) {
  const renameRecent = useApp((s) => s.renameRecent);
  const [nome, setNome] = useState(recent.nome);

  async function salvar() {
    if (!nome.trim()) return;
    await renameRecent(recent.id, nome.trim());
    onClose();
  }

  return (
    <ModalOverlay onClose={onClose} title={tt("Renomear projeto")} width={400}>
      <div className="field">
        <label>{tt("Nome do projeto")}</label>
        <input
          className="input"
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void salvar()}
        />
      </div>
      <p className="faint" style={{ fontSize: 12, margin: "2px 0 10px" }}>
        {tt("Renomeia o projeto (a pasta no disco não muda).")}
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>
          {tt("Cancelar")}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => void salvar()}
          disabled={!nome.trim()}
        >
          {tt("Salvar")}
        </button>
      </div>
    </ModalOverlay>
  );
}

function DeleteModal({
  recent,
  onClose,
}: {
  recent: RecentProject;
  onClose: () => void;
}) {
  const deleteRecent = useApp((s) => s.deleteRecent);
  const [apagarArquivos, setApagarArquivos] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirmar() {
    setBusy(true);
    await deleteRecent(recent.id, apagarArquivos);
    setBusy(false);
    onClose();
  }

  return (
    <ModalOverlay onClose={onClose} title={tt("Excluir projeto")} width={420}>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 14px" }}>
        {tt("Remover \"{nome}\" da lista de recentes?", { nome: recent.nome })}
      </p>
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          cursor: "pointer",
          marginBottom: 16,
        }}
      >
        <input
          type="checkbox"
          checked={apagarArquivos}
          onChange={(e) => setApagarArquivos(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          <span style={{ fontWeight: 500, fontSize: 13.5, color: "var(--danger, #c0392b)" }}>
            {tt("Apagar também os arquivos do disco")}
          </span>
          <span className="muted" style={{ display: "block", fontSize: 12.5 }}>
            {tt("Exclui a pasta do projeto permanentemente. Não dá para desfazer.")}
          </span>
        </span>
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          {tt("Cancelar")}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => void confirmar()}
          disabled={busy}
        >
          {busy ? tt("Excluindo…") : apagarArquivos ? tt("Excluir tudo") : tt("Remover")}
        </button>
      </div>
    </ModalOverlay>
  );
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const createNewProject = useApp((s) => s.createNewProject);
  const [nome, setNome] = useState("");
  const [autor, setAutor] = useState("");
  const [tipo, setTipo] = useState<ProjectType>("roteiro");
  const [formato, setFormato] = useState<WorkFormat>("filme");
  const [livro, setLivro] = useState<BookParts>({ ...DEFAULT_BOOK_PARTS });
  const [modelo, setModelo] = useState(NOVEL_TEMPLATES[0].id);
  const [busy, setBusy] = useState(false);

  const kind = KINDS[tipo];

  function changeTipo(t: ProjectType) {
    setTipo(t);
    setFormato(KINDS[t].formatos[0].id);
  }

  async function handleCreate() {
    if (!nome.trim()) return;
    setBusy(true);
    await createNewProject({
      nome: nome.trim(),
      autor: autor.trim(),
      tipo,
      formato,
      livro: tipo === "novel" ? livro : undefined,
      modelo: tipo === "novel" ? modelo : undefined,
    });
    setBusy(false);
    onClose();
  }

  return (
    <ModalOverlay onClose={onClose} title={tt("Novo projeto")} width={540}>
      <div className="kind-picker" role="radiogroup" aria-label={tt("Tipo de projeto")}>
        {(Object.keys(KINDS) as ProjectType[]).map((t) => (
          <button
            key={t}
            role="radio"
            aria-checked={tipo === t}
            className={`kind-option kind-${t} ${tipo === t ? "active" : ""}`}
            onClick={() => changeTipo(t)}
          >
            <Icon name={KIND_ICON[t]} size={20} />
            <span className="kind-name">{KINDS[t].label}</span>
            <span className="kind-desc">{KINDS[t].desc}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div className="field" style={{ flex: 1.4 }}>
          <label>{tipo === "novel" ? tt("Título do livro") : tt("Nome do projeto")}</label>
          <input
            className="input"
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>{tt("Autor")}</label>
          <input
            className="input"
            value={autor}
            onChange={(e) => setAutor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
          />
        </div>
      </div>

      {kind.formatos.length > 1 && (
        <div className="field">
          <label>{tt("Formato")}</label>
          <div className="seg">
            {kind.formatos.map((f) => (
              <button
                key={f.id}
                className={`seg-opt ${formato === f.id ? "active" : ""}`}
                onClick={() => setFormato(f.id)}
              >
                <span className="seg-label">{f.label}</span>
                <span className="seg-hint">{f.hint}</span>
                {formato === f.id && (
                  <span className="seg-check" aria-hidden="true">
                    <Icon name="check" size={11} strokeWidth={3} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {tipo === "novel" && (
        <div className="field">
          <label>{tt("Formato do livro")}</label>
          <Select
            ariaLabel={tt("Formato do livro")}
            direction="down"
            value={modelo}
            onChange={setModelo}
            options={NOVEL_TEMPLATES.map((t) => ({ value: t.id, label: t.label, hint: t.desc }))}
          />
        </div>
      )}

      {tipo === "novel" && (
        <div className="field">
          <label>{tt("O que o livro vai ter")}</label>
          <BookPartsPicker value={livro} onChange={setLivro} />
          <span className="faint" style={{ fontSize: 11.5 }}>
            {tt("Dá para mudar depois na aba Capa.")}
          </span>
        </div>
      )}

      <p className="faint" style={{ fontSize: 12, margin: "2px 0 12px", lineHeight: 1.5 }}>
        {tipo === "roteiro" && tt("Folha A4, Courier 12, margens de indústria.")}
        {tipo === "quadrinhos" && tt("Folha A4. Páginas, quadros, balões numerados, legendas e SFX.")}
        {tipo === "novel" && tt("Fonte, margens e formato podem ser ajustados depois em Configurar página.")}
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          {tt("Cancelar")}
        </button>
        <button className="btn btn-primary" onClick={() => void handleCreate()} disabled={busy || !nome.trim()}>
          {busy ? tt("Criando…") : tt("Criar")}
        </button>
      </div>
    </ModalOverlay>
  );
}
