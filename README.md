# OpenCena

**Português** · [English](README.en.md)

Editor **livre e offline** para escrever **roteiro audiovisual**, **roteiro de quadrinhos** e **novel / livro**. Os projetos ficam em pastas no seu computador, em arquivos abertos. Sem nuvem, sem conta, sem assinatura.

> **Versão beta (0.9).** Já dá para escrever de verdade, mas ainda pode ter erros. Faça cópias da sua pasta de projetos de vez em quando e conte o que encontrar no [fórum](https://opencena.discourse.group).

- Novidades de cada versão: [CHANGELOG.md](CHANGELOG.md)
- Como contribuir: [CONTRIBUTING.md](CONTRIBUTING.md) · Traduzir: [docs/TRADUZIR.md](docs/TRADUZIR.md)

## Licença

Software livre sob a **GNU GPL v3 ou posterior** ([LICENSE](LICENSE)). O que você escreve no OpenCena é seu: a licença vale para o programa, não para as obras.

## Baixar

Os instaladores para Windows (`.exe`, `.msi`), macOS (`.dmg`, Apple Silicon e Intel) e Linux (`.AppImage`, `.deb`) ficam em [Releases](../../releases/latest). O app instalado procura atualizações ao abrir e instala com um clique.

Os instaladores ainda não são assinados: o Windows mostra o aviso do SmartScreen ("Mais informações" > "Executar assim mesmo") e o macOS pede para abrir com o botão direito > "Abrir" na primeira vez.

## Code signing policy

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

Os instaladores para Windows são compilados pelo GitHub Actions a partir deste repositório, e cada versão assinada precisa de aprovação manual.

- **Committers and reviewers** (alteram o código e revisam contribuições): [membros da organização OpenCena](https://github.com/orgs/OpenCena/people)
- **Approvers** (aprovam cada pedido de assinatura): [administradores da organização OpenCena](https://github.com/orgs/OpenCena/people?query=role%3Aowner)

**Privacidade:** o OpenCena não envia seus textos, projetos ou dados pessoais para lugar nenhum. A única conexão que o app instalado faz sozinho é a busca de atualização no GitHub, que pode ser desligada em Configurações.

## Rodar o código

Requisito: Node.js 20 ou mais novo.

```bash
npm install
npm run dev          # versão web em http://localhost:3000
npm test             # testes automáticos (Vitest)
npm run typecheck    # tipos
npm run i18n         # traduções que faltam
```

A versão web grava as pastas com a File System Access API, então funciona no Chrome, Edge, Brave, Opera ou Vivaldi.

### App instalado (Tauri)

1. Instale o Rust: https://rustup.rs
   - Windows: também as "Ferramentas de Build do Visual Studio" (C++).
   - macOS: `xcode-select --install`
   - Linux (Ubuntu/Debian): `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libayatana-appindicator3-dev librsvg2-dev`
2. `npm run desktop` abre o app em modo de desenvolvimento (a porta 3000 precisa estar livre).
3. `npm run desktop:build` gera o instalador do sistema em que você está, em `src-tauri/target/release/bundle/`.

## Tipos de projeto

| Tipo | Blocos (Ctrl+1…N) | Página |
|------|-------------------|--------|
| Roteiro audiovisual (filme ou seriado) | Cena · Ação · Personagem · Diálogo · Parêntese · Transição | A4, Courier 12, margens de indústria |
| Quadrinhos (história única ou em capítulos) | Página · Quadro · Descrição · Personagem · Balão · Legenda · SFX · Nota | A4, Courier 12 |
| Novel / livro | Capítulo · Parágrafo · Separador de cena · Citação | 14 × 21 cm e outros formatos, ou Web |

- **Roteiro:** numeração de cenas, `(CONT'D)` automático, diálogo cortado entre páginas ganha `(MAIS)` no pé e `NOME (CONT'D)` no topo seguinte.
- **Quadrinhos:** `PÁGINA 3 (4 QUADROS)` e `QUADRO 2` numerados sozinhos, balões e legendas numerados por página, contagem de quadros e palavras na margem.
- **Novel:** texto justificado, recuo de parágrafo, capítulo em página nova, cabeçalho corrente, margens espelhadas, capa e páginas de abertura (folha de rosto, créditos, dedicatória, epígrafe, sumário). O formato **Web** é para quem só quer publicar na internet.

As marcas que vão para o texto (`(MAIS)`, "escrito por", "Sumário") seguem o **idioma do documento**, escolhido em Configurações > Este projeto, independente do idioma da interface.

## Paginação medida

O editor mostra folhas do tamanho real do papel. A quebra de página é calculada medindo o texto no navegador (fonte, itálico, justificação, hifenização), linha a linha, com controle de viúva e órfã e "manter com o próximo" para títulos, cabeçalhos e personagens. **O PDF usa o mesmo cálculo:** a página N do PDF é a página N da tela.

## Importar e exportar

Importa Word (.docx), texto, Markdown e Fountain, reconhecendo cenas, personagens e falas (roteiro), páginas, quadros e balões (HQ) ou capítulos, negrito e itálico (novel), em português, inglês ou espanhol. Antes de substituir o documento, um backup é criado.

| Formato | Roteiro | Quadrinhos | Novel |
|---------|:------:|:----------:|:-----:|
| PDF (com capa e páginas de abertura) | ✓ | ✓ | ✓ |
| PDF livreto para imprimir em casa | | | ✓ |
| Word `.docx` (mesmo papel, margens e fontes) | ✓ | ✓ | ✓ |
| E-book `.epub` | | | ✓ |
| Página web `.html` e texto para colar no Wattpad ou blog | | | ✓ |
| Fountain | ✓ | | |
| Texto e Markdown | ✓ | ✓ | ✓ |

A escaleta também exporta para PDF e Word. Os arquivos vão para a pasta Downloads, com uma cópia em `exportados/` dentro do projeto.

## Os arquivos do projeto

```
MeuProjeto/
├── projeto.json             metadados, versão do formato, configuração de página
├── roteiro/                 (no novel: manuscrito/)
│   ├── capa.json
│   ├── screenplay.json      o documento e os comentários (no novel: texto.json)
│   ├── escaleta.json        atos, cartões e tramas
│   ├── temporada.json       arcos da temporada (seriados)
│   └── episodios/           obras em partes: uma pasta por episódio ou capítulo
├── personagens/personagens.json
├── locais/locais.json
├── objetos/objetos.json
├── pesquisa/
│   ├── estrutura.json       pastas, quadros e páginas
│   └── nos/<id>.json        o conteúdo de cada quadro ou página
├── anexos/                  imagens e arquivos
├── exportados/
└── backups/
```

Tudo é salvo enquanto você escreve, com backups automáticos. Os projetos podem ficar numa pasta sincronizada (Google Drive, OneDrive, iCloud, Dropbox) para abrir em outro computador. Quando o formato muda entre versões, o app migra o projeto sozinho ao abrir (`src/domain/migrations.ts`).

## Atalhos do editor

| Tecla | Ação |
|-------|------|
| `Enter` | Novo bloco, com o tipo seguinte natural (cena → ação, personagem → diálogo…) |
| `Tab` / `Shift+Tab` | Muda o tipo do bloco · aceita sugestão do autocomplete |
| `Ctrl+1…9` | Tipo do bloco |
| `Shift+Enter` | Quebra de linha dentro do bloco |
| `Ctrl+B` / `Ctrl+I` | Negrito / itálico |
| `Alt+M` | Comentar o trecho ou parágrafo |
| `Ctrl+F` / `Ctrl+H` | Localizar / substituir |
| `Ctrl+Shift+F` | Modo foco (Esc sai) |
| `Ctrl` + roda do mouse, `Ctrl +` / `Ctrl −` / `Ctrl 0` | Zoom |
| `Ctrl+K` | Busca e comandos |

No Mac os atalhos usam ⌘.

## Funciona sem internet

Fontes da interface (Inter), do roteiro (Courier Prime) e do livro (EB Garamond, Libre Baskerville, Crimson Text, Lora, Literata) vêm empacotadas. O PDF usa o mesmo arquivo de fonte da tela, então sai igual em qualquer computador. A única conexão que o app instalado faz sozinho é a busca de atualização, que pode ser desligada.

## Publicar uma versão

O workflow `.github/workflows/release.yml` compila para Windows, macOS e Linux e assina os pacotes para a atualização automática.

1. Em Settings > Secrets and variables > Actions, crie `TAURI_SIGNING_PRIVATE_KEY` e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. A chave pública já está em `src-tauri/tauri.conf.json`.
2. Ajuste a versão em `package.json`, `src-tauri/tauri.conf.json` e `src-tauri/Cargo.toml`, e acrescente a entrada no `CHANGELOG.md`.
3. `git tag v0.9.0` e `git push origin v0.9.0`.
4. No fim aparece um rascunho em Releases com os instaladores e o `latest.json`. Revise e publique.

O `.github/workflows/ci.yml` roda tipos, testes, traduções e o build a cada push e pull request.

## Estrutura do código

Vite · React · TypeScript · Zustand · TipTap/ProseMirror · jsPDF · Tauri.

```
src/
├── types/          modelo de dados (formato dos arquivos JSON)
├── domain/         projeto, exportações, importação, escaleta, histórico, migrações
├── layout/         perfis por tipo, formatos de página, medidor, paginação
├── editor/         extensões do TipTap, comentários, conversões
├── storage/        arquivos: navegador (File System Access) ou app instalado (Tauri)
├── store/          estado global (Zustand) e salvamento automático
├── i18n/           traduções (pt-BR, en, es)
├── components/     interface reutilizável
└── views/          telas (início, projeto, abas, escaleta)
tests/              testes automáticos
scripts/            chaves de tradução e capturas de tela
src-tauri/          app instalado (Rust)
```

`src/devSeed.ts` só existe no modo de desenvolvimento: cria projetos de exemplo (`?demo=claro&aba=escaleta`) usados por `scripts/capturas.mjs` para gerar as imagens do site.
