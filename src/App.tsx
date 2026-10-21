import { useEffect } from "react";
import { useApp } from "@/store/appStore";
import { DialogHost } from "@/components/Dialogs";
import { UpdateBanner } from "@/components/Updater";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isNative } from "@/storage/dir";
import { runBeforeClose } from "@/utils/lifecycle";
import { useTheme } from "@/hooks/useTheme";
import { Icon } from "@/components/Icon";
import { Onboarding } from "@/views/Onboarding";
import { Home } from "@/views/Home";
import { Workspace } from "@/views/Workspace";
import { tt } from "@/i18n";

export default function App() {
  const ready = useApp((s) => s.ready);
  const init = useApp((s) => s.init);
  const theme = useApp((s) => s.theme);
  const projectsFolderSet = useApp((s) => s.projectsFolderSet);
  const current = useApp((s) => s.current);
  const error = useApp((s) => s.error);
  const setError = useApp((s) => s.setError);
  const notice = useApp((s) => s.notice);
  const setNotice = useApp((s) => s.setNotice);

  useTheme(theme);

  useEffect(() => {
    void init();
  }, [init]);

  // Fechar a janela/aba grava o que ainda não foi salvo.
  useEffect(() => {
    if (isNative) {
      const unlisten = getCurrentWindow().onCloseRequested(async () => {
        await runBeforeClose();
      });
      return () => {
        void unlisten.then((f) => f());
      };
    }
    // no navegador só grava (sem o aviso nativo "Sair do site?")
    function onUnload() {
      void runBeforeClose();
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  // Toast de erro some sozinho depois de alguns segundos.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 7000);
    return () => clearTimeout(t);
  }, [error, setError]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  if (!ready) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
        <span className="muted">{tt("Carregando…")}</span>
      </div>
    );
  }

  let screen;
  if (current) {
    screen = <Workspace />;
  } else if (!projectsFolderSet) {
    screen = <Onboarding />;
  } else {
    screen = <Home />;
  }

  return (
    <>
      {error && (
        <div
          style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            maxWidth: 560,
            width: "calc(100% - 24px)",
          }}
        >
          <div className="error-banner" role="alert">
            <span className="toast-ico">
              <Icon name="alert" size={17} />
            </span>
            <span className="toast-msg">{error}</span>
            <button
              className="btn-ghost"
              style={{ border: "none", padding: 4, display: "inline-flex", color: "var(--text-muted)" }}
              onClick={() => setError(null)}
              aria-label={tt("Fechar")}
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          <span className="toast-ico">
            <Icon name="check" size={16} />
          </span>
          <span className="toast-msg">{notice}</span>
          <button className="notice-x" onClick={() => setNotice(null)} aria-label={tt("Fechar")}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
      {screen}
      <DialogHost />
      <UpdateBanner />
    </>
  );
}
