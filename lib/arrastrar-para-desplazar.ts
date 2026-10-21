import { useCallback, useRef, useState } from "react";

/**
 * Desplazar de lado una fila arrastrando con el mouse (en el celular ya se hace con el dedo). Solo con mouse, solo si la fila de verdad desborda,
 * y un clic corto sigue siendo clic: tras un arrastre se descarta el clic que el navegador dispara al soltar, para no activar el botón
 * sobre el que se suelta. Se sigue al mouse aunque salga de la fila. Devuelve `ref` y `props` para el contenedor, `arrastrando` (para el cursor y
 * para suspender un `scroll-snap` mientras se arrastra) y `desborda` (cursor de agarrar solo cuando hay algo que desplazar).
 */
export function useArrastrarParaDesplazar<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [desborda, setDesborda] = useState(false);

  const alEntrar = useCallback(() => {
    const el = ref.current;
    if (el) setDesborda(el.scrollWidth > el.clientWidth + 1);
  }, []);

  const alBajar = useCallback((e: React.PointerEvent<T>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    const x0 = e.clientX;
    const inicio = el.scrollLeft;
    let movido = false;

    const mover = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      if (!movido) {
        if (Math.abs(dx) < 5) return;
        movido = true;
        setArrastrando(true);
      }
      el.scrollLeft = inicio - dx;
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      if (!movido) return;
      setArrastrando(false);
      const tragar = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      el.addEventListener("click", tragar, { capture: true, once: true });
      setTimeout(() => el.removeEventListener("click", tragar, true), 0);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  }, []);

  return {
    ref,
    arrastrando,
    desborda,
    props: { onPointerDown: alBajar, onPointerEnter: alEntrar, onDragStart: (e: React.DragEvent) => e.preventDefault() },
  };
}
