// Cria um backup automático em intervalos regulares enquanto um projeto real
// está aberto. Pula o modo de pré-visualização.

import { useEffect } from "react";
import { useApp } from "@/store/appStore";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

export function useAutoBackup(): void {
  const previewMode = useApp((s) => s.previewMode);
  const hasProject = useApp((s) => s.current !== null);
  const createBackup = useApp((s) => s.createBackup);

  useEffect(() => {
    if (previewMode || !hasProject) return;
    const id = setInterval(() => {
      void createBackup();
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [previewMode, hasProject, createBackup]);
}
