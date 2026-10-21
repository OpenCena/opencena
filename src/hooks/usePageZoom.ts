// Zoom das folhas com Ctrl + roda do mouse (ou pinça no touchpad) e com
// Ctrl + / Ctrl - / Ctrl 0, no lugar do zoom do navegador. O ponto sob o cursor
// continua no mesmo lugar enquanto o zoom muda.
import { RefObject, useEffect, useLayoutEffect, useRef } from "react";

const MIN = 0.3;
const MAX = 3;
const STEPS = [0.3, 0.4, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export function usePageZoom(
  ref: RefObject<HTMLElement>,
  zoom: number,
  setZoom: (z: number | "fit") => void,
  padTop = 24
) {
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const anchor = useRef<{ cx: number; cy: number; mx: number; my: number; z: number } | null>(null);

  // depois que o zoom muda, recoloca o ponto de referência sob o cursor
  useLayoutEffect(() => {
    const a = anchor.current;
    const el = ref.current;
    if (!a || !el || Math.abs(a.z - zoom) > 1e-6) return;
    el.scrollTop = a.cy * zoom + padTop - a.my;
    el.scrollLeft = Math.max(0, a.cx * zoom - a.mx);
    anchor.current = null;
  }, [zoom, ref, padTop]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const clamp = (z: number) => Math.round(Math.max(MIN, Math.min(MAX, z)) * 1000) / 1000;

    const zoomAt = (next: number, mx: number, my: number) => {
      const z = zoomRef.current;
      if (Math.abs(next - z) < 1e-6) return;
      anchor.current = {
        cx: (el.scrollLeft + mx) / z,
        cy: (el.scrollTop + my - padTop) / z,
        mx,
        my,
        z: next,
      };
      setZoom(next);
    };

    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = el!.getBoundingClientRect();
      zoomAt(clamp(zoomRef.current * Math.exp(-e.deltaY * 0.002)), e.clientX - r.left, e.clientY - r.top);
    }

    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const z = zoomRef.current;
      const r = el!.getBoundingClientRect();
      const mx = r.width / 2;
      const my = r.height / 2;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomAt(STEPS.find((v) => v > z + 0.001) ?? MAX, mx, my);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomAt([...STEPS].reverse().find((v) => v < z - 0.001) ?? MIN, mx, my);
      } else if (e.key === "0") {
        e.preventDefault();
        zoomAt(1, mx, my);
      }
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [ref, setZoom, padTop]);
}
