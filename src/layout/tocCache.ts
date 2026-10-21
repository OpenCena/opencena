// Sumário (capítulo -> página) calculado pelo editor, reaproveitado pela aba
// Capa para não repaginar o livro inteiro só para desenhar o sumário.
import type { ScreenplayElement } from "@/types";

export interface TocEntry {
  titulo: string;
  pagina: number;
}

export const tocCache: { src: ScreenplayElement[] | null; entries: TocEntry[] } = {
  src: null,
  entries: [],
};
