// Utilitários de sistema de arquivos.

import {
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { NativeDir, ProjectDir, WebDir, joinPath } from "./dir";
import { tt } from "@/i18n";

export type { ProjectDir } from "./dir";

const notFound = () => new DOMException(tt("Arquivo ou pasta não encontrado."), "NotFoundError");

function nativePath(root: NativeDir, parts: readonly string[]): string {
  return parts.length ? joinPath(root.path, ...parts) : root.path;
}

// navegador
async function webGetDir(root: WebDir, parts: readonly string[], create: boolean): Promise<FileSystemDirectoryHandle> {
  let dir = root.handle;
  for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
  return dir;
}

async function webWrite(root: WebDir, dirParts: readonly string[], fileName: string, content: string | Blob) {
  const dir = await webGetDir(root, dirParts, true);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(content);
    await writable.close();
  } catch (err) {
    try {
      await writable.abort();
    } catch {
      /* ignora */
    }
    throw err;
  }
}

async function webGetFile(root: WebDir, pathParts: readonly string[]): Promise<File | undefined> {
  try {
    const dir = await webGetDir(root, pathParts.slice(0, -1), false);
    const fh = await dir.getFileHandle(pathParts[pathParts.length - 1], { create: false });
    return await fh.getFile();
  } catch (err) {
    if (err instanceof DOMException && (err.name === "NotFoundError" || err.name === "TypeMismatchError")) return undefined;
    throw err;
  }
}

// nativo
/** Grava num arquivo temporário e troca no fim: um travamento no meio não corrompe o original. */
async function nativeWrite(root: NativeDir, pathParts: readonly string[], content: string | Uint8Array) {
  const dir = nativePath(root, pathParts.slice(0, -1));
  await mkdir(dir, { recursive: true });
  const target = nativePath(root, pathParts);
  const tmp = `${target}.tmp`;
  if (typeof content === "string") await writeTextFile(tmp, content);
  else await writeFile(tmp, content);
  await rename(tmp, target);
}

// API
/** Subpasta (criando se preciso) a partir da raiz. */
export async function getDir(root: ProjectDir, parts: readonly string[], create = false): Promise<ProjectDir> {
  if (root.kind === "native") {
    const path = nativePath(root, parts);
    if (create) await mkdir(path, { recursive: true });
    else if (!(await exists(path))) throw notFound();
    return { kind: "native", name: parts[parts.length - 1] ?? root.name, path };
  }
  const handle = await webGetDir(root, parts, create);
  return { kind: "web", name: handle.name, handle };
}

// Fila de escrita por arquivo: duas gravações no MESMO arquivo nunca se
// sobrepõem (a File System Access API trava/erra com escritas concorrentes).
const writeQueues = new Map<string, Promise<unknown>>();

function queued(key: string, run: () => Promise<void>): Promise<void> {
  const prev = writeQueues.get(key) ?? Promise.resolve();
  const task = prev.catch(() => {}).then(run);
  writeQueues.set(key, task);
  return task.finally(() => {
    if (writeQueues.get(key) === task) writeQueues.delete(key);
  });
}

/**
 * Escreve texto em um arquivo, criando pastas/arquivo se necessário.
 * No navegador, repete uma vez se a API reclamar que o estado em cache mudou
 * (InvalidStateError/InvalidModificationError).
 */
export async function writeText(root: ProjectDir, pathParts: readonly string[], content: string): Promise<void> {
  const key = `${root.kind === "native" ? root.path : root.name}/${pathParts.join("/")}`;
  await queued(key, async () => {
    if (root.kind === "native") return nativeWrite(root, pathParts, content);
    const fileName = pathParts[pathParts.length - 1];
    const dirParts = pathParts.slice(0, -1);
    try {
      await webWrite(root, dirParts, fileName, content);
    } catch (err) {
      const stale =
        err instanceof DOMException && (err.name === "InvalidStateError" || err.name === "InvalidModificationError");
      if (!stale) throw err;
      await new Promise((r) => setTimeout(r, 80));
      await webWrite(root, dirParts, fileName, content);
    }
  });
}

/** Lê texto de um arquivo. Retorna undefined se o arquivo não existir. */
export async function readText(root: ProjectDir, pathParts: readonly string[]): Promise<string | undefined> {
  if (root.kind === "native") {
    const path = nativePath(root, pathParts);
    if (!(await exists(path))) return undefined;
    return await readTextFile(path);
  }
  const file = await webGetFile(root, pathParts);
  return file ? await file.text() : undefined;
}

/** Escreve um objeto como JSON identado. */
export async function writeJSON(root: ProjectDir, pathParts: readonly string[], data: unknown): Promise<void> {
  await writeText(root, pathParts, JSON.stringify(data, null, 2));
}

/** Lê e faz parse de um arquivo JSON. Retorna undefined se não existir. */
export async function readJSON<T>(root: ProjectDir, pathParts: readonly string[]): Promise<T | undefined> {
  const text = await readText(root, pathParts);
  if (text === undefined) return undefined;
  return JSON.parse(text) as T;
}

/** Verifica se um arquivo existe. */
export async function fileExists(root: ProjectDir, pathParts: readonly string[]): Promise<boolean> {
  if (root.kind === "native") return exists(nativePath(root, pathParts));
  return (await webGetFile(root, pathParts)) !== undefined;
}

/** Lista os nomes dos arquivos dentro de uma subpasta (não recursivo). */
export async function listFiles(root: ProjectDir, dirParts: readonly string[]): Promise<string[]> {
  if (root.kind === "native") {
    const path = nativePath(root, dirParts);
    if (!(await exists(path))) return [];
    return (await readDir(path)).filter((e) => e.isFile).map((e) => e.name);
  }
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await webGetDir(root, dirParts, false);
  } catch {
    return [];
  }
  const names: string[] = [];
  for await (const entry of (dir as unknown as {
    values(): AsyncIterable<FileSystemHandle & { kind: string; name: string }>;
  }).values()) {
    if (entry.kind === "file") names.push(entry.name);
  }
  return names;
}

/** Remove um arquivo de uma subpasta. */
export async function removeFile(root: ProjectDir, dirParts: readonly string[], fileName: string): Promise<void> {
  if (root.kind === "native") {
    await remove(nativePath(root, [...dirParts, fileName]));
    return;
  }
  const dir = await webGetDir(root, dirParts, false);
  await dir.removeEntry(fileName);
}

/** Grava um arquivo binário (PDF, DOCX, EPUB, imagem), criando pastas se preciso. */
export async function writeBlob(root: ProjectDir, pathParts: readonly string[], data: Blob): Promise<void> {
  if (root.kind === "native") {
    await nativeWrite(root, pathParts, new Uint8Array(await data.arrayBuffer()));
    return;
  }
  await webWrite(root, pathParts.slice(0, -1), pathParts[pathParts.length - 1], data);
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

/** Lê um arquivo binário. Retorna undefined se não existir. */
export async function readBlob(root: ProjectDir, pathParts: readonly string[]): Promise<Blob | undefined> {
  if (root.kind === "native") {
    const path = nativePath(root, pathParts);
    if (!(await exists(path))) return undefined;
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    return new Blob([await readFile(path)], { type: MIME[ext] ?? "application/octet-stream" });
  }
  return webGetFile(root, pathParts);
}
