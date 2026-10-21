import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./fonts";
import "./styles/global.css";
import { isNative } from "@/storage/dir";

// No app instalado, o menu do clique direito só aparece em campos de texto (copiar, colar).
if (isNative) {
  document.addEventListener("contextmenu", (e) => {
    const alvo = e.target as HTMLElement | null;
    if (!alvo?.closest?.('input, textarea, [contenteditable="true"]')) e.preventDefault();
  });
}

// só no modo de desenvolvimento: ?demo=claro|escuro abre um projeto de exemplo
// (usado por scripts/capturas.mjs para gerar as imagens do site)
if (import.meta.env.DEV) void import("./devSeed");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
