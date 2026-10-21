import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

// Quando o Tauri roda o Vite (npm run desktop), ele espera a porta 3000 fixa.
const tauri = !!process.env.TAURI_ENV_PLATFORM;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // não apaga as mensagens de erro do Rust no terminal
  clearScreen: false,
  server: {
    port: 3000,
    strictPort: tauri,
    // o código do Rust não deve recarregar a página
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  // versão do app (do package.json) disponível no código
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
