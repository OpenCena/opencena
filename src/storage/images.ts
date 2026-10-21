// Imagens e anexos do projeto (pasta anexos/).

import { useEffect, useState } from "react";
import type { ProjectDir } from "./dir";
import { readBlob, writeBlob } from "./fs";

const blobs = new Map<string, Blob>();
const urls = new Map<string, string>();

function extFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

/** Grava a imagem em anexos/ e devolve o caminho relativo. */
export async function saveProjectImage(
  root: ProjectDir | null,
  file: Blob,
  prefix = "capa"
): Promise<string> {
  const name = `${prefix}-${Date.now()}.${extFor(file.type)}`;
  const arquivo = `anexos/${name}`;
  blobs.set(arquivo, file);
  if (root) await writeBlob(root, ["anexos", name], file);
  return arquivo;
}

export async function loadProjectImage(
  root: ProjectDir | null,
  arquivo: string
): Promise<Blob | null> {
  const cached = blobs.get(arquivo);
  if (cached) return cached;
  if (!root) return null;
  const b = await readBlob(root, arquivo.split("/"));
  if (!b) return null;
  blobs.set(arquivo, b);
  return b;
}

/** URL para exibir a imagem (carrega do disco na primeira vez). */
export function useProjectImageUrl(root: ProjectDir | null, arquivo?: string): string | null {
  const [url, setUrl] = useState<string | null>(arquivo ? urls.get(arquivo) ?? null : null);
  useEffect(() => {
    if (!arquivo) {
      setUrl(null);
      return;
    }
    const cached = urls.get(arquivo);
    if (cached) {
      setUrl(cached);
      return;
    }
    let alive = true;
    void loadProjectImage(root, arquivo).then((b) => {
      if (!alive || !b) return;
      const u = URL.createObjectURL(b);
      urls.set(arquivo, u);
      setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [root, arquivo]);
  return url;
}

/** Decodifica a imagem para desenhar em canvas. */
export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  return await createImageBitmap(blob);
}

/** Guarda um arquivo qualquer (referência de pesquisa) em anexos/referencias/. */
export async function saveProjectAttachment(
  root: ProjectDir | null,
  file: File
): Promise<{ arquivo: string; nome: string }> {
  const r = startAttachment(root, file);
  await r.gravado;
  return { arquivo: r.arquivo, nome: r.nome };
}

// anexos instantâneos: o arquivo aparece na hora e grava em segundo plano
const gravando = new Set<string>();
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

/**
 * Registra o anexo na memória (já dá para exibir) e começa a gravar no disco.
 * Devolve o caminho e uma promessa que termina quando a gravação acaba.
 */
export function startAttachment(
  root: ProjectDir | null,
  file: File,
  nomeSugerido?: string
): { arquivo: string; nome: string; gravado: Promise<void> } {
  const nome = nomeSugerido ?? file.name;
  const limpo = nome.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, " ").trim() || "arquivo";
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${limpo}`;
  const arquivo = `anexos/referencias/${name}`;
  blobs.set(arquivo, file);
  if (file.type.startsWith("image/")) urls.set(arquivo, URL.createObjectURL(file));
  if (!root) return { arquivo, nome, gravado: Promise.resolve() };
  gravando.add(arquivo);
  avisar();
  const gravado = writeBlob(root, ["anexos", "referencias", name], file).finally(() => {
    gravando.delete(arquivo);
    avisar();
  });
  return { arquivo, nome, gravado };
}

/** O anexo ainda está sendo gravado no disco? */
export function useAttachmentSaving(arquivo?: string): boolean {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    ouvintes.add(f);
    return () => {
      ouvintes.delete(f);
    };
  }, []);
  return !!arquivo && gravando.has(arquivo);
}

/** Tamanho do anexo em memória (se já foi lido), para mostrar no cartão do arquivo. */
export function attachmentSize(arquivo?: string): number | null {
  return arquivo ? blobs.get(arquivo)?.size ?? null : null;
}
