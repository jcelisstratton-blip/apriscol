import type { Metadata } from "next";
import Link from "next/link";
import { textoCC } from "@/lib/empadronamiento";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar, puedeVer } from "@/lib/permisos";
import { urlsFotos, urlsFotosPremios } from "@/lib/fotos";
import { VisorFoto } from "@/components/VisorFoto";
import { FilaParticipacion } from "@/components/FilaParticipacion";
import { clasesBoton } from "@/components/Boton";
import { diasHasta, edadTexto, formatoFecha, hoyBogota, litros, sumarDias } from "@/lib/fechas";
import { GraficoProduccion } from "@/components/GraficoProduccion";
import { CONSEJO_BAJA, esBaja, mensajeBaja } from "@/lib/produccion";
import { pesos } from "@/lib/ferias";
import { ETIQUETA_MOTIVO_BAJA, ETIQUETA_TIPO_BAJA } from "@/lib/bajas";
import { DeshacerBaja } from "@/components/DeshacerBaja";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { ETIQUETA_USO_MACHO, ETIQUETA_VOCACION, nombreTipo } from "@/lib/animal";
import { NivelEndogamia } from "@/components/NivelEndogamia";
import { RutasEndogamia } from "@/components/RutasEndogamia";
import { HistorialSanidadAnimal } from "@/components/HistorialSanidadAnimal";
import { TurnosAnimal } from "@/components/TurnosAnimal";
import { estadoDosis, estadoFechaPrograma, ETIQUETA_EVENTO, ETIQUETA_RESULTADO_PRUEBA, nombreEvento, TIPOS_EVENTO } from "@/lib/sanidad";
import { estadoRcs, formatoMiles } from "@/lib/leche-calidad";
import { ETIQUETA_CONFORMACION, ETIQUETA_ENGRASAMIENTO, ETIQUETA_GRASA_VISCERAL, ETIQUETA_PESAJE, faltaParaMeta, gdp, kg, pctUno } from "@/lib/carne";
import { LoteAnimal } from "@/components/LoteAnimal";
import { AplazadoCeba, CandidatoCeba as AvisoCandidatoCeba } from "@/components/CandidatoCeba";
import { textosAdvertencias, textosMotivos } from "@/lib/ceba-candidatos";
import type { CandidatoCeba, ReglaCeba } from "@/lib/tipos";
import { direccionSoporte } from "@/lib/soportes";
import { DIAS_PARA_DIAGNOSTICO, ETIQUETA_ESTADO, ETIQUETA_METODO, ETIQUETA_PARTO, ETIQUETA_RESULTADO, ETIQUETA_SERVICIO, plazoParto, textoPartos, TONO_ESTADO } from "@/lib/reproduccion";
import { PartosPrevios } from "@/components/PartosPrevios";
import { controlesDeSalida, etiquetaResumen, resumenControles } from "@/lib/controles";
import { describirParentesco, nivelEndogamia, pedigriTexto, porcentaje, primeraMayuscula, type AncestroEndogamia } from "@/lib/endogamia";

