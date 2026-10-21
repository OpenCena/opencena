// Antes de fechar o app (ou a aba), grava o que estiver pendente.
import { flushPendingSaves } from "@/store/appStore";

const hooks = new Set<() => void | Promise<void>>();

/** Registra algo a fazer antes de fechar; devolve a função para remover. */
export function beforeClose(fn: () => void | Promise<void>): () => void {
  hooks.add(fn);
  return () => {
    hooks.delete(fn);
  };
}

export async function runBeforeClose(): Promise<void> {
  for (const fn of hooks) await fn();
  await flushPendingSaves();
}
