// Só no modo de desenvolvimento (npm run dev): expõe o store para testes no console e
// cria projetos de exemplo numa pasta do navegador (OPFS), usados por
// scripts/capturas.mjs para gerar as imagens do site.
//
//   ?demo=claro|escuro              tema
//   &aba=editor|escaleta|pesquisa|personagens|quadrinhos|novel
//
// O texto do exemplo segue o idioma da interface (pt-BR ou en).
import { useApp } from "@/store/appStore";
import { saveHandle } from "@/storage/handles";
import { webDir } from "@/storage/dir";
import { uiLang } from "@/i18n";
import type { Character, ProjectType, ScreenplayElement } from "@/types";

async function seed(tipo: ProjectType = "roteiro", nome?: string) {
  const opfs = await navigator.storage.getDirectory();
  await saveHandle("handle:__projects_folder__", webDir(opfs));
  useApp.setState({ projectsFolderSet: true });
  await useApp.getState().createNewProject({ nome: nome ?? `Teste ${tipo} ${Date.now() % 10000}`, autor: "", tipo, formato: "filme" });
}

(window as unknown as Record<string, unknown>).__app = useApp;
(window as unknown as Record<string, unknown>).__seed = seed;

const id = () => crypto.randomUUID();
const el = (tipo: string, texto: string) => ({ id: id(), tipo, texto }) as ScreenplayElement;
const en = uiLang() !== "pt-BR";
const L = (pt: string, ing: string) => (en ? ing : pt);

function personagem(nome: string, p: Partial<Character> = {}): Character {
  return {
    id: id(), nome, nomeCompleto: "", idade: "", descricao: "", aparencia: "", personalidade: "",
    historia: "", objetivos: "", medos: "", conflitos: "", arco: "", relacoes: [], ...p,
  };
}

const ROTEIRO = () => [
  el("cabecalho", L("INT. ESTAÇÃO VAZIA - NOITE", "INT. EMPTY STATION - NIGHT")),
  el("acao", L("A última lâmpada pisca. LIA (30) segura uma carta dobrada, já amassada nas bordas. O relógio da plataforma marca 23h58.", "The last bulb flickers. LIA (30) holds a folded letter, worn at the edges. The platform clock reads 11:58 PM.")),
  el("personagem", "LIA"),
  el("dialogo", L("Você disse que estaria aqui antes do último trem.", "You said you'd be here before the last train.")),
  el("acao", L("Ao longe, um alto-falante chia. Nenhuma resposta.", "Far off, a loudspeaker crackles. No answer.")),
  el("personagem", L("VOZ (O.S.)", "VOICE (O.S.)")),
  el("dialogo", L("Algumas histórias não terminam quando alguém vai embora.", "Some stories don't end when someone leaves.")),
  el("acao", L("Lia vira a carta. No verso, uma data escrita à mão: amanhã.", "Lia turns the letter over. On the back, a handwritten date: tomorrow.")),
  el("transicao", L("CORTA PARA:", "CUT TO:")),
  el("cabecalho", L("EXT. PLATAFORMA - CONTÍNUO", "EXT. PLATFORM - CONTINUOUS")),
  el("acao", L("Um trem sem luzes desliza devagar. As portas se abrem. Ninguém desce.", "A dark train glides in slowly. The doors open. No one gets off.")),
  el("personagem", "TÉO"),
  el("parentese", L("(de dentro do vagão)", "(from inside the car)")),
  el("dialogo", L("Você veio. Eu sabia que vinha.", "You came. I knew you would.")),
  el("personagem", "LIA"),
  el("dialogo", L("Eu não sabia.", "I didn't.")),
  el("cabecalho", L("INT. VAGÃO - NOITE", "INT. TRAIN CAR - NIGHT")),
  el("acao", L("Bancos vazios. Uma mala antiga no bagageiro, com as iniciais D.C.", "Empty seats. An old suitcase on the rack, with the initials D.C.")),
  el("cabecalho", L("INT. CASA DE DONA CIDA - DIA", "INT. DONA CIDA'S HOUSE - DAY")),
  el("acao", L("A cozinha cheira a café. DONA CIDA (70) abre a carta com uma faca de pão.", "The kitchen smells of coffee. DONA CIDA (70) opens the letter with a bread knife.")),
];

const QUADRINHOS = () => [
  el("pagina", L("splash", "splash")),
  el("quadro", L("plano geral", "wide shot")),
  el("descricao", L("Uma cidade vertical sob chuva. Pontes de corda ligam os prédios. No alto, uma menina de capa amarela corre pela borda de um telhado.", "A vertical city in the rain. Rope bridges link the towers. Up high, a girl in a yellow cloak runs along the edge of a roof.")),
  el("legenda", L("Distrito 9. Ninguém sobe tão alto.", "District 9. Nobody climbs this high.")),
  el("quadro", L("close", "close-up")),
  el("descricao", L("O rosto de NARA, molhado, sorrindo.", "NARA's face, soaked, smiling.")),
  el("personagem", "NARA"),
  el("balao", L("Quase lá!", "Almost there!")),
  el("sfx", "KRA-KOOM"),
  el("pagina", ""),
  el("quadro", ""),
  el("descricao", L("Um raio ilumina a torre do relógio. Há alguém lá dentro.", "Lightning lights up the clock tower. Someone is inside.")),
  el("personagem", "NARA"),
  el("balao", L("Quem é você?", "Who are you?")),
];

