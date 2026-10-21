# Novidades

Mudanças de cada versão do OpenCena. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [versionamento semântico](https://semver.org/lang/pt-BR/).

## [0.9.2] - 2026-10 · Beta

### Correções

- Atualização automática no Windows: o instalador agora espera o OpenCena terminar de fechar antes de continuar. Antes, podia parar com "Falha ao fechar OpenCena".

## [0.9.1] - 2026-10 · Beta

### Instalação

- Instalador do Windows com a logo do OpenCena, textos próprios nas telas de boas-vindas e de conclusão, e sem a tela de aceite da licença (a GPL não exige aceite para usar o programa).
- Instalador do macOS com janela própria para arrastar o app para Aplicativos.

### Projeto

- Política de assinatura de código (code signing policy) no README e no site.

## [0.9.0] - 2026-10 · Beta

Primeira versão pública. **É uma beta:** já dá para escrever de verdade, mas ainda pode ter erros. Faça cópias da sua pasta de projetos de vez em quando.

### Formatos

- Roteiro audiovisual (filme e seriado), com numeração de cenas, `(CONT'D)` automático e `(MAIS)` nas quebras de diálogo.
- Roteiro de quadrinhos, com páginas, quadros, balões e legendas numerados e contagem por página.
- Novel e livro, com capítulos, formatos de gráfica, margens espelhadas, cabeçalho corrente, capa e páginas de abertura.
- Paginação medida, igual na tela e no PDF.

### Escrita

- Comentários em palavras ou parágrafos, com respostas e resolução.
- Localizar e substituir, paleta de comandos (Ctrl+K), modo foco e metas de escrita.
- Idioma do documento para as marcas do texto (`(MORE)`, `written by`, `Contents`).

### Planejamento

- Escaleta em atos com modelos de estrutura (três atos, Save the Cat, Jornada do Herói, Kishōtenketsu, episódio de série, HQ por páginas).
- Tramas, andamento, etiquetas, imagem no cartão, plantar e colher.
- Cartões ligados ao texto: mover um cartão move a cena; criar cartões a partir do texto e o contrário.
- Vistas de quadro, lista, tramas e personagens; planejamento de temporada para séries.
- Exportação da escaleta em PDF e Word.

### Pesquisa e fichas

- Pesquisa em pastas, quadros livres (notas, textos, imagens, links, arquivos, ligações) e páginas com imagens.
- Colar imagens, links e textos direto no quadro; levar uma nota para a escaleta.
- Personagens, locais e objetos com fotos de referência, relações, aparições no texto e referências vinculadas.

### Arquivos

- Projetos em pastas com arquivos JSON abertos; a pesquisa grava um arquivo por quadro ou página.
- Migrações automáticas do formato dos arquivos entre versões.
- Backups automáticos, histórico com comparação palavra por palavra e restauração.
- Exportação: PDF, Word (.docx), Fountain, EPUB, Markdown, texto e página web. Importação: Fountain, Word, texto e Markdown.

### Aplicativo

- Interface em português, inglês e espanhol, seguindo o idioma do sistema.
- App instalado para Windows, macOS e Linux, com atualização automática.
- Tema claro e escuro.
- Testes automáticos e verificação contínua no GitHub Actions.

[0.9.2]: https://github.com/OpenCena/opencena/releases/tag/v0.9.2
[0.9.1]: https://github.com/OpenCena/opencena/releases/tag/v0.9.1
[0.9.0]: https://github.com/OpenCena/opencena/releases/tag/v0.9.0
