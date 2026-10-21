// Pasta do projeto, independente de onde o app roda.

import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { mkdir, remove, writeFile } from "@tauri-apps/plugin-fs";
import { downloadDir, tempDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { tt } from "@/i18n";

export interface WebDir {
  kind: "web";
  name: string;
  handle: FileSystemDirectoryHandle;
}

export interface NativeDir {
  kind: "native";
  name: string;
  path: string;
}

export type ProjectDir = WebDir | NativeDir;

/** Rodando dentro do app instalado (Tauri)? */
export const isNative = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Este ambiente consegue escolher e gravar pastas? */
export function canUseFolders(): boolean {
  return isNative || typeof window.showDirectoryPicker === "function";
}

export function joinPath(base: string, ...parts: string[]): string {
  const sep = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  return [base.replace(/[\\/]+$/, ""), ...parts].join(sep);
}

function baseName(path: string): string {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
}

export function webDir(handle: FileSystemDirectoryHandle): WebDir {
  return { kind: "web", name: handle.name, handle };
}

export function nativeDir(path: string): NativeDir {
  return { kind: "native", name: baseName(path), path };
}

/** Abre o seletor de pasta do sistema. null = a pessoa cancelou. */
export async function pickDirectory(title = tt("Escolher pasta")): Promise<ProjectDir | null> {
  if (isNative) {
    const p = await openDialog({ directory: true, multiple: false, title });
    return typeof p === "string" ? nativeDir(p) : null;
  }
  if (!window.showDirectoryPicker) {
    throw new Error(tt("Este navegador não grava pastas. Use Chrome, Edge, Brave ou Opera, ou o app instalado."));
  }
  try {
    return webDir(await window.showDirectoryPicker({ mode: "readwrite" }));
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}

/** Subpasta `name` dentro de `parent` (criando se pedido). */
export async function childDir(parent: ProjectDir, name: string, create = true): Promise<ProjectDir> {
  if (parent.kind === "native") {
    const path = joinPath(parent.path, name);
    if (create) await mkdir(path, { recursive: true });
    return nativeDir(path);
  }
  return webDir(await parent.handle.getDirectoryHandle(name, { create }));
}

/** Mesma pasta? */
export async function sameDir(a: ProjectDir, b: ProjectDir): Promise<boolean> {
  if (a.kind === "native" && b.kind === "native") {
    const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    return norm(a.path) === norm(b.path);
  }
  if (a.kind === "web" && b.kind === "web") return a.handle.isSameEntry(b.handle);
  return false;
}

/** Apaga a subpasta `name` de `parent`, com tudo dentro. */
export async function removeChildDir(parent: ProjectDir, name: string): Promise<void> {
  if (parent.kind === "native") {
    await remove(joinPath(parent.path, name), { recursive: true });
    return;
  }
  await parent.handle.removeEntry(name, { recursive: true });
}

// arquivos para fora do projeto (exportação)
async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Entrega um arquivo para a pasta Downloads. No navegador é o download normal;
 * no app instalado o arquivo é gravado direto em Downloads.
 * Devolve onde o arquivo foi parar (para o aviso).
 */
export async function saveToDownloads(filename: string, blob: Blob): Promise<string> {
  if (isNative) {
    const path = joinPath(await downloadDir(), filename);
    await writeFile(path, await blobBytes(blob));
    return path;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "Downloads";
}

/** Abre o arquivo no programa padrão do sistema (ex.: leitor de PDF, para imprimir). */
export async function openWithSystem(filename: string, blob: Blob, preOpened?: Window | null): Promise<void> {
  if (isNative) {
    const path = joinPath(await tempDir(), filename);
    await writeFile(path, await blobBytes(blob));
    await openPath(path);
    return;
  }
  const url = URL.createObjectURL(blob);
  if (preOpened) preOpened.location.href = url;
  else await saveToDownloads(filename, blob);
}

/** Abre um link no navegador padrão do sistema. */
export async function openLink(url: string): Promise<void> {
  const href = /^[a-z]+:/i.test(url) ? url : `https://${url}`;
  if (isNative) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(href);
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
}