const NOVEL = () => [
  el("capitulo", L("Capítulo 1: A casa do farol", "Chapter 1: The lighthouse house")),
  el("paragrafo", L("A casa ficava no fim da estrada de terra, onde o mapa já não tinha nome. Marta chegou com uma mala e uma chave que não sabia se ainda servia.", "The house stood at the end of the dirt road, where the map no longer had names. Marta arrived with one suitcase and a key she wasn't sure still worked.")),
  el("paragrafo", L("O vento trazia sal e um barulho de madeira velha. Ela girou a chave. A porta cedeu como quem se lembra de alguém.", "The wind carried salt and the creak of old wood. She turned the key. The door gave way like someone remembering a face.")),
  el("paragrafo", L("Lá dentro, tudo estava coberto por lençóis brancos, menos um retrato na parede: uma mulher de olhos parecidos com os dela, segurando a mesma chave.", "Inside, everything lay under white sheets, except for a portrait on the wall: a woman with eyes like hers, holding the same key.")),
  el("separador", ""),
  el("paragrafo", L("Naquela noite, o farol acendeu sozinho.", "That night, the lighthouse lit itself.")),
  el("capitulo", L("Capítulo 2: O diário", "Chapter 2: The diary")),
  el("paragrafo", L("O diário estava escondido sob a escada, embrulhado num pano de prato.", "The diary was hidden under the stairs, wrapped in a tea towel.")),
];

