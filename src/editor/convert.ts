// Conversão entre o modelo do app (ScreenplayElement[]) e o documento do TipTap.

import type { JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { CommentAnchor, ElementType, ScreenplayElement, TextMark } from "@/types";

const MARK_NAME: Record<TextMark["tipo"], string> = { b: "bold", i: "italic" };
const MARK_TIPO: Record<string, TextMark["tipo"]> = { bold: "b", italic: "i" };

// texto (com \n de Shift+Enter) + marcas + comentários -> nós inline (text + hardBreak)
function textoParaInline(texto: string, marcas?: TextMark[], comentarios?: CommentAnchor[]): JSONContent[] {
  if (!texto) return [];
  const out: JSONContent[] = [];
  // pontos de corte: limites das marcas, dos comentários e quebras de linha
  const cuts = new Set<number>([0, texto.length]);
  for (const m of [...(marcas ?? []), ...(comentarios ?? [])]) {
    cuts.add(Math.max(0, Math.min(texto.length, m.de)));
    cuts.add(Math.max(0, Math.min(texto.length, m.ate)));
  }
  for (let i = 0; i < texto.length; i++) if (texto[i] === "\n") {
    cuts.add(i);
    cuts.add(i + 1);
  }
  const pts = [...cuts].sort((a, b) => a - b);
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k];
    const b = pts[k + 1];
    const piece = texto.slice(a, b);
    if (!piece) continue;
    if (piece === "\n") {
      out.push({ type: "hardBreak" });
      continue;
    }
    const ms: JSONContent["marks"] = [
      ...(marcas ?? []).filter((m) => m.de <= a && m.ate >= b).map((m) => ({ type: MARK_NAME[m.tipo] })),
      ...(comentarios ?? []).filter((c) => c.de <= a && c.ate >= b).map((c) => ({ type: "comentario", attrs: { id: c.id } })),
    ];
    out.push(ms.length ? { type: "text", text: piece, marks: ms } : { type: "text", text: piece });
  }
  return out;
}

export function elementosParaDoc(
  elementos: ScreenplayElement[],
  defaultType: ElementType = "acao"
): JSONContent {
  const linhas = elementos.length ? elementos : [{ id: "", tipo: defaultType, texto: "" }];
  return {
    type: "doc",
    content: linhas.map((el) => ({
      type: "linha",
      attrs: { tipo: el.tipo, id: el.id || null },
      content: textoParaInline(el.texto, (el as ScreenplayElement).marcas, (el as ScreenplayElement).comentarios),
    })),
  };
}

/** Trechos comentados de um nó de bloco (intervalos de caracteres + id). */
function comentariosDoNo(node: PMNode): CommentAnchor[] {
  const out: CommentAnchor[] = [];
  let off = 0;
  node.forEach((child) => {
    const len = child.isText ? child.text?.length ?? 0 : 1;
    if (child.isText) {
      for (const m of child.marks) {
        if (m.type.name !== "comentario") continue;
        const id = m.attrs.id as string;
        const last = [...out].reverse().find((x) => x.id === id);
        if (last && last.ate === off) last.ate = off + len;
        else out.push({ id, de: off, ate: off + len });
      }
    }
    off += len;
  });
  return out;
}

/** Marcas de um nó de bloco como intervalos de caracteres. */
function marcasDoNo(node: PMNode): TextMark[] {
  const out: TextMark[] = [];
  let off = 0;
  node.forEach((child) => {
    const len = child.isText ? child.text?.length ?? 0 : 1;
    if (child.isText) {
      for (const m of child.marks) {
        const tipo = MARK_TIPO[m.type.name];
        if (!tipo) continue;
        const last = out.length ? [...out].reverse().find((x) => x.tipo === tipo) : undefined;
        if (last && last.ate === off) last.ate = off + len; // junta trechos contíguos
        else out.push({ de: off, ate: off + len, tipo });
      }
    }
    off += len;
  });
  return out;
}

// Documento do TipTap -> ScreenplayElement[]. Preserva o id de cada bloco.
export function docParaElementos(doc: PMNode): ScreenplayElement[] {
  const els: ScreenplayElement[] = [];
  doc.forEach((node) => {
    if (node.type.name !== "linha") return;
    let texto = "";
    node.forEach((child) => {
      if (child.isText) texto += child.text ?? "";
      else if (child.type.name === "hardBreak") texto += "\n";
    });
    const el: ScreenplayElement = {
      id: (node.attrs.id as string) || crypto.randomUUID(),
      tipo: node.attrs.tipo as ElementType,
      texto,
    };
    const marcas = marcasDoNo(node);
    if (marcas.length) el.marcas = marcas;
    const comentarios = comentariosDoNo(node);
    if (comentarios.length) el.comentarios = comentarios;
    els.push(el);
  });
  return els;
}

/** Igualdade de conteúdo (tipo, texto e marcas) entre duas listas de elementos. */
export function mesmoConteudo(a: ScreenplayElement[], b: ScreenplayElement[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.tipo !== y.tipo || x.texto !== y.texto) return false;
    const mx = JSON.stringify(x.marcas ?? []);
    const my = JSON.stringify(y.marcas ?? []);
    if (mx !== my) return false;
    if (JSON.stringify(x.comentarios ?? []) !== JSON.stringify(y.comentarios ?? [])) return false;
  }
  return true;
}
