// Gera as capturas de tela do site (<pasta>/<idioma>/<nome>.webp) abrindo o
// app num Chrome sem janela, via Chrome DevTools Protocol. Os projetos de
// exemplo vêm de src/devSeed.ts (?demo=...&aba=...).
//
//   1. npm run dev                       (deixe rodando)
//   2. node scripts/capturas.mjs http://localhost:3000 [pasta das imagens, padrão site/img]
//
// No Mac/Linux, aponte a variável CHROME para o executável do Chrome.
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const destino = (process.argv[3] ?? "site/img").replace(/[\\/]$/, "");
const PERFIL = resolve(".capturas/perfil");
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const CAPTURAS = [
  { nome: "app-claro", demo: "claro", aba: "editor" },
  { nome: "app-escuro", demo: "escuro", aba: "editor" },
  { nome: "escaleta", demo: "claro", aba: "escaleta" },
  { nome: "pesquisa", demo: "claro", aba: "pesquisa" },
  { nome: "personagens", demo: "claro", aba: "personagens" },
  { nome: "quadrinhos", demo: "claro", aba: "quadrinhos" },
  { nome: "novel", demo: "claro", aba: "novel" },
];
const IDIOMAS = ["pt-BR", "en"];

rmSync(PERFIL, { recursive: true, force: true });
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${PERFIL}`,
  "--window-size=1440,900",
  "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
for (let i = 0; i < 150 && !ws; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const page = list.find((p) => p.type === "page");
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch {
    /* o Chrome ainda está abrindo */
  }
  await sleep(200);
}
if (ws.readyState !== WebSocket.OPEN) await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) {
    pend.get(d.id)(d.result);
    pend.delete(d.id);
  }
};
const send = (method, params = {}) =>
  new Promise((r) => {
    id += 1;
    pend.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1.5, mobile: false });
await send("Page.enable");
// o idioma vem do parâmetro ?lang= e é gravado antes de o app carregar
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `{ const l = new URLSearchParams(location.search).get("lang"); if (l) localStorage.setItem("opencena:idioma", l); }`,
});

for (const lang of IDIOMAS) {
  const pasta = `${destino}/${lang === "pt-BR" ? "pt" : lang}`;
  mkdirSync(pasta, { recursive: true });
  for (const c of CAPTURAS) {
    await send("Page.navigate", { url: `${base}/?lang=${lang}&demo=${c.demo}&aba=${c.aba}` });
    await sleep(7000);
    const shot = await send("Page.captureScreenshot", { format: "webp", quality: 88 });
    const out = `${pasta}/${c.nome}.webp`;
    writeFileSync(out, Buffer.from(shot.data, "base64"));
    console.log("ok", out);
  }
}

ws.close();
chrome.kill();
process.exit(0);
