// Guarda as pastas escolhidas (pasta de projetos e cada projeto) no IndexedDB, para reabrir nas
// próximas vezes.

import { get, set, del, keys } from "idb-keyval";
import { ProjectDir, webDir } from "./dir";

const HANDLE_PREFIX = "handle:";

/** Gera uma chave estável para guardar uma pasta. */
export function makeHandleKey(id: string): string {
  return `${HANDLE_PREFIX}${id}`;
}

export async function saveHandle(key: string, dir: ProjectDir): Promise<void> {
  await set(key, dir);
}

export async function loadHandle(key: string): Promise<ProjectDir | undefined> {
  const v = (await get(key)) as ProjectDir | FileSystemDirectoryHandle | undefined;
  if (!v) return undefined;
  // versões antigas guardavam o handle direto
  if ("kind" in v && (v.kind === "web" || v.kind === "native")) return v as ProjectDir;
  if (typeof (v as FileSystemDirectoryHandle).getDirectoryHandle === "function") {
    return webDir(v as FileSystemDirectoryHandle);
  }
  return undefined;
}

export async function removeHandle(key: string): Promise<void> {
  await del(key);
}

export async function listHandleKeys(): Promise<string[]> {
  const all = (await keys()) as string[];
  return all.filter((k) => typeof k === "string" && k.startsWith(HANDLE_PREFIX));
}

/**
 * Garante que temos permissão de leitura/escrita na pasta.
 * @param prompt se true, pede a permissão (no navegador exige um clique).
 */
export async function ensurePermission(dir: ProjectDir, prompt: boolean): Promise<boolean> {
  if (dir.kind === "native") return true;
  const opts: FileSystemHandlePermissionDescriptor = { mode: "readwrite" };
  const current = (await dir.handle.queryPermission?.(opts)) ?? "granted";
  if (current === "granted") return true;
  if (!prompt) return false;
  const requested = (await dir.handle.requestPermission?.(opts)) ?? "denied";
  return requested === "granted";
}
