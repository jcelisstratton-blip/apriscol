"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Users, X } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Cargando } from "@/components/Cargando";
import { CLASE_INPUT } from "@/components/Campo";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Sheet } from "@/components/Sheet";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota, sumarDias } from "@/lib/fechas";
import { estadoFamacha } from "@/lib/famacha";
import { diasEntrePediluvios, mesDeFecha } from "@/lib/ajustes";
import type { Especie } from "@/lib/tipos";

export type AnimalElegido = { id: string; numero_arete: string; nombre: string | null };

const MAXIMO = 1000;

/**
 * Elegir uno o varios animales (para vacunar o tratar un lote): búsqueda para sumar de a uno, y atajos para sumar un grupo entero
 * (todo el hato, hembras, machos, una especie). Envía un campo `animal_id` por cada animal elegido.
 */
export function SelectorAnimales({
  fincaId,
  especies,
  valor,
  onCambio,
}: {
  fincaId: string;
  especies: Especie[];
  valor: AnimalElegido[];
  onCambio: (a: AnimalElegido[]) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [resultados, setResultados] = useState<AnimalElegido[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargandoGrupo, setCargandoGrupo] = useState<string | null>(null);
  const elegidos = new Set(valor.map((a) => a.id));
  // Los corrales y potreros con animales: se cargan al abrir la hoja por primera vez, para ofrecer «los de este corral».
  const [instalaciones, setInstalaciones] = useState<{ id: string; nombre: string; ocupantes: number }[] | null>(null);
  useEffect(() => {
    if (!abierta || instalaciones !== null) return;
    let vigente = true;
    void crearClienteNavegador()
      .from("v_ubicaciones")
      .select("id, nombre, ocupantes")
      .eq("finca_id", fincaId)
      .eq("activa", true)
      .gt("ocupantes", 0)
      .order("nombre")
      .limit(100)
      .then(({ data }) => {
        if (vigente) setInstalaciones((data ?? []) as { id: string; nombre: string; ocupantes: number }[]);
      });
    return () => {
      vigente = false;
    };
  }, [abierta, instalaciones, fincaId]);

  const buscar = useCallback(
    async (texto: string) => {
      setError(null);
      setResultados(null);
      const limpio = texto.replace(/[%,()*\\]/g, " ").trim();
      let q = crearClienteNavegador().from("animales").select("id, numero_arete, nombre").eq("finca_id", fincaId).eq("estado", "activo").is("deleted_at", null);
      if (limpio) q = q.or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`);
      const { data, error: e } = await q.order("numero_arete").limit(20);
      if (e) setError(e.message);
      else setResultados(data ?? []);
    },
    [fincaId],
  );

  const alternar = (a: AnimalElegido) => {
    if (elegidos.has(a.id)) onCambio(valor.filter((x) => x.id !== a.id));
    else if (valor.length < MAXIMO) onCambio([...valor, a]);
  };

  /** Trae animales activos por sus ids (por tramos: la dirección de la consulta tiene largo máximo). */
  const animalesPorId = async (ids: string[]): Promise<AnimalElegido[]> => {
    const supabase = crearClienteNavegador();
    const salida: AnimalElegido[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error: e } = await supabase.from("animales").select("id, numero_arete, nombre").eq("finca_id", fincaId).eq("estado", "activo").is("deleted_at", null).in("id", ids.slice(i, i + 100));
      if (e) throw new Error(e.message);
      salida.push(...(data ?? []));
    }
    return salida.sort((x, y) => x.numero_arete.localeCompare(y.numero_arete, "es", { numeric: true }));
  };

  const porSexoEspecie = (filtro: { sexo?: "hembra" | "macho"; especie?: Especie }) => async (): Promise<AnimalElegido[]> => {
    let q = crearClienteNavegador().from("animales").select("id, numero_arete, nombre").eq("finca_id", fincaId).eq("estado", "activo").is("deleted_at", null);
    if (filtro.sexo) q = q.eq("sexo", filtro.sexo);
    if (filtro.especie) q = q.eq("especie", filtro.especie);
    const { data, error: e } = await q.order("numero_arete").limit(MAXIMO);
    if (e) throw new Error(e.message);
    return data ?? [];
  };

  const sumarGrupo = async (clave: string, cargar: () => Promise<AnimalElegido[]>) => {
    setError(null);
    setCargandoGrupo(clave);
    try {
      const traidos = await cargar();
      const nuevos = traidos.filter((a) => !elegidos.has(a.id));
      onCambio([...valor, ...nuevos].slice(0, MAXIMO));
      if (traidos.length === 0) setError("Ningún animal del hato cumple eso por ahora.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos traer ese grupo.");
    } finally {
      setCargandoGrupo(null);
    }
  };

  const grupos: { clave: string; texto: string; cargar: () => Promise<AnimalElegido[]> }[] = [
    { clave: "todos", texto: "Todo el hato", cargar: porSexoEspecie({}) },
    { clave: "hembras", texto: "Hembras", cargar: porSexoEspecie({ sexo: "hembra" }) },
    { clave: "machos", texto: "Machos", cargar: porSexoEspecie({ sexo: "macho" }) },
    ...(especies.length > 1 ? especies.map((e) => ({ clave: e, texto: e === "caprino" ? "Caprinos" : "Ovinos", cargar: porSexoEspecie({ especie: e }) })) : []),
    {
      clave: "lactancia",
      texto: "En lactancia",
      cargar: async () => {
        const { data, error: e } = await crearClienteNavegador().from("lactancias").select("animal_id").eq("finca_id", fincaId).is("fecha_secado", null).limit(MAXIMO);
        if (e) throw new Error(e.message);
        return animalesPorId((data ?? []).map((l) => l.animal_id));
      },
    },
    {
      clave: "gestantes",
      texto: "Gestantes",
      cargar: async () => {
        const { data, error: e } = await crearClienteNavegador().from("v_repro_hembras").select("animal_id").eq("finca_id", fincaId).eq("estado", "gestante").limit(MAXIMO);
        if (e) throw new Error(e.message);
        return animalesPorId((data ?? []).map((r) => r.animal_id).filter((x): x is string => !!x));
      },
    },
    {
      clave: "crias",
      texto: "Crías (menos de 6 meses)",
      cargar: async () => {
        const { data, error: e } = await crearClienteNavegador().from("animales").select("id, numero_arete, nombre").eq("finca_id", fincaId).eq("estado", "activo").is("deleted_at", null).gte("fecha_nacimiento", sumarDias(hoyBogota(), -182)).order("numero_arete").limit(MAXIMO);
        if (e) throw new Error(e.message);
        return data ?? [];
      },
    },
    {
      clave: "podologia",
      texto: "Sin podología al día",
      cargar: async () => {
        const supabase = crearClienteNavegador();
        // El plazo es el que el propietario definió en los ajustes de la finca.
        const { data: aj, error: ea } = await supabase.from("finca_ajustes").select("podologia_inspeccion_dias").eq("finca_id", fincaId).maybeSingle();
        if (ea || !aj) throw new Error(ea?.message ?? "No se pudieron leer los ajustes de la finca.");
        const limite = sumarDias(hoyBogota(), -aj.podologia_inspeccion_dias);
        const { data, error: e } = await supabase.from("v_podologia_animal").select("animal_id, ultima_fecha").eq("finca_id", fincaId).limit(2000);
        if (e) throw new Error(e.message);
        return animalesPorId((data ?? []).filter((p) => !p.ultima_fecha || p.ultima_fecha < limite).map((p) => p.animal_id));
      },
    },
    {
      clave: "pediluvio",
      texto: "Sin pediluvio al día",
      cargar: async () => {
        const supabase = crearClienteNavegador();
        const { data: aj, error: ea } = await supabase.from("finca_ajustes").select("pediluvio_dias, pediluvio_dias_lluvia, meses_lluvia").eq("finca_id", fincaId).maybeSingle();
        if (ea || !aj) throw new Error(ea?.message ?? "No se pudieron leer los ajustes de la finca.");
        const hoy = hoyBogota();
        const limite = sumarDias(hoy, -diasEntrePediluvios(aj as Parameters<typeof diasEntrePediluvios>[0], mesDeFecha(hoy)));
        const { data, error: e } = await supabase.from("v_pediluvio_animal").select("animal_id, ultima_fecha").eq("finca_id", fincaId).limit(2000);
        if (e) throw new Error(e.message);
        return animalesPorId((data ?? []).filter((p) => !p.ultima_fecha || p.ultima_fecha < limite).map((p) => p.animal_id));
      },
    },
    {
      clave: "famacha",
      texto: "FAMACHA 4 o 5 sin desparasitar",
      cargar: async () => {
        const { data, error: e } = await crearClienteNavegador().from("v_famacha_animal").select("animal_id, puntaje, ultima_fecha, desparasitado_en").eq("finca_id", fincaId).gte("puntaje", 4).limit(2000);
        if (e) throw new Error(e.message);
        return animalesPorId((data ?? []).filter((f) => estadoFamacha(f).clave === "desparasitar").map((f) => f.animal_id));
      },
    },
    ...(instalaciones ?? []).map((u) => ({
      clave: `ub-${u.id}`,
      texto: `En ${u.nombre} (${u.ocupantes})`,
      cargar: async () => {
        const { data, error: e } = await crearClienteNavegador().from("movimientos_animales").select("animal_id").eq("finca_id", fincaId).eq("ubicacion_id", u.id).is("hasta", null).limit(MAXIMO);
        if (e) throw new Error(e.message);
        return animalesPorId((data ?? []).map((m) => m.animal_id));
      },
    })),
  ];

  const resumen =
    valor.length === 0
      ? "Elegir animales"
      : valor.length <= 3
        ? valor.map(etiquetaAnimal).join(", ")
        : `${valor.slice(0, 2).map(etiquetaAnimal).join(", ")} y ${valor.length - 2} más`;

  return (
    <>
      {valor.map((a) => (
        <input key={a.id} type="hidden" name="animal_id" value={a.id} />
      ))}
      <button type="button" onClick={() => setAbierta(true)} aria-haspopup="dialog" className={`${CLASE_INPUT} flex items-center justify-between gap-3 text-left`}>
        <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${valor.length ? "" : "text-humo/70"}`}>{resumen}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo">
          <Users className="size-4" strokeWidth={1.75} aria-hidden="true" /> {valor.length > 0 ? `${valor.length}` : ""}
        </span>
      </button>

      <Sheet abierta={abierta} onCerrar={() => setAbierta(false)} titulo="¿A qué animales?">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Sumar un grupo completo</p>
            <FilaDesplazable>
              {grupos.map((g) => (
                <Chip key={g.clave} activo={false} onClick={() => void sumarGrupo(g.clave, g.cargar)}>
                  {cargandoGrupo === g.clave ? "Sumando…" : `+ ${g.texto}`}
                </Chip>
              ))}
            </FilaDesplazable>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">O buscar de a uno</p>
            <CampoBusqueda onBuscar={buscar} placeholder="Buscar por arete o nombre" retardo={250} />
            {error ? <Aviso tipo="error">{error}</Aviso> : null}
            {resultados === null && !error ? <Cargando texto="Buscando…" /> : null}
            {resultados?.length === 0 ? <p className="py-4 text-center text-sm text-humo">No hay animales activos que coincidan.</p> : null}
            <ul className="-mx-2 space-y-0.5">
              {resultados?.map((r) => {
                const activo = elegidos.has(r.id);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => alternar(r)}
                      aria-pressed={activo}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left font-medium hover:bg-arena/60"
                    >
                      <span className="min-w-0 [overflow-wrap:anywhere]">{etiquetaAnimal(r)}</span>
                      <span className={`grid size-6 shrink-0 place-items-center rounded-full ${activo ? "bg-musgo text-sobre-musgo" : "ring-1 ring-arena"}`}>
                        {activo ? <Check className="size-4" strokeWidth={2.5} /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {valor.length > 0 ? (
            <div className="space-y-2 border-t border-arena pt-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Elegidos: {valor.length}</p>
                <button type="button" onClick={() => onCambio([])} className="min-h-11 text-sm font-semibold text-rojo">
                  Quitar todos
                </button>
              </div>
              <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {valor.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => alternar(a)}
                      aria-label={`Quitar ${etiquetaAnimal(a)}`}
                      className="inline-flex min-h-9 items-center gap-1 rounded-full bg-arena px-3 text-sm font-medium"
                    >
                      <span className="[overflow-wrap:anywhere]">{etiquetaAnimal(a)}</span> <X className="size-3.5" strokeWidth={2} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Boton type="button" onClick={() => setAbierta(false)}>
            {valor.length === 0 ? "Cerrar" : `Listo, ${valor.length} ${valor.length === 1 ? "animal" : "animales"}`}
          </Boton>
        </div>
      </Sheet>
    </>
  );
}
