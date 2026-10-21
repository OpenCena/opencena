import { useEffect, useMemo, useRef, useState } from "react";
import { useApp, WorkspaceTab } from "@/store/appStore";
import { Icon } from "@/components/Icon";
import { ELEMENT_LABEL, kindOf } from "@/layout/profiles";
import { exportPdf } from "@/domain/pdf";
import { tt } from "@/i18n";
import "@/styles/cmd.css";

type IconName = Parameters<typeof Icon>[0]["name"];

interface Item {
  id: string;
  group: string;
  label: string;
  icon: IconName;
  tag?: string;
  run: () => void;
}

const NAV: { id: WorkspaceTab; label: string; icon: IconName }[] = [
  { id: "capa", label: tt("Capa"), icon: "book" },
  { id: "editor", label: tt("Documento"), icon: "penLine" },
  { id: "pesquisa", label: tt("Pesquisa"), icon: "bookmark" },
  { id: "escaleta", label: tt("Escaleta"), icon: "layoutList" },
  { id: "personagens", label: tt("Personagens"), icon: "user" },
  { id: "locais", label: tt("Locais"), icon: "mapPin" },
  { id: "objetos", label: tt("Objetos"), icon: "box" },
  { id: "exportar", label: tt("Importar e exportar"), icon: "download" },
  { id: "historico", label: tt("Histórico"), icon: "history" },
];

export function CommandPalette({
  onClose,
  openSettings,
}: {
  onClose: () => void;
  openSettings: (tab?: "projeto" | "geral" | "sobre") => void;
}) {
  const project = useApp((s) => s.current!.project);
  const setWorkspaceTab = useApp((s) => s.setWorkspaceTab);
  const setTheme = useApp((s) => s.setTheme);
  const createBackup = useApp((s) => s.createBackup);
  const focusElement = useApp((s) => s.focusElement);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();

    const go =
      (tab: WorkspaceTab): (() => void) =>
      () => {
        setWorkspaceTab(tab);
        onClose();
      };

    const actions: Item[] = [
      {
        id: "act-backup",
        group: tt("Ações"),
        label: tt("Criar backup agora"),
        icon: "history",
        run: () => {
          void createBackup("manual").then((ok) =>
            useApp.getState().setNotice(ok ? tt("Backup criado.") : tt("Nada mudou desde o último backup."))
          );
          onClose();
        },
      },
      {
        id: "act-pdf",
        group: tt("Ações"),
        label: tt("Gerar PDF"),
        icon: "download",
        run: () => {
          const st = useApp.getState();
          void exportPdf(project, undefined, st.previewMode ? null : st.current?.root ?? null);
          onClose();
        },
      },
      {
        id: "act-settings",
        group: tt("Ações"),
        label: tt("Configurações"),
        icon: "settings",
        run: () => {
          openSettings();
          onClose();
        },
      },
      {
        id: "act-about",
        group: tt("Ações"),
        label: tt("Sobre e licença"),
        icon: "fileText",
        run: () => {
          openSettings("sobre");
          onClose();
        },
      },
      {
        id: "act-light",
        group: tt("Ações"),
        label: tt("Tema: claro"),
        icon: "sun",
        run: () => {
          setTheme("light");
          onClose();
        },
      },
      {
        id: "act-dark",
        group: tt("Ações"),
        label: tt("Tema: escuro"),
        icon: "moon",
        run: () => {
          setTheme("dark");
          onClose();
        },
      },
    ];

    const nav: Item[] = NAV.map((n) => ({
      id: `nav-${n.id}`,
      group: tt("Ir para"),
      label: n.id === "editor" ? kindOf(project.meta).docLabel : n.label,
      icon: n.icon,
      run: go(n.id),
    }));

    if (!q) return [...nav, ...actions];

    const match = (s: string) => s.toLowerCase().includes(q);

    const nav2 = nav.filter((n) => match(n.label));
    const act2 = actions.filter((a) => match(a.label));

    // Busca no roteiro.
    const script: Item[] = project.screenplay.elementos
      .filter((el) => el.texto && match(el.texto))
      .slice(0, 8)
      .map((el) => ({
        id: `sp-${el.id}`,
        group: kindOf(project.meta).docLabel,
        label: el.texto,
        icon: "penLine",
        tag: ELEMENT_LABEL[el.tipo],
        run: () => {
          focusElement(el.id);
          onClose();
        },
      }));

    // Busca em personagens.
    const chars: Item[] = project.characters
      .filter((c) => match(c.nome) || match(c.descricao) || match(c.historia))
      .slice(0, 5)
      .map((c) => ({
        id: `ch-${c.id}`,
        group: tt("Personagens"),
        label: c.nome || tt("sem nome"),
        icon: "user",
        run: go("personagens"),
      }));

    // Busca em locais.
    const locs: Item[] = project.locations
      .filter((l) => match(l.nome) || match(l.descricao))
      .slice(0, 5)
      .map((l) => ({
        id: `lo-${l.id}`,
        group: tt("Locais"),
        label: l.nome || tt("sem nome"),
        icon: "mapPin",
        run: go("locais"),
      }));

    return [...act2, ...nav2, ...script, ...chars, ...locs];
  }, [
    query,
    project,
    setWorkspaceTab,
    setTheme,
    createBackup,
    focusElement,
    openSettings,
    onClose,
  ]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  // Agrupa mantendo o índice global para navegação por teclado.
  let flatIndex = -1;
  const groups: { label: string; items: { item: Item; index: number }[] }[] = [];
  for (const item of items) {
    flatIndex += 1;
    const g = groups.find((x) => x.label === item.group);
    const entry = { item, index: flatIndex };
    if (g) g.items.push(entry);
    else groups.push({ label: item.group, items: [entry] });
  }

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmd-input"
          placeholder={tt("Buscar no roteiro, ir para, ações…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="cmd-results">
          {items.length === 0 && <div className="cmd-empty">{tt("Nada encontrado.")}</div>}
          {groups.map((g) => (
            <div key={g.label}>
              <div className="cmd-group-label">{g.label}</div>
              {g.items.map(({ item, index }) => (
                <div
                  key={item.id}
                  className={`cmd-item ${index === active ? "active" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    item.run();
                  }}
                >
                  <span className="cmd-ico">
                    <Icon name={item.icon} size={15} />
                  </span>
                  <span className="cmd-snippet">{item.label}</span>
                  {item.tag && <span className="cmd-tag">{item.tag}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
