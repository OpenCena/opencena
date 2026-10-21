// Backups / histórico de versões.

import { LoadedProject } from "@/types";
import type { ProjectDir } from "@/storage/dir";
import { listFiles, readJSON, removeFile, writeJSON } from "@/storage/fs";
import { tt } from "@/i18n";

const DIR = ["backups"];
const KEEP = 60;

export type BackupKind = "auto" | "manual" | "restaurar" | "importar" | "abrir";

export const BACKUP_KIND_LABEL: Record<BackupKind, string> = {
  auto: tt("automático"),
  manual: tt("manual"),
  restaurar: tt("antes de restaurar"),
  importar: tt("antes de importar"),
  abrir: tt("ao abrir"),
};

export interface BackupSnapshot {
  criadoEm: string;
  /** Parte (episódio/capítulo) cujo documento está no snapshot. */
  episodioId?: string | null;
  project: LoadedProject;
}

export interface BackupInfo {
  name: string; // nome do arquivo
  criadoEm: string; // ISO
  tipo: BackupKind;
  episodioId: string | null;
}

export function backupName(ms: number, tipo: BackupKind, ep: string | null): string {
  return `bkp-${ms}-${tipo}${ep ? `-${ep}` : ""}.json`;
}

export function parseBackupName(name: string): Omit<BackupInfo, "criadoEm"> & { ms: number } | null {
  const m = name.match(/^bkp-(\d+)(?:-([a-z]+))?(?:-([\w-]+))?\.json$/);
  if (!m) return null;
  const tipo = (m[2] && m[2] in BACKUP_KIND_LABEL ? m[2] : "auto") as BackupKind;
  return { name, ms: Number(m[1]), tipo, episodioId: m[3] ?? null };
}

/** Assinatura do conteúdo, para não guardar dois backups iguais seguidos. */
export function projectSig(project: LoadedProject): string {
  const s = JSON.stringify(project);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}

/** Cria um novo backup do projeto e poda os antigos. Devolve o nome do arquivo. */
export async function createBackup(
  root: ProjectDir,
  project: LoadedProject,
  tipo: BackupKind = "auto",
  episodioId: string | null = null
): Promise<string> {
  const ms = Date.now();
  const name = backupName(ms, tipo, episodioId);
  const snapshot: BackupSnapshot = { criadoEm: new Date(ms).toISOString(), episodioId, project };
  await writeJSON(root, [...DIR, name], snapshot);
  await prune(root);
  return name;
}

/** Lista os backups, do mais recente ao mais antigo. */
export async function listBackups(root: ProjectDir): Promise<BackupInfo[]> {
  const files = await listFiles(root, DIR);
  return files
    .map(parseBackupName)
    .filter((x): x is NonNullable<ReturnType<typeof parseBackupName>> => x !== null)
    .sort((a, b) => b.ms - a.ms)
    .map(({ ms, ...x }) => ({ ...x, criadoEm: new Date(ms).toISOString() }));
}

/** Lê um backup específico. */
export async function readBackup(root: ProjectDir, name: string): Promise<BackupSnapshot | undefined> {
  return readJSON<BackupSnapshot>(root, [...DIR, name]);
}

/** Remove os backups além do limite KEEP. */
async function prune(root: ProjectDir): Promise<void> {
  const backups = await listBackups(root);
  for (const b of backups.slice(KEEP)) {
    try {
      await removeFile(root, DIR, b.name);
    } catch {
      // ignora falha de remoção individual
    }
  }
}
