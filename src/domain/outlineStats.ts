// Tamanho real de cada seção (cena, página da HQ, capítulo) medido pelo mesmo
// motor do editor e do PDF: páginas (fração) e palavras.

import { LoadedProject } from "@/types";
import { layoutProject } from "@/domain/pdf";
import { kindOf } from "@/layout/profiles";

export interface SectionSize {
  paginas: number;
  palavras: number;
}

export function sectionSizes(project: LoadedProject): Map<string, SectionSize> {
  const kind = kindOf(project.meta);
  const { dl, layout } = layoutProject(project, false);
  // a qual seção pertence cada bloco
  const secaoDoBloco: (string | null)[] = [];
  let atual: string | null = null;
  dl.sources.forEach((s, i) => {
    if (s.tipo === kind.sectionType) atual = s.id;
    secaoDoBloco[i] = atual;
  });
  const out = new Map<string, SectionSize>();
  const pega = (id: string) => {
    let v = out.get(id);
    if (!v) out.set(id, (v = { paginas: 0, palavras: 0 }));
    return v;
  };
  for (const p of dl.pages) {
    for (const seg of p.segs) {
      const id = secaoDoBloco[seg.b];
      if (id) pega(id).paginas += (seg.height + seg.sb) / layout.contentH;
    }
  }
  dl.sources.forEach((s, i) => {
    const id = secaoDoBloco[i];
    if (id && s.texto.trim()) pega(id).palavras += s.texto.trim().split(/\s+/).length;
  });
  return out;
}
