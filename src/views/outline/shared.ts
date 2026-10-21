import { Character, CardStatus, Outline, OutlineAct, OutlineCard, ScreenplayElement, Trama } from "@/types";
import type { KindDef } from "@/layout/profiles";
import type { PlantWarning, SectionInfo } from "@/domain/outline";
import type { SectionSize } from "@/domain/outlineStats";
import type { ProjectDir } from "@/storage/fs";
import { tt, locale } from "@/i18n";

export const STATUS: { id: CardStatus; label: string }[] = [
  { id: "afazer", label: tt("A fazer") },
  { id: "escrevendo", label: tt("Escrevendo") },
  { id: "pronto", label: tt("Pronto") },
];

export const nextStatus = (s?: CardStatus): CardStatus =>
  STATUS[(STATUS.findIndex((x) => x.id === (s ?? "afazer")) + 1) % STATUS.length].id;

export const UNASSIGNED = "__none__";

/** Tudo o que as vistas da escaleta precisam (montado em OutlineTab). */
export interface OutlineCtx {
  kind: KindDef;
  outline: Outline;
  cartoes: OutlineCard[];
  atos: OutlineAct[];
  tramas: Trama[];
  characters: Character[];
  elementos: ScreenplayElement[];
  root: ProjectDir | null;
  /** Seção do documento ligada ao cartão (se existir). */
  secaoDoCartao: (c: OutlineCard) => string | undefined;
  /** Título atual da seção no documento. */
  tituloSecao: (id: string) => string;
  infos: Map<string, SectionInfo>;
  sizes: Map<string, SectionSize> | null;
  /** Personagens do cartão: os marcados à mão + os que falam na cena ligada. */
  personagensDe: (c: OutlineCard) => { id: string; auto: boolean }[];
  warnings: PlantWarning[];
  passa: (c: OutlineCard) => boolean;
  sel: Set<string>;
  toggleSel: (id: string, multi: boolean) => void;
  updateCard: (id: string, patch: Partial<OutlineCard>, agrupar?: string) => void;
  setHeading: (c: OutlineCard, texto: string) => void;
  commit: (next: Outline, opts?: { elementos?: ScreenplayElement[]; agrupar?: string }) => void;
  removeCard: (id: string) => void;
  abrir: (c: OutlineCard) => void;
  criarNoDoc: (c: OutlineCard) => void;
  docLabel: string;
}

/** "1,5 pág · ~2 min" (roteiro), "1,5 pág" (HQ) ou "1.200 palavras" (livro). */
export function tamanhoLabel(kindId: string, s: SectionSize | undefined): string {
  if (!s) return "";
  if (kindId === "novel") return s.palavras === 1 ? tt("1 palavra") : tt("{n} palavras", { n: s.palavras.toLocaleString(locale()) });
  const pag = s.paginas < 0.05 ? "0" : s.paginas.toLocaleString(locale(), { maximumFractionDigits: s.paginas < 1 ? 2 : 1 });
  if (kindId !== "roteiro") return tt("{n} pág", { n: pag });
  const seg = Math.round(s.paginas * 60);
  const tempo = seg < 60 ? `${Math.max(5, Math.round(seg / 5) * 5)} s` : `${Math.floor(seg / 60)} min${seg % 60 >= 15 ? ` ${Math.round((seg % 60) / 15) * 15} s` : ""}`;
  return `${tt("{n} pág", { n: pag })} · ~${tempo}`;
}

/** Medida usada para comparar atos: páginas (roteiro/HQ) ou palavras (livro). */
export const medida = (kindId: string, s: SectionSize | undefined) => (s ? (kindId === "novel" ? s.palavras : s.paginas) : 0);
