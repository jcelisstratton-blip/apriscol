"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Cargando } from "@/components/Cargando";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { ponerEnOrdeno } from "@/app/(app)/leche/actions";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha } from "@/lib/fechas";
import type { Especie } from "@/lib/tipos";

type Candidata = { id: string; numero_arete: string; nombre: string | null; especie: Especie };
type FiltroEspecie = "todas" | Especie;

const MOSTRAR = 50;

/**
 * Poner hembras en ordeño: elige cuáles están en leche y desde cuándo (fecha aproximada de su último parto).
 * Es la forma de empezar a registrar leche con animales que ya estaban en el hato.
 */
export function AgregarAlOrdeno({
  fincaId,
  hoy,
  enLeche,
  inicial,
  variante = "boton",
}: {
  fincaId: string;
  hoy: string;
  enLeche: string[];
  /** Hembra que llega preseleccionada (por ejemplo, desde su ficha). */
  inicial?: string;
  variante?: "boton" | "enlace";
}) {
  const router = useRouter();
  const toast = useToast();
  const [abierta, setAbierta] = useState(Boolean(inicial));
  const [candidatas, setCandidatas] = useState<Candidata[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [especie, setEspecie] = useState<FiltroEspecie>("todas");
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [fecha, setFecha] = useState("");
  /** Fechas propias de algunas hembras; las demás usan la general. Una clave presente = «Cambiar» está abierto. */
  const [fechasPropias, setFechasPropias] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();
  const alBuscar = useCallback((t: string) => setBusqueda(t.toLowerCase()), []);

  const cargar = useCallback(async () => {
    const { data, error: e } = await crearClienteNavegador()
      .from("animales")
      .select("id, numero_arete, nombre, especie")
      .eq("finca_id", fincaId)
      .eq("sexo", "hembra")
      .eq("estado", "activo")
      .is("deleted_at", null)
      .order("numero_arete")
      .limit(1000);
    if (e) return setError(e.message);
    const ya = new Set(enLeche);
    const lista = (data ?? []).filter((a) => !ya.has(a.id));
    setCandidatas(lista);
    if (inicial && lista.some((a) => a.id === inicial)) setElegidas(new Set([inicial]));
  }, [fincaId, enLeche, inicial]);

  // Si llega con una hembra preseleccionada (desde su ficha), la hoja ya está abierta: hay que traer las candidatas.
  const arrancado = useRef(false);
  useEffect(() => {
    if (inicial && !arrancado.current) {
      arrancado.current = true;
      void cargar();
    }
  }, [inicial, cargar]);

  const abrir = () => {
    setAbierta(true);
    setError(null);
    if (!candidatas) void cargar();
  };

  const visibles = (candidatas ?? []).filter(
    (a) => (especie === "todas" || a.especie === especie) && (!busqueda || a.numero_arete.toLowerCase().includes(busqueda) || (a.nombre ?? "").toLowerCase().includes(busqueda)),
  );
  const mostradas = visibles.slice(0, MOSTRAR);
  const hayDosEspecies = new Set((candidatas ?? []).map((a) => a.especie)).size > 1;

  const fechaDe = (id: string) => fechasPropias[id] || fecha;
  const faltaFecha = [...elegidas].some((id) => !fechaDe(id));
  const cambiarFecha = (id: string, valor: string | null) =>
    setFechasPropias((p) => {
      const nuevo = { ...p };
      if (valor === null) delete nuevo[id];
      else nuevo[id] = valor;
      return nuevo;
    });

  const alternar = (id: string) =>
    setElegidas((previo) => {
      const nuevo = new Set(previo);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = await ponerEnOrdeno({
        animales: [...elegidas].map((animalId) => ({ animalId, fechaParto: fechasPropias[animalId] || undefined })),
        fechaParto: fecha || undefined,
      });
      if (!r.ok) return setError(r.error);
      toast.exito(
        r.agregadas === 0
          ? "No se agregó ninguna: ya estaban en leche o nacieron después de esa fecha."
          : `${r.agregadas} ${r.agregadas === 1 ? "hembra agregada" : "hembras agregadas"} al ordeño${r.omitidas > 0 ? ` (${r.omitidas} omitidas)` : ""}`,
      );
      setAbierta(false);
      setElegidas(new Set());
      setFechasPropias({});
      setCandidatas(null);
      router.refresh();
    });

  return (
    <>
      {variante === "enlace" ? (
        <button type="button" onClick={abrir} className="min-h-11 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
          Agregar hembras al ordeño
        </button>
      ) : (
        <Boton onClick={abrir} variante="secundario">
          <Plus className="size-5" strokeWidth={2.2} /> Agregar hembras al ordeño
        </Boton>
      )}

      <Sheet
        abierta={abierta}
        onCerrar={() => (guardando ? undefined : setAbierta(false))}
        titulo="Agregar hembras al ordeño"
        pie={
          <Boton onClick={guardar} pendiente={guardando} cargando="Agregando…" disabled={elegidas.size === 0 || faltaFecha}>
            {elegidas.size === 0 ? "Elige las hembras" : `Agregar ${elegidas.size} ${elegidas.size === 1 ? "hembra" : "hembras"}`}
          </Boton>
        }
      >
        <div className="space-y-4">
          <p className="text-[0.9375rem] text-humo">Elige las hembras que están en leche ahora. Aparecerán en la lista del ordeño para registrar sus litros.</p>

          <Campo etiqueta="¿Desde cuándo están en leche?" ayuda="Fecha aproximada del último parto, para todas las que elijas. Si alguna parió otro día, cámbiala en su fila. Con ella calculamos los días en leche.">
            {(id) => <input id={id} type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} className={CLASE_INPUT} />}
          </Campo>

          {candidatas === null && !error ? <Cargando texto="Buscando tus hembras…" /> : null}
          {error ? <Aviso tipo="error">{error}</Aviso> : null}

          {candidatas !== null ? (
            candidatas.length === 0 ? (
              <p className="py-4 text-center text-[0.9375rem] text-humo">Todas tus hembras activas ya están en el ordeño.</p>
            ) : (
              <div className="space-y-3">
                {candidatas.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
                {hayDosEspecies ? (
                  <FilaDesplazable>
                    <Chip activo={especie === "todas"} onClick={() => setEspecie("todas")}>Todas</Chip>
                    <Chip activo={especie === "caprino"} onClick={() => setEspecie("caprino")}>Cabras</Chip>
                    <Chip activo={especie === "ovino"} onClick={() => setEspecie("ovino")}>Ovejas</Chip>
                  </FilaDesplazable>
                ) : null}
                <div className="flex items-center justify-between gap-3 text-sm text-humo">
                  <span>
                    {visibles.length === 0 ? "Sin resultados" : `Mostrando ${mostradas.length} de ${visibles.length}`}
                  </span>
                  {mostradas.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setElegidas((p) => new Set([...p, ...mostradas.map((a) => a.id)]))}
                      className="min-h-11 font-semibold text-musgo"
                    >
                      Elegir las {mostradas.length} que veo
                    </button>
                  ) : null}
                </div>
                <ul className="-mx-2 space-y-0.5">
                  {mostradas.map((a) => (
                    <li key={a.id}>
                      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 hover:bg-arena/60">
                        <input type="checkbox" checked={elegidas.has(a.id)} onChange={() => alternar(a.id)} className="size-5 shrink-0 accent-[var(--musgo)]" />
                        <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{etiquetaAnimal(a)}</span>
                      </label>
                      {elegidas.has(a.id) ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 pl-11 pr-3 text-sm text-humo">
                          {a.id in fechasPropias ? (
                            <>
                              <input
                                type="date"
                                aria-label={`Fecha de parto de ${etiquetaAnimal(a)}`}
                                value={fechasPropias[a.id]}
                                max={hoy}
                                onChange={(e) => cambiarFecha(a.id, e.target.value)}
                                className={`${CLASE_INPUT} min-w-0 flex-1`}
                              />
                              <button type="button" onClick={() => cambiarFecha(a.id, null)} className="min-h-11 font-semibold text-musgo">
                                Usar la fecha de todas
                              </button>
                            </>
                          ) : (
                            <>
                              <span>{fecha ? `Parto: ${formatoFecha(fecha)}` : "Falta la fecha de parto"}</span>
                              <button type="button" onClick={() => cambiarFecha(a.id, fecha)} className="min-h-11 font-semibold text-musgo">
                                Cambiar
                              </button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {visibles.length > MOSTRAR ? <p className="text-sm text-humo">Hay más: afina la búsqueda para verlas.</p> : null}
              </div>
            )
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
