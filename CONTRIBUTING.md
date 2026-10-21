# Como contribuir com o OpenCena

Obrigado pelo interesse. O OpenCena é feito por quem escreve e por quem programa, e há lugar para os dois.

*English: contributions are welcome in English too. Discussion happens on the forum, code on GitHub. The steps below apply to everyone.*

## Antes de começar

- **Dúvidas, sugestões e problemas de uso:** [fórum](https://opencena.discourse.group).
- **Erros confirmados e tarefas:** issues do GitHub. Procure antes se já existe uma parecida.
- **Mudanças grandes** (um recurso novo, uma troca de biblioteca, uma mudança no formato dos arquivos): abra uma discussão no fórum ou uma issue antes de programar, para combinarmos o caminho.
- Issues marcadas com `boa para começar` são um bom ponto de partida.

## Rodar o projeto

Requisitos: Node.js 20 ou mais novo. Para o app instalado, também Rust e os [pré-requisitos do Tauri](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run dev          # versão web em http://localhost:3000 (Chrome ou Edge)
npm test             # testes automáticos
npm run typecheck    # verificação de tipos
npm run i18n         # traduções que faltam
npm run desktop      # app instalado (Tauri)
```

## Organização do código

| Pasta | O que tem |
|-------|-----------|
| `src/domain` | Regras do app, sem interface: projeto, exportação, importação, escaleta, histórico, migrações. A maior parte dos testes cobre esta pasta. |
| `src/layout` | Paginação medida: perfis de cada formato, quebras de página, PDF. |
| `src/editor` | Extensões do TipTap/ProseMirror. |
| `src/components`, `src/views` | Interface (React). |
| `src/store` | Estado do app (Zustand). |
| `src/storage` | Leitura e gravação de pastas (navegador e Tauri). |
| `src/i18n` | Traduções. Veja [docs/TRADUZIR.md](docs/TRADUZIR.md). |
| `src-tauri` | App instalado (Rust). |
| `tests` | Testes (Vitest). |

## Regras do código

- **Texto da interface** sempre por `tt("texto em português")`, com a tradução em `src/i18n/locales/en.json` e `es.json`. Marcas que vão para o documento (como `(MAIS)`) usam `tdoc(idioma, "...")`.
- **Sem travessão longo (—)** nos textos da interface.
- **Ícones em SVG** (`src/components/Icon.tsx`), nunca emojis.
- **Visual minimalista:** cores pelas variáveis de `src/styles/global.css`, cantos de 3 a 4 px. O laranja da marca (`--brand`) é só para detalhes.
- **Formato dos arquivos:** se mudar a estrutura de algum JSON do projeto, aumente `FORMAT_VERSION` em `src/domain/migrations.ts`, escreva a migração como função pura e um teste para ela. Projetos antigos precisam abrir sem perder nada.
- Funções novas em `src/domain` devem vir com testes.

## Pull requests

1. Faça um fork e crie um branch a partir de `main`.
2. Mantenha a mudança pequena e focada em um assunto.
3. Rode `npm run typecheck`, `npm test` e `npm run i18n` antes de enviar.
4. Descreva o que mudou, por quê, e como você testou (com capturas de tela se mexer na interface).
5. O CI roda as mesmas verificações. Alguém vai revisar e pode pedir ajustes.

## Licença das contribuições

O OpenCena é distribuído sob a **GPL-3.0-or-later**. Ao enviar uma contribuição, você concorda que ela seja distribuída sob a mesma licença e confirma que tem o direito de enviá-la (código escrito por você ou compatível com a GPL).

## Conduta

Todas as conversas seguem o [código de conduta](CODE_OF_CONDUCT.md).