export const metadata: Metadata = { title: "Animal" };

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-humo">{etiqueta}</dt>
      <dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export default async function FichaAnimal({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string; sin_crear?: string }> }) {
  const { id } = await params;
  const { guardado, sin_crear: sinCrearBruto } = await searchParams;
  // Aretes de crías que no se pudieron crear (viene en la dirección: se limpia para mostrar solo texto simple).
  const sin_crear = (sinCrearBruto ?? "").replace(/[^\p{L}\p{N}*\-_., ]/gu, "").slice(0, 200);
  if (!ID_UUID.test(id)) notFound();

  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("*").eq("id", id).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!animal) notFound();

  // Un animal del libro tiene su pedigrí aunque sus padres no estén en este hato.
  const puedeCalcular = Boolean((animal.padre_id && animal.madre_id) || animal.libro_id);
  const verLeche = puedeVer(rol, "leche") && animal.sexo === "hembra";
  const verGenealogia = puedeVer(rol, "genealogia") || puedeVer(rol, "hato");
  const verFerias = puedeVer(rol, "ferias");
  const verSanidad = puedeVer(rol, "sanidad");
  const verCarne = puedeVer(rol, "carne");
  const verRepro = puedeVer(rol, "reproduccion") && animal.sexo === "hembra";
  const idsPadres = [animal.padre_id, animal.madre_id].filter((x): x is string => !!x);

  const [raza, padres, endo, completitud, lactancia, retiro, palmares, participaciones, baja] = await Promise.all([
    animal.raza_id ? supabase.from("razas").select("nombre").eq("id", animal.raza_id).maybeSingle() : Promise.resolve({ data: null }),
    idsPadres.length ? supabase.from("animales").select("id, numero_arete, nombre").in("id", idsPadres) : Promise.resolve({ data: [] }),
    puedeCalcular && verGenealogia ? supabase.rpc("coef_endogamia", { p_animal: id }) : Promise.resolve({ data: null as number | null }),
    verGenealogia ? supabase.rpc("completitud_pedigri", { p_animal: id }) : Promise.resolve({ data: null as number | null }),
    verLeche
      ? supabase.from("v_lactancias_resumen").select("*").eq("animal_id", id).order("numero", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("animales_en_retiro", { p_finca: finca.id }),
    verFerias ? supabase.from("v_palmares_animal").select("*").eq("animal_id", id).maybeSingle() : Promise.resolve({ data: null }),
    verFerias
      ? supabase
          .from("participaciones_feria")
          .select("id, feria_id, categoria, resultado, puesto, puntaje, premio_descripcion, premio_en_dinero, foto_path")
          .eq("animal_id", id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    animal.estado !== "activo" ? supabase.from("bajas").select("*").eq("animal_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  // Producción de los últimos 14 días completos y tendencia (solo hembras con lactancia abierta).
  const hoy = hoyBogota();
  const lacActual = lactancia.data;
  const vigilarProduccion = verLeche && Boolean(lacActual) && !lacActual?.fecha_secado;
  const [tendenciasHato, ordenosRecientes] = vigilarProduccion
    ? await Promise.all([
        supabase.rpc("produccion_tendencia", { p_finca: finca.id }),
        supabase.from("ordenos").select("fecha, litros").eq("animal_id", id).eq("finca_id", finca.id).gte("fecha", sumarDias(hoy, -14)).lte("fecha", sumarDias(hoy, -1)),
      ])
    : [{ data: null }, { data: null }];
  const tendenciaAnimal = tendenciasHato.data?.find((t) => t.animal_id === id);
  const litrosPorDia = new Map<string, number>();
  for (const o of ordenosRecientes.data ?? []) litrosPorDia.set(o.fecha, (litrosPorDia.get(o.fecha) ?? 0) + Number(o.litros));
  const diasGrafico = Array.from({ length: 14 }, (_, i) => {
    const fecha = sumarDias(hoy, i - 14);
    return { fecha, litros: litrosPorDia.get(fecha) ?? null };
  });

  const listaPremios = participaciones.data ?? [];
  const idsFerias = [...new Set(listaPremios.map((p) => p.feria_id))];
  // Sanidad del animal: sus aplicaciones, pruebas y próximas dosis (solo quien puede ver sanidad).
  const [eventosSan, pruebasSan, pendientesSan] = verSanidad
    ? await Promise.all([
        supabase.from("v_eventos_animal").select("*").eq("animal_id", id).order("fecha", { ascending: false }).limit(100),
        supabase.from("pruebas_sanitarias").select("id, fecha, prueba, resultado, laboratorio").eq("animal_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).limit(50),
        supabase.from("v_sanidad_pendiente").select("evento_id, tipo, producto_nombre, proxima_fecha").eq("animal_id", id).order("proxima_fecha"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  // Lo programado para este animal que aún no se aplica (Hato → Sanidad).
  const pendientesProg = verSanidad ? ((await supabase.from("programa_sanitario_animales").select("programa_id").eq("animal_id", id).eq("finca_id", finca.id).is("evento_id", null).limit(50)).data ?? []) : [];
  const programasAnimal = pendientesProg.length > 0
    ? ((await supabase.from("v_programas_sanitarios").select("*").in("id", pendientesProg.map((p) => p.programa_id)).eq("finca_id", finca.id).neq("estado", "cancelado").order("fecha_programada")).data ?? [])
    : [];
  const historialEventos = (eventosSan.data ?? []).map((e) => ({
    clave: `e-${e.id}`,
    fecha: e.fecha ?? "",
    tipo: e.tipo,
    producto_nombre: e.producto_nombre,
    evento_id: e.id ?? "",
    retiro_leche_hasta: e.fin_retiro_leche && (e.retiro_leche_dias ?? 0) > 0 && e.fin_retiro_leche >= hoyBogota() ? e.fin_retiro_leche : null,
    retiro_carne_hasta: e.fin_retiro_carne && (e.retiro_carne_dias ?? 0) > 0 && e.fin_retiro_carne >= hoyBogota() ? e.fin_retiro_carne : null,
  }));
  // Crecimiento y ceba: pesos del animal, su ganancia diaria (la calcula la base) y el lote en el que está.
  const [pesosDB, cebaDB, lotesDB, candidatoDB, reglasDB] = verCarne
    ? await Promise.all([
        supabase.from("pesajes").select("*").eq("animal_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).limit(50),
        supabase.rpc("ceba_animales", { p_finca: finca.id }),
        supabase.from("lotes_ceba").select("id, nombre, peso_meta_kg, cerrado_en").eq("finca_id", finca.id).order("nombre").limit(500),
        animal.estado === "activo" ? supabase.rpc("candidatos_ceba", { p_finca: finca.id, p_animal: id }) : Promise.resolve({ data: [] as CandidatoCeba[] }),
        animal.estado === "activo" ? supabase.rpc("reglas_ceba_efectivas", { p_finca: finca.id }) : Promise.resolve({ data: [] as ReglaCeba[] }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] as CandidatoCeba[] }, { data: [] as ReglaCeba[] }];
  const miCandidato = (candidatoDB.data ?? [])[0] ?? null;
  const reglaCandidato = miCandidato ? (reglasDB.data ?? []).find((r) => r.especie === miCandidato.especie) ?? null : null;
  const miCeba = (cebaDB.data ?? []).find((c) => c.animal_id === id);
  const listaPesos = pesosDB.data ?? [];
  const lotesCeba = lotesDB.data ?? [];
  const miLote = lotesCeba.find((l) => l.id === animal.lote_ceba_id);
  // Reproducción de la hembra: su estado (vacía, servida, gestante), partos y el historial de servicios, diagnósticos y partos.
  const [reproDB, serviciosDB, diagnosticosDB, partosDB] = verRepro
    ? await Promise.all([
        supabase.from("v_repro_hembras").select("*").eq("animal_id", id).maybeSingle(),
        supabase.from("servicios").select("*").eq("hembra_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).limit(10),
        supabase.from("diagnosticos_gestacion").select("*").eq("hembra_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).limit(10),
        supabase.from("partos").select("*").eq("madre_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).limit(10),
      ])
    : [{ data: null }, { data: [] }, { data: [] }, { data: [] }];
  const repro = reproDB.data;
  const todoRepro = [
    ...(serviciosDB.data ?? []).map((x) => ({ clave: `s-${x.id}`, fecha: x.fecha, tipo: "servicio" as const, href: `/reproduccion/servicios/${x.id}`, texto: `Servicio · ${ETIQUETA_SERVICIO[x.tipo]}` })),
    ...(diagnosticosDB.data ?? []).map((x) => ({ clave: `d-${x.id}`, fecha: x.fecha, tipo: "diagnostico" as const, href: `/reproduccion/diagnosticos/${x.id}`, texto: `Diagnóstico · ${ETIQUETA_RESULTADO[x.resultado]} (${ETIQUETA_METODO[x.metodo].toLowerCase()})` })),
    ...(partosDB.data ?? []).map((x) => ({ clave: `p-${x.id}`, fecha: x.fecha, tipo: "parto" as const, href: `/reproduccion/partos/${x.id}`, texto: `${ETIQUETA_PARTO[x.tipo]}${x.tipo === "aborto" ? "" : ` · ${x.numero_crias} ${x.numero_crias === 1 ? "cría" : "crías"}`}` })),
  ].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const historialRepro = todoRepro.slice(0, 8);
  const mostrarRepro = verRepro && (animal.estado === "activo" || historialRepro.length > 0);
  // Controles de calidad de un animal que salió para consumo (condición corporal, inspección en el matadero).
  const aplicanControles = baja.data ? controlesDeSalida(baja.data.tipo, baja.data.destino_consumo) : [];
  const controlesAnimal =
    verCarne && aplicanControles.length > 0
      ? ((await supabase.from("controles_calidad").select("tipo, estado").eq("animal_id", id).eq("finca_id", finca.id)).data ?? [])
      : [];
  const etiquetaControles = etiquetaResumen(resumenControles(aplicanControles, controlesAnimal));
  // Canal (rendimiento al beneficio) de un animal sacrificado.
  const canal =
    verCarne && baja.data?.tipo === "sacrificio"
      ? (await supabase.from("v_canales").select("*").eq("animal_id", id).eq("finca_id", finca.id).maybeSingle()).data
      : null;
  const esCeba = animal.sexo === "macho" ? animal.uso_macho === "carne" : animal.vocacion !== "leche";
  const mostrarCrecimiento = verCarne && (animal.estado === "activo" || listaPesos.length > 0);
  // Calidad de la leche de esta hembra: sus análisis (grasa, proteína, células somáticas). El CMT vive en Sanidad → Pruebas.
  const analisisLeche = verLeche
    ? ((await supabase.from("analisis_leche").select("*").eq("animal_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(20)).data ?? [])
    : [];
  const historialPruebas = (pruebasSan.data ?? []).map((p) => ({ clave: `p-${p.id}`, id: p.id, fecha: p.fecha, prueba: p.prueba, resultado: p.resultado, laboratorio: p.laboratorio }));
  const dosisPendientes = pendientesSan.data ?? [];
  const ultimoCmt = (pruebasSan.data ?? []).find((p) => p.prueba === "cmt");

  const [feriasData, fotosPremios, fotosAnimal] = await Promise.all([
    idsFerias.length ? supabase.from("ferias").select("id, nombre, fecha_inicio").in("id", idsFerias) : Promise.resolve({ data: [] }),
    urlsFotosPremios(supabase, listaPremios.map((p) => p.foto_path)),
    urlsFotos(supabase, "fotos-animales", [animal.foto_path]),
  ]);
  const fotoAnimal = animal.foto_path ? fotosAnimal.get(animal.foto_path) : undefined;
  const ferias = new Map((feriasData.data ?? []).map((f) => [f.id, f]));

  const padre = padres.data?.find((p) => p.id === animal.padre_id);
  const madre = padres.data?.find((p) => p.id === animal.madre_id);
  const miRetiro = retiro.data?.find((r) => r.animal_id === id);
  const pedigri = typeof completitud.data === "number" ? completitud.data : 0;
  // Con un pedigrí vacío el 0 % no significa «sin endogamia», significa «sin datos»: no se muestra como medida.
  const f = pedigri > 0 && typeof endo.data === "number" ? endo.data : null;
  const nivel = f === null ? null : nivelEndogamia(f, finca.umbral_endogamia);
  const alertaEndogamia = nivel === "alto" || nivel === "muy_alto";
  // Por qué hay endogamia: ancestros repetidos y parentesco entre el padre y la madre.
  const origen: AncestroEndogamia[] = f !== null && f > 0 ? ((await supabase.rpc("explicar_endogamia", { p_animal: id })).data ?? []) : [];
  const parentescoPadres = describirParentesco(origen);
  const lac = lactancia.data;
  const lacAbierta = lac && !lac.fecha_secado;

  return (
    <>
      <AvisoGuardado activo={guardado === "1"} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <Link href="/hato" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
          <ChevronLeft className="size-5" strokeWidth={2} /> Hato
        </Link>
        {puedeEscribir(rol, "hato") ? (
          <Link
            href={`/hato/${id}/editar`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-papel px-4 text-sm font-semibold text-musgo ring-1 ring-arena transition hover:bg-arena/40"
          >
            <Pencil className="size-4" strokeWidth={2} aria-hidden="true" /> Editar
          </Link>
        ) : null}
      </div>

      <header className="flex items-start gap-4 pb-4 pt-1">
        {fotoAnimal ? <VisorFoto url={fotoAnimal} titulo={`Foto de ${animal.nombre ?? animal.numero_arete}`} tamano="size-24" /> : null}
        <div className="min-w-0 flex-1">
        <h1 className="font-display text-[2.25rem] font-semibold leading-none tracking-tight [overflow-wrap:anywhere]">{animal.numero_arete}</h1>
        {animal.nombre ? <p className="mt-1 text-lg text-humo [overflow-wrap:anywhere]">{animal.nombre}</p> : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Insignia tono="musgo">{nombreTipo(animal.especie, animal.sexo)}</Insignia>
          {animal.sexo === "hembra" ? (
            <Insignia>{ETIQUETA_VOCACION[animal.vocacion]}</Insignia>
          ) : (
            <Insignia>{animal.uso_macho ? ETIQUETA_USO_MACHO[animal.uso_macho] : "Uso por definir"}</Insignia>
          )}
          {animal.estado !== "activo" ? <Insignia tono="alerta">{animal.estado[0].toUpperCase() + animal.estado.slice(1)}</Insignia> : null}
          {lacAbierta ? <Insignia tono="ok">En lactancia</Insignia> : null}
        </div>
        </div>
      </header>

      <div className="space-y-3.5 lg:columns-2 lg:gap-x-4 lg:[&>*]:break-inside-avoid">
        {miRetiro ? (
          <Aviso tipo="atencion">
            En periodo de retiro
            {miRetiro.retiro_leche_hasta ? ` · la leche no va al tanque hasta el ${formatoFecha(miRetiro.retiro_leche_hasta)}` : ""}
            {miRetiro.retiro_carne_hasta ? ` · no puede salir para consumo hasta el ${formatoFecha(miRetiro.retiro_carne_hasta)}` : ""}.
          </Aviso>
        ) : null}

        <Tarjeta titulo="Datos">
          <dl className="divide-y divide-arena">
            <Dato etiqueta="Raza">{raza.data?.nombre ?? "Sin especificar"}</Dato>
            <Dato etiqueta="Nacimiento">
              {formatoFecha(animal.fecha_nacimiento)}
              {animal.fecha_nacimiento_aprox ? " (aprox.)" : ""}
            </Dato>
            <Dato etiqueta="Edad">{edadTexto(animal.fecha_nacimiento)}</Dato>
            <Dato etiqueta="Origen">{animal.origen === "comprado" ? "Comprado" : "Nació en la finca"}</Dato>
            {animal.chip ? <Dato etiqueta="Microchip">{animal.chip}</Dato> : null}
            {animal.color ? <Dato etiqueta="Color">{animal.color}</Dato> : null}
            {animal.rasgos ? <Dato etiqueta="Rasgos">{animal.rasgos}</Dato> : null}
            {animal.marcas ? <Dato etiqueta="Marcas">{animal.marcas}</Dato> : null}
            {animal.peso_nacer_kg ? <Dato etiqueta="Peso al nacer">{litros(animal.peso_nacer_kg)} kg</Dato> : null}
          </dl>
        </Tarjeta>

        {verLeche && (lac || animal.estado === "activo") ? (
          <Tarjeta titulo="Lactancia">
            {lac ? (
              <>
              <dl className="divide-y divide-arena">
                <Dato etiqueta="Lactancia">N.º {lac.numero}{lac.fecha_secado ? " · seca" : " · abierta"}</Dato>
                <Dato etiqueta="Desde el parto">{formatoFecha(lac.fecha_parto)}</Dato>
                <Dato etiqueta="Días en leche">{lac.dias_lactancia}</Dato>
                <Dato etiqueta="Total">{litros(lac.litros_total)} L</Dato>
                <Dato etiqueta="Promedio por día">{lac.promedio_diario == null ? "—" : `${litros(lac.promedio_diario)} L`}</Dato>
                <Dato etiqueta="Pico en un día">{lac.pico_diario == null ? "—" : `${litros(lac.pico_diario)} L`}</Dato>
              </dl>
              {lacAbierta && animal.estado === "activo" ? (
                <div className="mt-4 space-y-1.5">
                  <p className="text-sm font-semibold">Turnos de ordeño</p>
                  <TurnosAnimal animalId={id} programados={animal.turnos_ordeno} puedeEditar={puedeEscribir(rol, "hato")} />
                </div>
              ) : null}
              <Link href={`/leche?animal=${id}`} className="mt-3 inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
                Ver toda su producción
              </Link>
              {vigilarProduccion ? (
                <div className="mt-4 space-y-3">
                  {tendenciaAnimal && esBaja(tendenciaAnimal) ? (
                    <Aviso tipo="atencion">
                      <strong>Su producción viene bajando.</strong> {mensajeBaja(tendenciaAnimal)} {CONSEJO_BAJA}
                    </Aviso>
                  ) : tendenciaAnimal?.nivel === "normal" ? (
                    <Aviso tipo="info">
                      Su producción se mantiene: {litros(tendenciaAnimal.litros_base)} L al día antes y {litros(tendenciaAnimal.litros_recientes)} L en los últimos 3 días.
                    </Aviso>
                  ) : (
                    <Aviso tipo="info">Con unos 6 días de ordeño registrados, aquí te avisamos si su producción empieza a bajar.</Aviso>
                  )}
                  {diasGrafico.some((d) => d.litros !== null) ? (
                    <GraficoProduccion dias={diasGrafico} promedioBase={tendenciaAnimal?.litros_base ?? null} />
                  ) : null}
                </div>
              ) : null}
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-[0.9375rem] text-humo">Todavía no está en ordeño. Si ya da leche, ponla en el ordeño para registrar sus litros.</p>
                {puedeEscribir(rol, "leche") && animal.estado === "activo" ? (
                  <Link href={`/hato?vista=ordeno&agregar=${id}`} className={clasesBoton("secundario")}>
                    Poner en ordeño
                  </Link>
                ) : null}
              </div>
            )}
          </Tarjeta>
        ) : null}

        {mostrarRepro ? (
          <Tarjeta titulo="Reproducción" id="reproduccion">
            {sin_crear ? (
              <Aviso tipo="atencion" className="mb-3">
                El parto quedó registrado, pero no se pudieron crear como animales las crías con arete {sin_crear.split(",").join(", ")}. Créalas desde «Animal nuevo» (ponle a esta hembra como madre).
              </Aviso>
            ) : null}
            {repro ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Insignia tono={TONO_ESTADO[repro.estado]}>{ETIQUETA_ESTADO[repro.estado]}</Insignia>
                  {repro.fecha_prevista_parto ? <Insignia tono={plazoParto(repro.fecha_prevista_parto, hoyBogota()).tono}>{plazoParto(repro.fecha_prevista_parto, hoyBogota()).texto}</Insignia> : null}
                  {repro.en_lactancia ? <Insignia tono="musgo">En lactancia</Insignia> : null}
                  {repro.empadronamiento_id ? <Insignia tono="aviso">En empadronamiento</Insignia> : null}
                </div>
                <dl className="divide-y divide-arena">
                  {repro.empadronamiento_id ? (
                    <Dato etiqueta="Temporada de monta">
                      <Link href={`/reproduccion/empadronamiento/${repro.empadronamiento_id}`} className="text-musgo underline-offset-4 hover:underline">{repro.empadronamiento_nombre}</Link>
                    </Dato>
                  ) : null}
                  {repro.fecha_prevista_parto ? <Dato etiqueta="Parto previsto">{formatoFecha(repro.fecha_prevista_parto)}</Dato> : null}
                  {repro.ultimo_servicio ? <Dato etiqueta="Último servicio">{formatoFecha(repro.ultimo_servicio)}</Dato> : null}
                  {repro.ultimo_parto ? <Dato etiqueta="Último parto">{formatoFecha(repro.ultimo_parto)}</Dato> : null}
                  <Dato etiqueta="Partos">{textoPartos(repro.partos_totales)}</Dato>
                </dl>
                {repro.estado === "servida" && repro.ultimo_servicio && diasHasta(hoyBogota(), repro.ultimo_servicio) >= DIAS_PARA_DIAGNOSTICO ? (
                  <Aviso tipo="atencion">Ya pasaron {diasHasta(hoyBogota(), repro.ultimo_servicio)} días del servicio: conviene confirmar con un diagnóstico si quedó gestante.</Aviso>
                ) : null}
                {animal.estado === "activo" ? <PartosPrevios animalId={id} previos={animal.partos_previos} registrados={repro.partos_registrados} puedeEditar={puedeEscribir(rol, "hato")} /> : null}
              </div>
            ) : null}
            {historialRepro.length > 0 ? (
              <ul className="mt-3 divide-y divide-arena">
                {historialRepro.map((e) => (
                  <li key={e.clave} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 text-[0.9375rem] [overflow-wrap:anywhere]">
                      <span className="font-semibold">{e.texto}</span>
                      <span className="block text-sm text-humo">{formatoFecha(e.fecha, { day: "numeric", month: "short", year: "numeric" })}</span>
                    </span>
                    {puedeEscribir(rol, "reproduccion") ? (
                      <Link href={e.href} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                        Editar
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[0.9375rem] text-humo">Todavía no tiene servicios, diagnósticos ni partos registrados.</p>
            )}
            {todoRepro.length > historialRepro.length ? (
              <p className="mt-1 text-sm text-humo">
                Se muestran los {historialRepro.length} más recientes. Todos están en{" "}
                <Link href="/reproduccion?vista=servicios" className="font-semibold text-musgo underline-offset-4 hover:underline">
                  Reproducción
                </Link>
                .
              </p>
            ) : null}
            {puedeEscribir(rol, "reproduccion") && animal.estado === "activo" ? (
              <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                <Link href={`/hato/${id}/reproduccion/servicio/nuevo`} className={clasesBoton("secundario")}>
                  Servicio
                </Link>
                <Link href={`/hato/${id}/reproduccion/diagnostico/nuevo`} className={clasesBoton("secundario")}>
                  Diagnóstico
                </Link>
                <Link href={`/hato/${id}/reproduccion/parto/nuevo`} className={clasesBoton("secundario")}>
                  Parto
                </Link>
              </div>
            ) : null}
          </Tarjeta>
        ) : null}

        {verLeche && (lac || analisisLeche.length > 0) ? (
          <Tarjeta titulo="Calidad de la leche" id="calidad">
            {analisisLeche.length === 0 ? (
              <p className="text-[0.9375rem] text-humo">Todavía no tiene análisis de grasa, proteína ni células somáticas.</p>
            ) : (
              <ul className="divide-y divide-arena">
                {analisisLeche.map((a) => {
                  const rcs = a.rcs_miles_ml != null ? estadoRcs(a.rcs_miles_ml) : null;
                  return (
                    <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        <span className="block font-semibold">{formatoFecha(a.fecha)}{a.laboratorio ? ` · ${a.laboratorio}` : ""}</span>
                        <span className="block text-sm text-humo">
                          {[
                            a.grasa_pct != null ? `Grasa ${a.grasa_pct.toLocaleString("es-CO")} %` : null,
                            a.proteina_pct != null ? `Proteína ${a.proteina_pct.toLocaleString("es-CO")} %` : null,
                            a.rcs_miles_ml != null ? `Células ${formatoMiles(a.rcs_miles_ml)}` : null,
                          ].filter(Boolean).join(" · ")}
                        </span>
                        {rcs ? <span className="mt-1 block"><Insignia tono={rcs.tono}>{`Células somáticas: ${rcs.texto.toLowerCase()}`}</Insignia></span> : null}
                        {a.soporte_path ? (
                          <a href={direccionSoporte(a.soporte_path)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-8 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                            Ver documento
                          </a>
                        ) : (
                          <span className="mt-1 block"><Insignia tono="aviso">Sin documento</Insignia></span>
                        )}
                      </span>
                      {puedeEscribir(rol, "leche") ? (
                        <Link href={`/leche/calidad/${a.id}`} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                          Editar
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {verSanidad ? (
              <p className="mt-2 text-sm text-humo">
                {ultimoCmt ? (
                  <>Último CMT: <strong>{ETIQUETA_RESULTADO_PRUEBA[ultimoCmt.resultado]}</strong> el {formatoFecha(ultimoCmt.fecha)}.</>
                ) : (
                  "Todavía no tiene CMT registrado (se anota en Prueba diagnóstica)."
                )}
              </p>
            ) : null}
            {puedeEscribir(rol, "leche") && animal.estado === "activo" ? (
              <Link href={`/hato/${id}/calidad/nuevo`} className={`${clasesBoton("secundario")} mt-3`}>
                Registrar análisis
              </Link>
            ) : null}
          </Tarjeta>
        ) : null}

        {mostrarCrecimiento ? (
          <Tarjeta titulo="Peso y ceba" id="crecimiento">
            {miCandidato && reglaCandidato ? (
              <AvisoCandidatoCeba
                animalId={id}
                sexo={animal.sexo}
                usoMacho={animal.uso_macho}
                nivel={miCandidato.nivel}
                motivos={textosMotivos(miCandidato, reglaCandidato)}
                advertencias={textosAdvertencias(miCandidato, reglaCandidato, hoy)}
                puedeEditar={puedeEscribir(rol, "carne") && puedeEscribir(rol, "hato")}
              />
            ) : null}
            {animal.ceba_pospuesto_hasta && animal.ceba_pospuesto_hasta > hoy && animal.estado === "activo" ? (
              <AplazadoCeba animalId={id} hasta={animal.ceba_pospuesto_hasta} puedeEditar={puedeEscribir(rol, "carne") && puedeEscribir(rol, "hato")} />
            ) : null}
            <dl className="divide-y divide-arena">
              {animal.peso_nacer_kg ? <Dato etiqueta="Peso al nacer">{litros(animal.peso_nacer_kg)} kg</Dato> : null}
              <Dato etiqueta="Último peso">
                {miCeba?.peso_ultimo != null && miCeba.n_pesajes > 0 ? `${kg(miCeba.peso_ultimo)} · ${formatoFecha(miCeba.fecha_ultimo, { day: "numeric", month: "short", year: "numeric" })}` : "Sin pesos todavía"}
              </Dato>
              {miCeba?.gdp_total_g != null ? <Dato etiqueta="Ganancia por día">{gdp(miCeba.gdp_total_g)}</Dato> : null}
              {miCeba?.gdp_reciente_g != null && miCeba.gdp_reciente_g !== miCeba.gdp_total_g ? <Dato etiqueta="Entre los dos últimos pesos">{gdp(miCeba.gdp_reciente_g)}</Dato> : null}
              {miLote ? (
                <Dato etiqueta="Lote de ceba">
                  <Link href={`/carne/lotes/${miLote.id}`} className="font-semibold text-musgo underline-offset-4 hover:underline [overflow-wrap:anywhere]">
                    {miLote.nombre}
                  </Link>
                </Dato>
              ) : null}
              {miLote?.peso_meta_kg != null && miCeba?.peso_ultimo != null ? (
                <Dato etiqueta="Meta del lote">
                  {Number(miCeba.peso_ultimo) >= Number(miLote.peso_meta_kg) ? <Insignia tono="ok">Listo para beneficio</Insignia> : `Faltan ${kg(faltaParaMeta(miCeba.peso_ultimo, miLote.peso_meta_kg))} para ${kg(miLote.peso_meta_kg)}`}
                </Dato>
              ) : null}
            </dl>
            {miCeba && miCeba.n_pesajes > 0 && miCeba.gdp_total_g == null ? (
              <p className="mt-2 text-sm text-humo">La ganancia por día se calcula con dos pesos separados al menos 7 días.</p>
            ) : null}
            {listaPesos.length > 0 ? (
              <ul className="mt-3 divide-y divide-arena">
                {listaPesos.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 text-[0.9375rem] [overflow-wrap:anywhere]">
                      <span className="font-semibold">{kg(p.peso_kg)}</span>
                      <span className="text-humo"> · {formatoFecha(p.fecha, { day: "numeric", month: "short", year: "numeric" })}{p.tipo !== "control" ? ` · ${ETIQUETA_PESAJE[p.tipo]}` : ""}{p.condicion_corporal != null ? ` · CC ${textoCC(p.condicion_corporal)}` : ""}</span>
                    </span>
                    {puedeEscribir(rol, "carne") ? (
                      <Link href={`/carne/pesajes/${p.id}`} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                        Editar
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {listaPesos.length > 8 ? <p className="mt-1 text-sm text-humo">Y {listaPesos.length - 8} pesos más en Carne → Pesos.</p> : null}
            {puedeEscribir(rol, "carne") && animal.estado === "activo" ? (
              <div className="mt-3 space-y-3">
                {esCeba || miLote || miCandidato ? <LoteAnimal animalId={id} loteId={miLote && !miLote.cerrado_en ? miLote.id : null} lotes={lotesCeba.filter((l) => !l.cerrado_en).map((l) => ({ id: l.id, nombre: l.nombre }))} /> : null}
                <Link href={`/hato/${id}/peso/nuevo`} className={clasesBoton("secundario")}>
                  Registrar peso
                </Link>
              </div>
            ) : null}
          </Tarjeta>
        ) : null}

        {verGenealogia ? (
          <Tarjeta titulo="Genealogía">
            <dl className="divide-y divide-arena">
              <Dato etiqueta="Padre">
                {padre ? (
                  <Link href={`/hato/${padre.id}`} className="text-musgo underline-offset-4 hover:underline">
                    {padre.nombre ? `${padre.nombre} · ${padre.numero_arete}` : padre.numero_arete}
                  </Link>
                ) : (
                  (animal.padre_externo ?? "Sin registrar")
                )}
              </Dato>
              <Dato etiqueta="Madre">
                {madre ? (
                  <Link href={`/hato/${madre.id}`} className="text-musgo underline-offset-4 hover:underline">
                    {madre.nombre ? `${madre.nombre} · ${madre.numero_arete}` : madre.numero_arete}
                  </Link>
                ) : (
                  (animal.madre_externa ?? "Sin registrar")
                )}
              </Dato>
              {parentescoPadres ? <Dato etiqueta="Parentesco de sus padres">{primeraMayuscula(parentescoPadres.relacion)}</Dato> : null}
              {f !== null ? (
                <Dato etiqueta="Endogamia (F)">
                  <span className="inline-flex flex-wrap items-center justify-end gap-2">
                    <span className="tabular-nums">{porcentaje(f)}</span>
                    <NivelEndogamia f={f} umbral={finca.umbral_endogamia} />
                  </span>
                </Dato>
              ) : null}
              <Dato etiqueta="Pedigrí conocido">
                {pedigriTexto(pedigri)} · {Math.round(pedigri * 100)} %
              </Dato>
            </dl>
            {alertaEndogamia ? (
              <Aviso tipo="atencion" className="mt-3">
                La endogamia supera el umbral de tu finca ({porcentaje(finca.umbral_endogamia)}). Conviene evitar repetir esta cruza.
              </Aviso>
            ) : null}
            {pedigri < 0.5 ? (
              <Aviso tipo="info" className="mt-3">
                {pedigri === 0
                  ? "Todavía no hay padres registrados, por eso no se puede medir la endogamia."
                  : "Con pocos ancestros registrados el cálculo puede quedarse corto. Completa el pedigrí para que sea más confiable."}
              </Aviso>
            ) : null}
            {animal.estado === "activo" ? (
              <Link
                href={animal.sexo === "macho" ? `/hato/cruza?macho=${id}` : `/hato/cruza?hembra=${id}`}
                className={`${clasesBoton("secundario")} mt-3`}
              >
                Simular una cruza
              </Link>
            ) : null}
          </Tarjeta>
        ) : null}

        {f !== null && f > 0 ? (
          <Tarjeta titulo="¿Por qué hay endogamia?">
            <p className="mb-3 text-[0.9375rem] text-humo">
              {animal.nombre ?? animal.numero_arete} tiene ancestros repetidos: animales que aparecen tanto por el lado del padre como por el de la madre.
              Esta es la ruta desde cada uno de ellos hasta el ancestro.
            </p>
            <RutasEndogamia filas={origen} />
          </Tarjeta>
        ) : null}

        {verSanidad && (animal.estado === "activo" || historialEventos.length > 0 || historialPruebas.length > 0) ? (
          <Tarjeta titulo="Sanidad" id="sanidad">
            {dosisPendientes.length > 0 ? (
              <ul className="mb-3 space-y-2">
                {dosisPendientes.map((d) => {
                  const e = estadoDosis(d.proxima_fecha ?? hoyBogota(), hoyBogota());
                  return (
                    <li key={d.evento_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-lana px-3 py-2.5">
                      <span className="min-w-0 text-[0.9375rem]">
                        <span className="font-semibold [overflow-wrap:anywhere]">{nombreEvento({ tipo: d.tipo, producto_nombre: d.producto_nombre })}</span>
                        <span className="block text-sm text-humo">Próxima dosis · {formatoFecha(d.proxima_fecha, { day: "numeric", month: "short" })}</span>
                      </span>
                      <Insignia tono={e.tono}>{e.texto}</Insignia>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {programasAnimal.length > 0 ? (
              <ul className="mb-3 space-y-2">
                {programasAnimal.map((p) => {
                  const e = estadoFechaPrograma(p.fecha_programada, hoyBogota());
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-lana px-3 py-2.5">
                      <span className="min-w-0 text-[0.9375rem]">
                        <span className="font-semibold [overflow-wrap:anywhere]">{p.producto_nombre?.trim() || ETIQUETA_EVENTO[p.tipo]}</span>
                        <span className="block text-sm text-humo">Programada · {formatoFecha(p.fecha_programada, { day: "numeric", month: "short" })}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Insignia tono={e.tono}>{e.texto}</Insignia>
                        {puedeEscribir(rol, "sanidad") && animal.estado === "activo" ? (
                          <Link href={`/hato/sanidad/nuevo?programa=${p.id}&animal=${id}`} className="inline-flex min-h-11 items-center rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo">
                            Aplicar
                          </Link>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {historialEventos.length === 0 && historialPruebas.length === 0 ? (
              <p className="text-[0.9375rem] text-humo">Todavía no tiene vacunas, tratamientos ni pruebas registrados.</p>
            ) : (
              <HistorialSanidadAnimal eventos={historialEventos} pruebas={historialPruebas} puedeEditar={puedeEscribir(rol, "sanidad")} />
            )}
            {puedeEscribir(rol, "sanidad") && animal.estado === "activo" ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-sm font-semibold">Registrar lo que se le aplicó</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {TIPOS_EVENTO.filter((t) => t !== "otro").map((t) => (
                      <Link key={t} href={`/hato/sanidad/nuevo?animal=${id}&tipo=${t}`} className={clasesBoton("secundario")}>
                        {ETIQUETA_EVENTO[t]}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  <Link href={`/hato/sanidad/programar?animal=${id}`} className={clasesBoton("secundario")}>
                    Programar una aplicación
                  </Link>
                  <Link href={`/sanidad/pruebas/nueva?animal=${id}`} className={clasesBoton("secundario")}>
                    Prueba diagnóstica
                  </Link>
                </div>
              </div>
            ) : null}
          </Tarjeta>
        ) : null}

        {verFerias && (animal.estado === "activo" || listaPremios.length > 0) ? (
          <Tarjeta titulo="Ferias y premios" id="premios">
            {listaPremios.length === 0 ? (
              <p className="text-[0.9375rem] text-humo">Todavía no tiene participaciones en ferias.</p>
            ) : (
              <>
                <dl className="mb-3 grid grid-cols-3 divide-x divide-arena text-center">
                  {[
                    ["Ferias", palmares.data?.participaciones ?? 0],
                    ["Premios", palmares.data?.premios ?? 0],
                    ["Campeonatos", palmares.data?.campeonatos ?? 0],
                  ].map(([etiqueta, valor]) => (
                    <div key={etiqueta} className="min-w-0 px-1">
                      <dd className="font-display text-2xl font-semibold tabular-nums">{valor}</dd>
                      <dt className="text-xs font-medium text-humo">{etiqueta}</dt>
                    </div>
                  ))}
                </dl>
                <ul className="grid grid-cols-1 gap-2.5">
                  {listaPremios.map((p) => {
                    const f = ferias.get(p.feria_id);
                    return (
                      <li key={p.id} className="min-w-0">
                        <FilaParticipacion
                          p={p}
                          titulo={f?.nombre ?? "Feria"}
                          detalle={f ? formatoFecha(f.fecha_inicio) : undefined}
                          enlace={`/ferias/${p.feria_id}`}
                          fotoUrl={p.foto_path ? fotosPremios.get(p.foto_path) : undefined}
                          editar={puedeEscribir(rol, "ferias") ? `/ferias/participacion/${p.id}/editar` : undefined}
                        />
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {puedeEscribir(rol, "ferias") && animal.estado === "activo" ? (
              <Link href={`/ferias/participacion/nueva?animal=${id}`} className={`${clasesBoton("secundario")} mt-3`}>
                Registrar premio
              </Link>
            ) : null}
          </Tarjeta>
        ) : null}

        {animal.notas ? (
          <Tarjeta titulo="Notas">
            <p className="whitespace-pre-wrap text-[0.9375rem]">{animal.notas}</p>
          </Tarjeta>
        ) : null}

        {animal.estado !== "activo" ? (
          <Tarjeta titulo="Salida del hato" id="salida">
            <dl className="divide-y divide-arena">
              <Dato etiqueta="Qué pasó">{baja.data ? ETIQUETA_TIPO_BAJA[baja.data.tipo] : animal.estado[0].toUpperCase() + animal.estado.slice(1)}</Dato>
              <Dato etiqueta="Fecha">{formatoFecha(baja.data?.fecha ?? animal.fecha_baja)}</Dato>
              {baja.data?.motivo ? <Dato etiqueta="Motivo">{ETIQUETA_MOTIVO_BAJA[baja.data.motivo]}</Dato> : null}
              {baja.data?.comprador ? <Dato etiqueta="Comprador">{baja.data.comprador}</Dato> : null}
              {baja.data?.valor ? <Dato etiqueta="Valor">{pesos(baja.data.valor)}</Dato> : null}
              {baja.data?.peso_kg ? <Dato etiqueta="Peso en vivo">{kg(baja.data.peso_kg)}</Dato> : null}
              {baja.data?.guia_movilizacion ? <Dato etiqueta="Guía de movilización">{baja.data.guia_movilizacion}</Dato> : null}
              {baja.data?.destino ? <Dato etiqueta={baja.data.tipo === "sacrificio" ? "Lugar del beneficio" : "Destino"}>{baja.data.destino}</Dato> : null}
              {baja.data?.tipo === "sacrificio" || (baja.data?.tipo === "venta" && baja.data.destino_consumo) ? (
                <Dato etiqueta="Carne">Para consumo</Dato>
              ) : baja.data?.tipo === "muerte" ? (
                <Dato etiqueta="Carne">No apta para consumo</Dato>
              ) : null}
            </dl>
            {baja.data?.detalle ? <p className="mt-3 whitespace-pre-wrap text-[0.9375rem] text-humo">{baja.data.detalle}</p> : null}
            {baja.data && puedeEscribir(rol, "hato") ? (
              <Link href={`/hato/${id}/baja/editar`} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                Corregir datos de la salida
              </Link>
            ) : null}
            {verCarne && aplicanControles.length > 0 ? (
              <div className="mt-3 space-y-2 border-t border-arena pt-3">
                <p className="text-sm font-semibold">Controles de calidad</p>
                <p>
                  <Insignia tono={etiquetaControles.tono}>{etiquetaControles.texto}</Insignia>
                </p>
                <Link href={`/hato/${id}/controles`} className={clasesBoton("secundario")}>
                  {puedeEscribir(rol, "carne") ? "Responder los controles" : "Ver los controles"}
                </Link>
              </div>
            ) : null}
            {baja.data?.tipo === "sacrificio" && verCarne ? (
              <div className="mt-3 space-y-2 border-t border-arena pt-3">
                <p className="text-sm font-semibold">Canal</p>
                {canal ? (
                  <dl className="divide-y divide-arena">
                    <Dato etiqueta="Canal caliente">{kg(canal.peso_canal_caliente_kg)}</Dato>
                    {canal.rendimiento_caliente_pct != null ? <Dato etiqueta="Rendimiento">{pctUno(canal.rendimiento_caliente_pct)}</Dato> : null}
                    {canal.peso_canal_fria_kg != null ? (
                      <Dato etiqueta="Canal fría">
                        {kg(canal.peso_canal_fria_kg)}
                        {canal.rendimiento_frio_pct != null ? ` · ${pctUno(canal.rendimiento_frio_pct)}` : ""}
                      </Dato>
                    ) : null}
                    {canal.merma_oreo_pct != null ? <Dato etiqueta="Merma al enfriar">{pctUno(canal.merma_oreo_pct)}</Dato> : null}
                    {canal.conformacion ? <Dato etiqueta="Conformación">{ETIQUETA_CONFORMACION[canal.conformacion]}</Dato> : null}
                    {canal.engrasamiento ? <Dato etiqueta="Engrasamiento">{ETIQUETA_ENGRASAMIENTO[canal.engrasamiento]}</Dato> : null}
                    {canal.grasa_dorsal_mm != null ? <Dato etiqueta="Grasa dorsal">{litros(canal.grasa_dorsal_mm)} mm</Dato> : null}
                    {canal.grasa_visceral ? <Dato etiqueta="Grasa visceral">{ETIQUETA_GRASA_VISCERAL[canal.grasa_visceral]}</Dato> : null}
                    {canal.planta ? <Dato etiqueta="Planta">{canal.planta}</Dato> : null}
                  </dl>
                ) : (
                  <p className="text-[0.9375rem] text-humo">Todavía no tiene la canal registrada. Con el peso de la canal se calcula el rendimiento.</p>
                )}
                {puedeEscribir(rol, "carne") ? (
                  <Link href={canal ? `/carne/canales/${canal.id}` : `/hato/${id}/canal/nuevo`} className={clasesBoton("secundario")}>
                    {canal ? "Editar canal" : "Registrar canal"}
                  </Link>
                ) : null}
              </div>
            ) : null}
            {puedeGestionar(rol) ? (
              <div className="mt-3">
                <DeshacerBaja animalId={id} etiqueta={animal.nombre ?? animal.numero_arete} esHembra={animal.sexo === "hembra"} />
              </div>
            ) : null}
          </Tarjeta>
        ) : puedeEscribir(rol, "hato") ? (
          <Tarjeta titulo="Salida del hato">
            <p className="text-[0.9375rem] text-humo">
              Si se vendió, murió, se sacrificó o se perdió, regístralo para sacarlo del hato{animal.sexo === "hembra" ? " y del ordeño" : ""}. Puedes deshacerlo después.
            </p>
            <Link href={`/hato/${id}/baja`} className={`${clasesBoton("secundario")} mt-3`}>
              Dar de baja
            </Link>
          </Tarjeta>
        ) : null}
      </div>
    </>
  );
}
