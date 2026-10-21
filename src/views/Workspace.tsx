import { useEffect, useState } from "react";
import { MOD, kbd } from "@/utils/platform";
import { useApp, WorkspaceTab } from "@/store/appStore";
import { Icon } from "@/components/Icon";
import { SaveStatus } from "@/components/SaveStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/CommandPalette";
import { SettingsModal } from "@/components/SettingsModal";
import { VersionTag } from "@/components/About";
import { DonateBox, DonateModal } from "@/components/Donate";
import { EpisodePicker } from "@/components/EpisodePicker";
import { Logo, LogoMark } from "@/components/Logo";
import { useAutoBackup } from "@/hooks/useAutoBackup";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import "@/styles/workspace.css";
import { CoverTab } from "@/views/tabs/CoverTab";
import { EditorTab } from "@/views/tabs/EditorTab";
import { OutlineTab } from "@/views/outline/OutlineTab";
import { ResearchTab } from "@/views/tabs/ResearchTab";
import { CharactersTab } from "@/views/tabs/CharactersTab";
import { LocationsTab } from "@/views/tabs/LocationsTab";
import { ObjectsTab } from "@/views/tabs/ObjectsTab";
import { ExportTab } from "@/views/tabs/ExportTab";
import { HistoryTab } from "@/views/tabs/HistoryTab";
import { KINDS, kindOf } from "@/layout/profiles";
import { tt } from "@/i18n";

type IconName = Parameters<typeof Icon>[0]["name"];

const TABS: { id: WorkspaceTab; label: string; icon: IconName }[] = [
  { id: "capa", label: tt("Capa"), icon: "book" },
  { id: "editor", label: tt("Roteiro"), icon: "penLine" },
  { id: "pesquisa", label: tt("Pesquisa"), icon: "bookmark" },
  { id: "escaleta", label: tt("Escaleta"), icon: "layoutList" },
  { id: "personagens", label: tt("Personagens"), icon: "user" },
  { id: "locais", label: tt("Locais"), icon: "mapPin" },
  { id: "objetos", label: tt("Objetos"), icon: "box" },
];

const TOOL_TABS: { id: WorkspaceTab; label: string; icon: IconName }[] = [
  { id: "exportar", label: tt("Importar e exportar"), icon: "download" },
  { id: "historico", label: tt("Histórico"), icon: "history" },
];