async function demoProjeto(aba: string) {
  const st = useApp.getState;
  if (aba === "quadrinhos") {
    await seed("quadrinhos", L("Telhados", "Rooftops"));
    st().updateScreenplay({ ...st().current!.project.screenplay, elementos: QUADRINHOS() });
    st().updateCharacters([personagem("NARA")]);
    return "editor" as const;
  }
  if (aba === "novel") {
    await seed("novel", L("A casa do farol", "The Lighthouse House"));
    st().updateScreenplay({ ...st().current!.project.screenplay, elementos: NOVEL() });
    return "editor" as const;
  }

  await seed("roteiro", L("A última estação", "The Last Station"));
  const lia = personagem("LIA", {
    nomeCompleto: "Lia Moraes",
    idade: "30",
    papel: L("Protagonista", "Protagonist"),
    descricao: L("Restauradora de relógios. Guarda tudo, até o que já não funciona.", "Clock restorer. Keeps everything, even what no longer works."),
    personalidade: L("Calada, teimosa, observa antes de falar.", "Quiet, stubborn, watches before she speaks."),
    objetivos: L("Descobrir quem mandou a carta.", "Find out who sent the letter."),
    medos: L("Chegar tarde de novo.", "Being late again."),
    arco: L("Aprende a deixar a porta aberta para o que não controla.", "Learns to leave the door open to what she can't control."),
  });
  const teo = personagem("TÉO", { idade: "32", papel: L("Coadjuvante", "Supporting"), descricao: L("Maquinista do último trem.", "Driver of the last train.") });
  const cida = personagem("DONA CIDA", { idade: "70", papel: L("Coadjuvante", "Supporting"), descricao: L("A vizinha que sabe demais.", "The neighbor who knows too much.") });
  lia.relacoes = [{ personagemId: teo.id, tipo: L("antigo amor", "old flame") }, { personagemId: cida.id, tipo: L("vizinha", "neighbor") }];
  st().updateCharacters([lia, teo, cida]);
  const elementos = ROTEIRO();
  st().updateScreenplay({ ...st().current!.project.screenplay, elementos });

  // escaleta: atos, tramas e cartões ligados às cenas
  const cenas = elementos.filter((e) => e.tipo === "cabecalho");
  const a1 = { id: id(), titulo: L("Ato 1: apresentação", "Act 1: setup") };
  const a2 = { id: id(), titulo: L("Ato 2: confronto", "Act 2: confrontation") };
  const a3 = { id: id(), titulo: L("Ato 3: resolução", "Act 3: resolution") };
  const tA = { id: id(), nome: L("A carta", "The letter"), cor: "#4f7fc7" };
  const tB = { id: id(), nome: L("Lia e Téo", "Lia and Téo"), cor: "#d0574f" };
  const c = (p: Record<string, unknown>) => ({
    id: id(), numero: 0, cabecalho: "", resumo: "", objetivo: "", conflito: "", observacoes: "", personagemIds: [], tipo: "cena", ...p,
  });
  const cartoes = [
    c({ atoId: a1.id, cabecalho: cenas[0].texto, elementoId: cenas[0].id, resumo: L("Lia espera na estação com a carta.", "Lia waits at the station with the letter."), status: "pronto", tramaId: tA.id, personagemIds: [lia.id], etiquetas: [L("abertura", "opening")] }),
    c({ atoId: a1.id, cabecalho: cenas[1].texto, elementoId: cenas[1].id, resumo: L("O trem chega. Téo aparece.", "The train arrives. Téo appears."), status: "pronto", tramaId: tB.id, personagemIds: [lia.id, teo.id] }),
    c({ atoId: a2.id, cabecalho: cenas[2].texto, elementoId: cenas[2].id, resumo: L("A mala com as iniciais D.C.", "The suitcase with the initials D.C."), status: "escrevendo", tramaId: tA.id, etiquetas: [L("pista", "clue")] }),
    c({ atoId: a2.id, cabecalho: cenas[3].texto, elementoId: cenas[3].id, resumo: L("Dona Cida lê a carta e reconhece a letra.", "Dona Cida reads the letter and knows the handwriting."), status: "afazer", tramaId: tA.id, personagemIds: [cida.id] }),
    c({ atoId: a2.id, cabecalho: L("EXT. PRAIA - AMANHECER", "EXT. BEACH - DAWN"), resumo: L("Lia e Téo discutem o passado.", "Lia and Téo argue about the past."), status: "afazer", tramaId: tB.id, personagemIds: [lia.id, teo.id] }),
    c({ atoId: a3.id, cabecalho: L("INT. ESTAÇÃO - NOITE", "INT. STATION - NIGHT"), resumo: L("O último trem, de novo. Desta vez ela embarca.", "The last train, again. This time she gets on."), status: "afazer", tramaId: tB.id, etiquetas: [L("clímax", "climax")] }),
  ].map((x, i) => ({ ...x, numero: i + 1 }));
  st().updateOutline({ atos: [a1, a2, a3], cartoes, tramas: [tA, tB] } as never);

  // pesquisa: pastas, quadro com notas e ligações, páginas
  const p = st().current!.project.pesquisa;
  const quadro = p.nos[0];
  const n = (x: number, y: number, texto: string, cor: string, w = 220, h = 130) => ({ id: id(), tipo: "nota" as const, x, y, w, h, texto, cor });
  const notas = [
    n(60, 60, L("E se a carta for da própria Lia, escrita no futuro?", "What if the letter is from Lia herself, written in the future?"), "amarelo", 240, 120),
    n(360, 40, L("Estações de trem dos anos 70: azulejo verde, relógio redondo, bancos de madeira.", "1970s train stations: green tiles, round clock, wooden benches."), "verde", 250, 130),
    n(380, 230, L("Téo nunca tirou o uniforme. Por quê?", "Téo never took off the uniform. Why?"), "rosa"),
    n(80, 250, L("Tema: chegar tarde também é chegar.", "Theme: arriving late is still arriving."), "lilas", 230, 110),
    { id: id(), tipo: "texto" as const, x: 680, y: 60, w: 260, h: 60, texto: L("Mundo e regras", "World and rules") },
    n(680, 140, L("O último trem passa sempre às 23h58. Ninguém sabe de onde vem.", "The last train always comes at 11:58 PM. No one knows where from."), "azul", 260, 130),
  ];
  const ligacoes = [
    { id: id(), de: notas[0].id, para: notas[2].id },
    { id: id(), de: notas[3].id, para: notas[0].id },
  ];
  const pasta = { id: id(), tipo: "pasta" as const, titulo: L("Personagens", "Characters"), paiId: null, criadoEm: new Date().toISOString() };
  const pagina = (titulo: string, paiId: string | null, texto: string) => ({
    id: id(), tipo: "pagina" as const, titulo, paiId, criadoEm: new Date().toISOString(),
    doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: texto }] }] },
  });
  st().updatePesquisa({
    nos: [
      { ...quadro, titulo: L("Ideias soltas", "Loose ideas"), quadro: { ...quadro.quadro!, itens: notas, ligacoes } },
      pasta,
      pagina("Lia", pasta.id, L("Restaura relógios na loja do pai.", "Restores clocks in her father's shop.")),
      pagina("Téo", pasta.id, L("Maquinista. Fala pouco.", "Train driver. Says little.")),
      pagina(L("Linha do tempo", "Timeline"), null, L("1979: a estação fecha. 2009: a carta é escrita.", "1979: the station closes. 2009: the letter is written.")),
    ],
  });

  if (aba === "escaleta") return "escaleta" as const;
  if (aba === "pesquisa") return "pesquisa" as const;
  if (aba === "personagens") return "personagens" as const;
  return "editor" as const;
}

const q = new URLSearchParams(location.search);
const demo = q.get("demo");
if (demo) {
  const espera = setInterval(async () => {
    if (!useApp.getState().ready) return;
    clearInterval(espera);
    useApp.getState().setTheme(demo === "escuro" ? "dark" : "light");
    const aba = await demoProjeto(q.get("aba") ?? "editor");
    setTimeout(() => useApp.getState().setWorkspaceTab(aba), 300);
  }, 100);
}
