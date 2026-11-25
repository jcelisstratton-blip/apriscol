import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Píxeles por segundo: una tarjeta cada 7 u 8 segundos, lo bastante lento para leerla mientras pasa. */
const VELOCIDAD = 26;
/** Tras tocar, arrastrar, girar la rueda o usar las flechas, la fila espera esto antes de volver a moverse sola. */
const ESPERA_TRAS_TOCAR = 2500;
/** Lo que tarda el paso de una flecha. */
const DURACION_PASO = 560;

const CONSULTA_MENOS_MOVIMIENTO = "(prefers-reduced-motion: reduce)";
const suscribirMenosMovimiento = (avisar: () => void) => {
  const m = window.matchMedia(CONSULTA_MENOS_MOVIMIENTO);
  m.addEventListener("change", avisar);
  return () => m.removeEventListener("change", avisar);
};

/**
 * Una fila de tarjetas que se desliza sola, despacio y sin parar (pantalla de entrada). El contenedor lleva las tarjetas **dos veces**: la segunda
 * copia se marca con `data-copia` en su primer elemento, con `aria-hidden` e `inert`, y al llegar a ella la fila vuelve al inicio sin que se note.
 * Mueve `scrollLeft` (no un `transform`), así el dedo, el arrastre con el mouse de `useArrastrarParaDesplazar`, la rueda y el teclado siguen funcionando.
 *
 * Se detiene mientras el mouse está encima, mientras se toca o arrastra (y 2,5 s después), con el foco del teclado dentro, si la fila no está en
 * pantalla, si la pestaña está oculta y con el botón de pausa (`pausado`, obligatorio para contenido que se mueve solo). Con «Reducir movimiento» no se
 * mueve nunca y `continuo` es falso: se muestran las tarjetas una sola vez, con su ajuste (`snap`) normal.
 */
export function useDesplazamientoContinuo(ref: React.RefObject<HTMLElement | null>) {
  const reducido = useSyncExternalStore(suscribirMenosMovimiento, () => window.matchMedia(CONSULTA_MENOS_MOVIMIENTO).matches, () => true);
  const [pausado, setPausado] = useState(false);
  const config = useRef({ reducido, pausado });
  const estado = useRef({ pos: 0, ciclo: 0, encima: false, foco: false, visible: false, tocadoHasta: 0, paso: null as null | { desde: number; hasta: number; t0: number } });

  useEffect(() => {
    config.current = { reducido, pausado };
  }, [reducido, pausado]);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducido) return;
    const s = estado.current;
    let cuadro = 0;
    let previo = 0;
    let escrito = -1;

    const medir = () => {
      const copia = el.querySelector<HTMLElement>("[data-copia]");
      const primero = el.firstElementChild as HTMLElement | null;
      s.ciclo = copia && primero ? copia.offsetLeft - primero.offsetLeft : 0;
    };
    const envolver = (x: number) => (s.ciclo > 0 ? ((x % s.ciclo) + s.ciclo) % s.ciclo : Math.max(0, x));
    const puedeAvanzar = () =>
      !config.current.pausado && s.visible && !s.encima && !s.foco && !document.hidden && performance.now() > s.tocadoHasta;

    const animar = (t: number) => {
      cuadro = requestAnimationFrame(animar);
      const dt = previo ? Math.min(t - previo, 64) : 0;
      previo = t;
      let crudo: number;
      if (s.paso) {
        const k = Math.min((t - s.paso.t0) / DURACION_PASO, 1);
        crudo = s.paso.desde + (s.paso.hasta - s.paso.desde) * (1 - Math.pow(1 - k, 3));
        if (k >= 1) s.paso = null;
      } else if (puedeAvanzar()) {
        crudo = s.pos + (VELOCIDAD * dt) / 1000;
      } else {
        return;
      }
      s.pos = envolver(crudo);
      el.scrollLeft = s.pos;
      escrito = el.scrollLeft;
    };

    // Si la persona movió la fila (dedo, rueda, arrastre), se sigue desde donde la dejó.
    const alDesplazar = () => {
      if (Math.abs(el.scrollLeft - escrito) > 1) s.pos = el.scrollLeft;
    };
    const tocar = (hastaSoltar = false) => {
      s.paso = null;
      s.tocadoHasta = hastaSoltar ? Infinity : performance.now() + ESPERA_TRAS_TOCAR;
    };
    const alBajar = () => {
      tocar(true);
      const soltar = () => {
        tocar();
        window.removeEventListener("pointerup", soltar);
        window.removeEventListener("pointercancel", soltar);
      };
      window.addEventListener("pointerup", soltar);
      window.addEventListener("pointercancel", soltar);
    };
    const alRueda = () => tocar();
    // Solo el mouse detiene la fila al pasar por encima: en el celular un toque simula «entrar» y nunca «salir», y la dejaría quieta.
    const alEntrar = (e: PointerEvent) => {
      if (e.pointerType === "mouse") s.encima = true;
    };
    const alSalir = (e: PointerEvent) => {
      if (e.pointerType === "mouse") s.encima = false;
    };
    const alFoco = () => (s.foco = el.matches(":focus-visible") || Boolean(el.querySelector(":focus-visible")));
    const alPerderFoco = () => (s.foco = false);

    medir();
    s.pos = el.scrollLeft;
    const tamano = new ResizeObserver(medir);
    tamano.observe(el);
    const vista = new IntersectionObserver(([e]) => (s.visible = e.isIntersecting));
    vista.observe(el);
    el.addEventListener("scroll", alDesplazar, { passive: true });
    el.addEventListener("pointerdown", alBajar, { passive: true });
    el.addEventListener("wheel", alRueda, { passive: true });
    el.addEventListener("pointerenter", alEntrar);
    el.addEventListener("pointerleave", alSalir);
    el.addEventListener("focusin", alFoco);
    el.addEventListener("focusout", alPerderFoco);
    cuadro = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(cuadro);
      tamano.disconnect();
      vista.disconnect();
      el.removeEventListener("scroll", alDesplazar);
      el.removeEventListener("pointerdown", alBajar);
      el.removeEventListener("wheel", alRueda);
      el.removeEventListener("pointerenter", alEntrar);
      el.removeEventListener("pointerleave", alSalir);
      el.removeEventListener("focusin", alFoco);
      el.removeEventListener("focusout", alPerderFoco);
    };
  }, [ref, reducido]);

  /** Flechas y teclado: avanza o retrocede casi una pantalla, con un paso suave que da la vuelta sin saltos. */
  const avanzar = useCallback(
    (direccion: 1 | -1) => {
      const el = ref.current;
      if (!el) return;
      const distancia = direccion * Math.max(el.clientWidth * 0.8, 240);
      if (config.current.reducido) {
        el.scrollBy({ left: distancia, behavior: "auto" });
        return;
      }
      const s = estado.current;
      const desde = direccion < 0 && s.pos + distancia < 0 ? s.pos + s.ciclo : s.pos;
      s.paso = { desde, hasta: desde + distancia, t0: performance.now() };
      s.tocadoHasta = performance.now() + DURACION_PASO + ESPERA_TRAS_TOCAR;
    },
    [ref],
  );

  return { continuo: !reducido, pausado, alternarPausa: () => setPausado((p) => !p), avanzar };
}