export function Workspace() {
  const project = useApp((s) => s.current!.project);
  const kind = kindOf(project.meta);
  const tabs = TABS.map((t) =>
    t.id === "editor"
      ? { ...t, label: kind.docLabel }
      : t.id === "escaleta" && kind.id === "novel"
        ? { ...t, label: tt("Estrutura") }
        : t
  );
  const tab = useApp((s) => s.workspaceTab);
  const setTab = useApp((s) => s.setWorkspaceTab);
  const closeProject = useApp((s) => s.closeProject);
  const focusMode = useApp((s) => s.focusMode && s.workspaceTab === "editor");

  useAutoBackup();

  const isMobile = useMediaQuery("(max-width: 760px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCmd, setShowCmd] = useState(false);
  const [showSettings, setShowSettings] = useState<false | "projeto" | "geral" | "sobre">(false);
  const [showDonate, setShowDonate] = useState(false);
  // menu lateral recolhido (só ícones); lembrado entre sessões
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("opencena:menu-recolhido") === "1";
    } catch {
      return false;
    }
  });
  const mini = collapsed && !isMobile;
  function toggleCollapsed() {
    setCollapsed((v) => {
      try {
        localStorage.setItem("opencena:menu-recolhido", v ? "0" : "1");
      } catch {
        /* sem armazenamento: só nesta sessão */
      }
      return !v;
    });
  }

  // Ao navegar no mobile, fecha a gaveta.
  function go(id: WorkspaceTab) {
    setTab(id);
    if (isMobile) setSidebarOpen(false);
  }

  // Ctrl/Cmd+K abre a command palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCmd((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`ws-root ${focusMode ? "focus" : ""}`}>
      <div
        className={`ws-backdrop ${sidebarOpen ? "show" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`ws-aside ${sidebarOpen ? "open" : ""} ${mini ? "mini" : ""}`}>
        <div className="ws-aside-top">
          <span className="ws-logo">{mini ? <LogoMark size={22} /> : <Logo size={22} />}</span>
          {!isMobile && (
            <button
              className="ws-collapse"
              onClick={toggleCollapsed}
              data-tip={mini ? tt("Abrir menu") : undefined}
              aria-label={mini ? tt("Abrir menu") : tt("Recolher menu")}
              title={mini ? undefined : tt("Recolher menu")}
            >
              <Icon name="sidebar" size={15} />
            </button>
          )}
        </div>

        <button className="ws-nav ws-back" onClick={closeProject} data-tip={mini ? tt("Projetos") : undefined}>
          <Icon name="chevronLeft" size={16} />
          <span className="ws-label">{tt("Projetos")}</span>
        </button>

        {!mini && (
          <div className="ws-project">
            <div className="ws-project-name">{project.meta.nome}</div>
            <div className={`ws-project-kind kind-${project.meta.tipo}`}>
              <span className="kind-dot" />
              {KINDS[project.meta.tipo]?.label ?? tt("Roteiro")}
            </div>
          </div>
        )}

        {!mini && <EpisodePicker />}

        <nav className="ws-navlist">
          {tabs.map((t) => (
            <NavButton
              key={t.id}
              label={t.label}
              icon={t.icon}
              mini={mini}
              active={tab === t.id}
              onClick={() => go(t.id)}
            />
          ))}
          <div className="ws-sep" />
          {TOOL_TABS.map((t) => (
            <NavButton
              key={t.id}
              label={t.label}
              icon={t.icon}
              mini={mini}
              active={tab === t.id}
              onClick={() => go(t.id)}
            />
          ))}
        </nav>

        <div className="ws-aside-foot">
          {mini ? (
            <>
              <button className="ws-nav" onClick={() => setShowDonate(true)} data-tip={tt("Apoie a plataforma")}>
                <Icon name="heart" size={16} />
              </button>
              <ThemeToggle compact />
            </>
          ) : (
            <>
              <DonateBox onClick={() => setShowDonate(true)} />
              <div style={{ paddingTop: 12 }}>
                <ThemeToggle full />
              </div>
              <VersionTag onClick={() => setShowSettings("sobre")} />
            </>
          )}
        </div>
      </aside>

      <main className="ws-main">
        <header
          style={{
            height: 44,
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 18px",
            flexShrink: 0,
            background: "var(--bg-panel)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            <button
              className="ws-hamburger"
              onClick={() => setSidebarOpen(true)}
              title={tt("Menu")}
            >
              <Icon name="layoutList" size={18} />
            </button>
            <span style={{ fontWeight: 500, fontSize: 13 }}>
              {[...tabs, ...TOOL_TABS].find((t) => t.id === tab)?.label}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="btn btn-ghost"
              onClick={() => setShowCmd(true)}
              style={{ padding: "5px 9px", color: "var(--text-muted)", fontSize: 12.5 }}
              title={`${tt("Buscar")} (${kbd("K")})`}
            >
              <Icon name="search" size={14} />
              <span style={{ fontSize: 11, opacity: 0.7 }}>{MOD} K</span>
            </button>
            <button
              className="btn-ghost"
              onClick={() => setShowSettings("projeto")}
              style={{ border: "none", padding: 5, display: "inline-flex", color: "var(--text-muted)" }}
              title={tt("Configurações")}
            >
              <Icon name="settings" size={16} />
            </button>
            <SaveStatus />
          </div>
        </header>

        <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
          {tab === "capa" && <CoverTab />}
          {tab === "editor" && <EditorTab key={`${project.meta.id}:${project.meta.tipo}`} />}
          {tab === "pesquisa" && <ResearchTab />}
          {tab === "escaleta" && <OutlineTab />}
          {tab === "personagens" && <CharactersTab />}
          {tab === "locais" && <LocationsTab />}
          {tab === "objetos" && <ObjectsTab />}
          {tab === "exportar" && <ExportTab />}
          {tab === "historico" && <HistoryTab />}
        </div>
      </main>

      {showCmd && (
        <CommandPalette
          onClose={() => setShowCmd(false)}
          openSettings={(t) => setShowSettings(t ?? "projeto")}
        />
      )}
      {showSettings && <SettingsModal initialTab={showSettings} onClose={() => setShowSettings(false)} />}
      {showDonate && <DonateModal onClose={() => setShowDonate(false)} />}
    </div>
  );
}

function NavButton({
  label,
  icon,
  active,
  mini,
  onClick,
}: {
  label: string;
  icon: IconName;
  active: boolean;
  mini: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`ws-nav ${active ? "active" : ""}`}
      onClick={onClick}
      data-tip={mini ? label : undefined}
      aria-label={label}
    >
      <Icon name={icon} size={16} />
      <span className="ws-label">{label}</span>
    </button>
  );
}
