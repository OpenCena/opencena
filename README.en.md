# OpenCena

[Português](README.md) · **English**

A **free, offline** editor for **screenplays**, **comic scripts** and **novels**. Your projects are plain folders on your computer, in open file formats. No cloud, no account, no subscription.

> **Beta (0.9).** You can already write for real, but there may still be bugs. Back up your projects folder now and then, and tell us what you find on the [forum](https://opencena.discourse.group).

- Changes in each version: [CHANGELOG.md](CHANGELOG.md) (in Portuguese)
- How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md) · Translating: [docs/TRADUZIR.md](docs/TRADUZIR.md)

## License

Free software under the **GNU GPL v3 or later** ([LICENSE](LICENSE)). What you write with OpenCena is yours: the license covers the program, not your work.

## Download

Installers for Windows (`.exe`, `.msi`), macOS (`.dmg`, Apple Silicon and Intel) and Linux (`.AppImage`, `.deb`) are on the [Releases](../../releases/latest) page. The desktop app checks for updates when it opens and installs them with one click.

The installers are not signed yet: Windows shows a SmartScreen warning ("More info" > "Run anyway") and macOS asks you to right-click > "Open" the first time.

## Features

| Type | Blocks (Ctrl+1…N) | Page |
|------|-------------------|------|
| Screenplay (film or series) | Scene heading · Action · Character · Dialogue · Parenthetical · Transition | A4, Courier 12, industry margins |
| Comics (single story or chapters) | Page · Panel · Description · Character · Balloon · Caption · SFX · Note | A4, Courier 12 |
| Novel / book | Chapter · Paragraph · Scene break · Quote | 14 × 21 cm and other trim sizes, or Web |

- **Screenplay:** scene numbers, automatic `(CONT'D)`, and dialogue split across pages gets `(MORE)` at the bottom and `NAME (CONT'D)` on the next page.
- **Comics:** pages and panels numbered automatically, balloons and captions numbered per page, panel and word counts in the margin.
- **Novel:** justified text, first-line indents, chapters on a new page, running headers, mirrored margins, cover and front matter (title page, copyright, dedication, epigraph, table of contents). The **Web** format is for writers who only publish online.
- **Measured pagination:** pages are laid out by measuring the real text, line by line, with widow and orphan control. The PDF uses the same engine, so page N of the PDF is page N on screen.
- **Outline:** cards in acts, structure templates (three acts, Save the Cat, Hero's Journey, Kishōtenketsu, TV episode, comic pages), plots, statuses, tags, setups and payoffs, season arcs. Cards are linked to the text: move a card and the scene moves.
- **Research:** folders, free boards (notes, images, links, files, arrows) and Notion-style pages with images, linked to characters, locations and objects.
- **Characters, locations and objects** with reference photos, relationships and where they appear in the text.
- **Comments** on words or paragraphs.
- **History:** automatic backups, word-by-word comparison between versions, and restore.
- **Export:** PDF, Word (.docx), EPUB, web page, Fountain, plain text and Markdown. **Import:** Fountain, Word, plain text and Markdown.
- **Interface in Portuguese, English and Spanish**, following the system language. Document conventions such as `(MORE)` or "written by" follow the document language, set per project.

## Project files

```
MyProject/
├── projeto.json             metadata, format version, page setup
├── roteiro/                 (manuscrito/ for novels)
│   ├── capa.json            title page / cover
│   ├── screenplay.json      the document and its comments (texto.json for novels)
│   ├── escaleta.json        outline: acts, cards and plots
│   └── episodios/           one folder per episode or chapter, for works in parts
├── personagens/ · locais/ · objetos/
├── pesquisa/                research: estrutura.json + nos/<id>.json
├── anexos/                  images and attachments
├── exportados/
└── backups/
```

Everything is saved as you write. You can keep your projects in a synced folder (Google Drive, OneDrive, iCloud, Dropbox) to open them on another computer. When the file format changes, the app migrates the project automatically when it opens it.

## Running the code

Requires Node.js 20 or later.

```bash
npm install
npm run dev          # web version at http://localhost:3000
npm test             # automated tests (Vitest)
npm run typecheck
npm run i18n         # missing translations
```

The web version writes folders through the File System Access API, so it runs in Chrome, Edge, Brave, Opera or Vivaldi.

### Desktop app (Tauri)

1. Install Rust: https://rustup.rs (on Windows, also the Visual Studio C++ Build Tools; on macOS, `xcode-select --install`; on Ubuntu/Debian, `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libayatana-appindicator3-dev librsvg2-dev`).
2. `npm run desktop` opens the app in development mode.
3. `npm run desktop:build` builds the installer for your current system.

Releases for all three systems are built by GitHub Actions (`.github/workflows/release.yml`) when a `v*` tag is pushed.

## Code layout

Vite · React · TypeScript · Zustand · TipTap/ProseMirror · jsPDF · Tauri.

```
src/
├── types/        data model (the JSON file format)
├── domain/       project, export, import, outline, history, migrations
├── layout/       document profiles, page formats, measuring, pagination
├── editor/       TipTap extensions, comments
├── storage/      files: browser (File System Access) or desktop (Tauri)
├── store/        app state (Zustand) and autosave
├── i18n/         translations (pt-BR, en, es)
├── components/   shared UI
└── views/        screens
tests/            automated tests
src-tauri/        desktop app (Rust)
```

The code, comments and file names are in Portuguese, the project's original language. Contributions in English are welcome.
