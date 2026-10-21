// Página de texto da Pesquisa: blocos, atalhos de markdown e menu "/" para inserir.

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { ResearchNode } from "@/types";
import { Icon } from "@/components/Icon";
import { LinkChips } from "@/components/LinkChips";
import { openLink } from "@/storage/dir";
import type { ProjectDir } from "@/storage/dir";
import { startAttachment } from "@/storage/images";
import { PageImage } from "@/editor/pageImage";
import { kbd } from "@/utils/platform";
import type { LinkTarget } from "@/views/tabs/ResearchTab";
import { tt, uiLang } from "@/i18n";

type IconName = Parameters<typeof Icon>[0]["name"];

interface SlashItem {
  id: string;
  label: string;
  hint: string;
  icon: IconName | string;
  run: (e: Editor) => void;
}

const SLASH: SlashItem[] = [
  { id: "texto", label: tt("Texto"), hint: tt("Parágrafo comum"), icon: "type", run: (e) => e.chain().focus().setParagraph().run() },
  { id: "h1", label: tt("Título 1"), hint: tt("Título grande"), icon: "H1", run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
  { id: "h2", label: tt("Título 2"), hint: tt("Título médio"), icon: "H2", run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { id: "h3", label: tt("Título 3"), hint: tt("Título pequeno"), icon: "H3", run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { id: "lista", label: tt("Lista"), hint: tt("Lista com marcadores"), icon: "layoutList", run: (e) => e.chain().focus().toggleBulletList().run() },
  { id: "numerada", label: tt("Lista numerada"), hint: "1, 2, 3", icon: "1.", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: "tarefas", label: tt("Tarefas"), hint: tt("Lista com caixas de marcar"), icon: "check", run: (e) => e.chain().focus().toggleTaskList().run() },
  { id: "citacao", label: tt("Citação"), hint: tt("Trecho destacado"), icon: "“", run: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: "divisor", label: tt("Divisor"), hint: tt("Linha separadora"), icon: "—", run: (e) => e.chain().focus().setHorizontalRule().run() },
  { id: "imagem", label: tt("Imagem"), hint: tt("Escolher uma imagem do computador"), icon: "image", run: () => abrirArquivoImagem() },
  { id: "codigo", label: tt("Bloco de código"), hint: tt("Texto em fonte fixa"), icon: "{}", run: (e) => e.chain().focus().toggleCodeBlock().run() },
];

// o menu "/" pede uma imagem pelo seletor de arquivos da página aberta
let abrirArquivoImagem = () => {};

function SlashIcon({ icon }: { icon: string }) {
  const svg = ["type", "layoutList", "check", "image"].includes(icon);
  return <span className="np-slash-ico">{svg ? <Icon name={icon as IconName} size={14} /> : icon}</span>;
}

export function NotePage({
  node,
  targets,
  onChange,
  root,
}: {
  node: ResearchNode;
  targets: LinkTarget[];
  onChange: (p: Partial<ResearchNode>) => void;
  root: ProjectDir | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  abrirArquivoImagem = () => fileRef.current?.click();

  /** Imagens coladas, arrastadas ou escolhidas entram no texto na hora. */
  function inserirImagens(ed: Editor, files: File[], pos?: number) {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    imgs.forEach((f) => {
      const nome = /^image\.\w+$/i.test(f.name) ? `imagem-pagina.${f.type.split("/")[1] || "png"}` : f.name;
      const { arquivo } = startAttachment(root, f, nome);
      const chain = ed.chain().focus();
      if (pos != null) chain.insertContentAt(pos, { type: "imagem", attrs: { arquivo } });
      else chain.inserirImagem({ arquivo });
      chain.run();
    });
    return imgs.length > 0;
  }
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useRef<() => void>(() => {});

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" },
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        PageImage.configure({ root }),
        Placeholder.configure({
          placeholder: ({ node: n, editor: ed }) =>
            n.type.name === "heading" ? tt("Título") : ed.isEmpty ? tt("Escreva aqui, ou digite / para inserir um bloco…") : tt("Digite / para blocos"),
        }),
      ],
      content: (node.doc as object) ?? { type: "doc", content: [{ type: "paragraph" }] },
      editorProps: {
        attributes: { class: "np-doc", spellcheck: "true", lang: uiLang() },
        handlePaste: (view, ev) => {
          const files = Array.from(ev.clipboardData?.files ?? []);
          const ed = (view.dom as unknown as { editor?: Editor }).editor;
          if (!files.length || !ed) return false;
          return inserirImagens(ed, files);
        },
        handleDrop: (view, ev) => {
          const files = Array.from(ev.dataTransfer?.files ?? []);
          const ed = (view.dom as unknown as { editor?: Editor }).editor;
          if (!files.length || !ed) return false;
          const pos = view.posAtCoords({ left: ev.clientX, top: ev.clientY })?.pos;
          ev.preventDefault();
          return inserirImagens(ed, files, pos);
        },
        handleClick: (_view, _pos, ev) => {
          const a = (ev.target as HTMLElement).closest("a");
          if (a && (ev.ctrlKey || ev.metaKey)) {
            void openLink(a.getAttribute("href") ?? "");
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor: ed }) => {
        flush.current = () => {
          timer.current = null;
          onChangeRef.current({ doc: ed.getJSON() });
        };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => flush.current(), 250);
      },
    },
    [node.id]
  );

  // ao trocar de página ou sair, grava o que faltou
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        flush.current();
      }
    },
    [node.id]
  );

  // menu "/"
  const slash = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) return null;
      const { $from, empty } = ed.state.selection;
      if (!empty || $from.parent.type.name === "codeBlock") return null;
      const antes = $from.parent.textBetween(0, $from.parentOffset, "\0", "\0");
      const m = antes.match(/(?:^|\s)\/([\p{L}\d ]{0,20})$/u);
      if (!m) return null;
      return { q: m[1].toLowerCase(), from: $from.pos - m[1].length - 1, to: $from.pos };
    },
  });
  const [slashIdx, setSlashIdx] = useState(0);
  const [slashFechado, setSlashFechado] = useState<number | null>(null);
  const opcoes = useMemo(
    () =>
      slash && slash.from !== slashFechado
        ? SLASH.filter((s) => !slash.q || s.label.toLowerCase().includes(slash.q) || s.id.includes(slash.q))
        : [],
    [slash, slashFechado]
  );
  useEffect(() => setSlashIdx(0), [slash?.q]);

  function aplicar(item: SlashItem) {
    if (!editor || !slash) return;
    editor.chain().focus().deleteRange({ from: slash.from, to: slash.to }).run();
    item.run(editor);
  }

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    function onKey(e: KeyboardEvent) {
      if (!opcoes.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSlashIdx((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + opcoes.length) % opcoes.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        aplicar(opcoes[slashIdx]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setSlashFechado(slash?.from ?? null);
      }
    }
    dom.addEventListener("keydown", onKey, true);
    return () => dom.removeEventListener("keydown", onKey, true);
  });

  let pos: { left: number; top: number } | null = null;
  if (editor && slash && opcoes.length) {
    try {
      const c = editor.view.coordsAtPos(slash.from);
      pos = { left: c.left, top: c.bottom + 4 };
    } catch {
      pos = null;
    }
  }

  // barra de formatação
  const ativo = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            b: ed.isActive("bold"),
            i: ed.isActive("italic"),
            s: ed.isActive("strike"),
            h1: ed.isActive("heading", { level: 1 }),
            h2: ed.isActive("heading", { level: 2 }),
            ul: ed.isActive("bulletList"),
            ol: ed.isActive("orderedList"),
            task: ed.isActive("taskList"),
            q: ed.isActive("blockquote"),
            a: ed.isActive("link"),
          }
        : null,
  });

  // link: tira se já houver; senão pede o endereço num campo na barra
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  function link() {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const { from, to } = editor.state.selection;
    const sel = editor.state.doc.textBetween(from, to, " ").trim();
    setLinkUrl(/^\S+\.\S+$/.test(sel) ? sel : "");
  }
  function aplicarLink() {
    if (!editor || linkUrl === null) return;
    const href = linkUrl.trim();
    setLinkUrl(null);
    if (!href) return;
    const full = /^[a-z]+:/i.test(href) ? href : `https://${href}`;
    const { empty } = editor.state.selection;
    if (empty) editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href: full } }] }).run();
    else editor.chain().focus().setLink({ href: full }).run();
  }

  const B = ({ on, title, onClick, children }: { on?: boolean; title: string; onClick: () => void; children: React.ReactNode }) => (
    <button
      className={`ed-tool ed-icon ${on ? "active" : ""}`}
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      {children}
    </button>
  );

  return (
    <div className="np">
      <div className="ed-toolbar np-toolbar">
        <B on={ativo?.b} title={`${tt("Negrito")} (${kbd("B")})`} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <b>{tt("N")}</b>
        </B>
        <B on={ativo?.i} title={`${tt("Itálico")} (${kbd("I")})`} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <i style={{ fontFamily: "Georgia, serif" }}>{tt("I")}</i>
        </B>
        <B on={ativo?.s} title={tt("Riscado")} onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <s>{tt("S")}</s>
        </B>
        <span className="ed-sep" />
        <B on={ativo?.h1} title={tt("Título 1")} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
          {tt("H1")}
        </B>
        <B on={ativo?.h2} title={tt("Título 2")} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
          {tt("H2")}
        </B>
        <span className="ed-sep" />
        <B on={ativo?.ul} title={tt("Lista")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <Icon name="layoutList" size={14} />
        </B>
        <B on={ativo?.ol} title={tt("Lista numerada")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          1.
        </B>
        <B on={ativo?.task} title={tt("Tarefas")} onClick={() => editor?.chain().focus().toggleTaskList().run()}>
          <Icon name="check" size={14} />
        </B>
        <B on={ativo?.q} title={tt("Citação")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          “
        </B>
        <B on={ativo?.a} title={ativo?.a ? tt("Tirar link") : tt("Link")} onClick={link}>
          <Icon name="link" size={14} />
        </B>
        <B title={tt("Imagem (ou cole com Ctrl+V)")} onClick={() => fileRef.current?.click()}>
          <Icon name="image" size={14} />
        </B>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (editor && e.target.files) inserirImagens(editor, Array.from(e.target.files));
            e.target.value = "";
          }}
        />
        {linkUrl !== null && (
          <span className="np-linkbar">
            <input
              autoFocus
              value={linkUrl}
              placeholder={tt("Cole ou digite o endereço e aperte Enter")}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  aplicarLink();
                }
                if (e.key === "Escape") setLinkUrl(null);
              }}
              onBlur={() => setLinkUrl(null)}
            />
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span className="np-hint">{tt("Digite / para inserir blocos · Ctrl + clique abre links")}</span>
      </div>

      <div className="np-scroll">
        <div className="np-page">
          <input
            className="np-title"
            autoFocus={!node.titulo}
            value={node.titulo}
            placeholder={tt("Sem título")}
            onChange={(e) => onChange({ titulo: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor?.commands.focus("start");
              }
            }}
          />
          <LinkChips value={node.vinculos ?? []} targets={targets} onChange={(vinculos) => onChange({ vinculos })} />
          <EditorContent editor={editor} />
        </div>
      </div>

      {pos && (
        <div className="np-slash" style={{ position: "fixed", left: pos.left, top: pos.top }}>
          {opcoes.map((o, i) => (
            <button
              key={o.id}
              className={`np-slash-item ${i === slashIdx ? "active" : ""}`}
              onMouseEnter={() => setSlashIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                aplicar(o);
              }}
            >
              <SlashIcon icon={o.icon} />
              <span>
                <span className="np-slash-label">{o.label}</span>
                <span className="np-slash-hint">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
