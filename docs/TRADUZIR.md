# Traduzir o OpenCena

O OpenCena está em português (pt-BR), inglês (en) e espanhol (es). Correções e novos idiomas são bem-vindos.

*English summary: the Portuguese text is the translation key. Translations live in `src/i18n/locales/<lang>.json`, one entry per string. Run `node scripts/i18n-chaves.mjs` to see what is missing, fix or add entries, and open a pull request.*

## Como funciona

O texto em português é a própria chave. No código:

```ts
tt("Novo projeto")                       // "New project" em inglês
tt("Excluir \"{nome}\"?", { nome: "Lia" })  // parâmetros entre chaves
tt("HQ|Quadro")                          // contexto: mesma palavra, outro sentido
```

Cada idioma tem um arquivo em `src/i18n/locales/` com pares `"texto em português": "tradução"`. O que não estiver traduzido aparece em português.

Há dois tipos de texto:

- **Interface** (`tt`): botões, menus, avisos. Segue o idioma escolhido em Configurações > Geral (por padrão, o do sistema).
- **Documento** (`tdoc`): marcas que vão para o texto e as exportações, como `(MAIS)`, `(CONT'D)`, `PÁGINA 1`, `QUADRO 1`, "escrito por", "Sumário". Seguem o **idioma do documento** (Configurações > Este projeto), porque um roteiro em inglês precisa de `(MORE)` mesmo com a interface em português.

## Corrigir uma tradução

1. Abra `src/i18n/locales/en.json` (ou `es.json`).
2. Procure o texto em português e troque a tradução.
3. Mantenha os parâmetros `{assim}` exatamente iguais, só mudando a posição se a frase pedir.
4. Abra um pull request. Se preferir, conte no fórum qual texto está errado e qual seria o certo.

## Ver o que falta

```bash
node scripts/i18n-chaves.mjs        # resumo por idioma
node scripts/i18n-chaves.mjs es     # lista o que falta em es.json
node scripts/i18n-chaves.mjs --json # todas as chaves
```

Os testes (`npm test`) também conferem se as traduções têm os mesmos parâmetros do original.

## Novo idioma

1. Crie `src/i18n/locales/<código>.json` (por exemplo `fr.json`) com `{}`.
2. Em `src/i18n/index.ts`, importe o arquivo, acrescente o código em `Lang`, `LANGS`, `DICTS`, `systemLang()` e `locale()`.
3. Acrescente o código na lista de `scripts/i18n-chaves.mjs`.
4. Traduza. Pode mandar o pull request com a tradução parcial: o que faltar aparece em português até alguém completar.

## Convenções

- Sem travessão longo (—) na interface. Use vírgula, dois-pontos ou ponto.
- Frases curtas e diretas, tratando a pessoa por "você" (ou o equivalente informal do idioma).
- Termos de formato seguem o uso da indústria em cada idioma: em inglês, *scene heading*, *parenthetical*, *panel*, *caption*; em espanhol, *encabezado de escena*, *acotación*, *viñeta*, *cartucho*.
- Não traduza nomes de formatos e marcas: Fountain, Markdown, PDF, EPUB, Word, Kindle.
