// Atualização automática do app instalado (Tauri).

import { useEffect } from "react";
import { create } from "zustand";
import { isNative } from "@/storage/dir";
import { Icon } from "@/components/Icon";
import { useApp } from "@/store/appStore";
import { tt } from "@/i18n";

type Estado =
  | { fase: "parado" }
  | { fase: "procurando" }
  | { fase: "atualizado" }
  | { fase: "disponivel"; versao: string; notas?: string }
  | { fase: "baixando"; progresso: number }
  | { fase: "pronto" }
  | { fase: "erro"; msg: string };

type Update = Awaited<ReturnType<typeof import("@tauri-apps/plugin-updater").check>>;

export const useUpdater = create<{ estado: Estado; fechado: boolean; update: Update | null }>(() => ({
  estado: { fase: "parado" },
  fechado: false,
  update: null,
}));

/** Procura uma versão nova. `manual` mostra também "já está atualizado" e erros. */
export async function procurarAtualizacao(manual = false): Promise<void> {
  if (!isNative) {
    if (manual) useUpdater.setState({ estado: { fase: "atualizado" } });
    return;
  }
  useUpdater.setState({ estado: { fase: "procurando" }, fechado: false });
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (update) useUpdater.setState({ update, estado: { fase: "disponivel", versao: update.version, notas: update.body ?? undefined } });
    else useUpdater.setState({ estado: { fase: manual ? "atualizado" : "parado" } });
  } catch (err) {
    useUpdater.setState({ estado: manual ? { fase: "erro", msg: err instanceof Error ? err.message : String(err) } : { fase: "parado" } });
  }
}

export async function instalarAtualizacao(): Promise<void> {
  const update = useUpdater.getState().update;
  if (!update) return;
  // grava o que estiver pendente antes de reiniciar
  const { flushPendingSaves } = await import("@/store/appStore");
  await flushPendingSaves();
  let total = 0;
  let baixado = 0;
  try {
    await update.downloadAndInstall((ev) => {
      if (ev.event === "Started") total = ev.data.contentLength ?? 0;
      else if (ev.event === "Progress") {
        baixado += ev.data.chunkLength;
        useUpdater.setState({ estado: { fase: "baixando", progresso: total ? baixado / total : 0 } });
      } else if (ev.event === "Finished") useUpdater.setState({ estado: { fase: "pronto" } });
    });
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (err) {
    useUpdater.setState({ estado: { fase: "erro", msg: err instanceof Error ? err.message : String(err) } });
  }
}

/** Aviso no canto quando há uma versão nova (só no app instalado). */
export function UpdateBanner() {
  const { estado, fechado } = useUpdater();
  const auto = useApp((s) => s.prefs.atualizar !== false);

  useEffect(() => {
    if (!isNative || !auto) return;
    // procura um pouco depois de abrir, para não pesar a abertura
    const t = setTimeout(() => void procurarAtualizacao(), 4000);
    return () => clearTimeout(t);
  }, [auto]);

  if (fechado || !["disponivel", "baixando", "pronto"].includes(estado.fase)) return null;
  return (
    <div className="upd" role="status">
      <Icon name="refresh" size={16} />
      <div className="upd-text">
        {estado.fase === "disponivel" && (
          <>
            <b>{tt("Versão")} {estado.versao} {tt("disponível")}</b>
            <span>{tt("Seus projetos não são afetados. O app reinicia no fim.")}</span>
          </>
        )}
        {estado.fase === "baixando" && (
          <>
            <b>{tt("Baixando a atualização…")}</b>
            <span className="upd-bar">
              <span style={{ width: `${Math.round(estado.progresso * 100)}%` }} />
            </span>
          </>
        )}
        {estado.fase === "pronto" && <b>{tt("Instalando e reiniciando…")}</b>}
      </div>
      {estado.fase === "disponivel" && (
        <>
          <button className="btn btn-primary" onClick={() => void instalarAtualizacao()}>
            {tt("Atualizar e reiniciar")}
          </button>
          <button className="btn btn-ghost" onClick={() => useUpdater.setState({ fechado: true })}>
            {tt("Depois")}
          </button>
        </>
      )}
    </div>
  );
}

/** Bloco da tela Sobre e licença: versão e "Procurar atualizações". */
export function UpdateCheck() {
  const { estado } = useUpdater();
  if (!isNative) return <p className="about-p">{tt("No navegador o OpenCena está sempre na versão mais nova.")}</p>;
  return (
    <div className="upd-check">
      <button className="btn" onClick={() => void procurarAtualizacao(true)} disabled={estado.fase === "procurando" || estado.fase === "baixando"}>
        <Icon name="refresh" size={14} />
        {estado.fase === "procurando" ? tt("Procurando…") : tt("Procurar atualizações")}
      </button>
      {estado.fase === "atualizado" && <span className="muted">{tt("Você já está na versão mais nova.")}</span>}
      {estado.fase === "disponivel" && (
        <button className="btn btn-primary" onClick={() => void instalarAtualizacao()}>
          {tt("Atualizar para {versao}", { versao: estado.versao })}
        </button>
      )}
      {estado.fase === "erro" && <span className="muted">{tt("Não foi possível procurar agora ({erro}).", { erro: estado.msg })}</span>}
    </div>
  );
}
