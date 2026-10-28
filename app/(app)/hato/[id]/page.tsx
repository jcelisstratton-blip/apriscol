import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { VisorFoto } from "@/components/VisorFoto";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { obtenerContexto } from "@/lib/contexto";
import { ETIQUETA_USO_MACHO, ETIQUETA_VOCACION, nombreTipo } from "@/lib/animal";
import { edadTexto, formatoFecha, hoyBogota, litros } from "@/lib/fechas";
import { urlsFotos } from "@/lib/fotos";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { CtxFicha } from "./fichas/contexto";
import { Dato } from "./fichas/Dato";
import { TarjetaCalidadLeche } from "./fichas/TarjetaCalidadLeche";
import { TarjetaCostos } from "./fichas/TarjetaCostos";
import { TarjetaCrecimiento } from "./fichas/TarjetaCrecimiento";
import { TarjetaLactancia } from "./fichas/TarjetaLactancia";
import { TarjetaPremios } from "./fichas/TarjetaPremios";
import { TarjetaReproduccion } from "./fichas/TarjetaReproduccion";
import { TarjetaSalida } from "./fichas/TarjetaSalida";
import { TarjetaSanidad } from "./fichas/TarjetaSanidad";
import { EtapaAnimal } from "./fichas/EtapaAnimal";
import { TarjetaNovedades } from "./fichas/TarjetaNovedades";
import { TarjetaUbicacion } from "./fichas/TarjetaUbicacion";
import { TarjetasGenealogia } from "./fichas/TarjetasGenealogia";

export const metadata: Metadata = { title: "Animal" };

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La ficha: cabecera, aviso de retiro, datos y notas se arman aquí; el resto son tarjetas que cargan lo suyo (`./fichas`). */
export default async function FichaAnimal({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string; sin_crear?: string }> }) {
  const { id } = await params;
  const { guardado, sin_crear: sinCrearBruto } = await searchParams;
  // Aretes de crías que no se pudieron crear (viene en la dirección: se limpia para mostrar solo texto simple).
  const sin_crear = (sinCrearBruto ?? "").replace(/[^\p{L}\p{N}*\-_., ]/gu, "").slice(0, 200);
  if (!ID_UUID.test(id)) notFound();

  const { finca, rol } = await obtenerContexto();
  const ajustes = await obtenerAjustes();
  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("*").eq("id", id).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!animal) notFound();

  const verLeche = puedeVer(rol, "leche", finca.plan) && animal.sexo === "hembra";
  const [raza, lactancia, retiro, fotosAnimal] = await Promise.all([
    animal.raza_id ? supabase.from("razas").select("nombre").eq("id", animal.raza_id).maybeSingle() : Promise.resolve({ data: null }),
    verLeche
      ? supabase.from("v_lactancias_resumen").select("*").eq("animal_id", id).order("numero", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("animales_en_retiro", { p_finca: finca.id }),
    urlsFotos(supabase, "fotos-animales", [animal.foto_path]),
  ]);
  const fotoAnimal = animal.foto_path ? fotosAnimal.get(animal.foto_path) : undefined;
  const miRetiro = retiro.data?.find((r) => r.animal_id === id);
  const lac = lactancia.data;
  const lacAbierta = lac && !lac.fecha_secado;
  const c: CtxFicha = { id, animal, finca, rol, ajustes, supabase, hoy: hoyBogota() };

  return (
    <>
      <AvisoGuardado activo={guardado === "1"} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <Link href="/hato" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
          <ChevronLeft className="size-5" strokeWidth={2} /> Hato
        </Link>
        {puedeEscribir(rol, "hato", finca.plan) ? (
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
            <EtapaAnimal c={c} />
            <Dato etiqueta="Origen">{animal.origen === "comprado" ? "Comprado" : "Nació en la finca"}</Dato>
            {animal.chip ? <Dato etiqueta="Microchip">{animal.chip}</Dato> : null}
            {animal.color ? <Dato etiqueta="Color">{animal.color}</Dato> : null}
            {animal.rasgos ? <Dato etiqueta="Rasgos">{animal.rasgos}</Dato> : null}
            {animal.marcas ? <Dato etiqueta="Marcas">{animal.marcas}</Dato> : null}
            {animal.peso_nacer_kg ? <Dato etiqueta="Peso al nacer">{litros(animal.peso_nacer_kg)} kg</Dato> : null}
          </dl>
        </Tarjeta>

        <TarjetaNovedades c={c} />

        <TarjetaLactancia c={c} lac={lac} />
        <TarjetaReproduccion c={c} sinCrear={sin_crear} />
        <TarjetaCalidadLeche c={c} lac={lac} />
        <TarjetaCrecimiento c={c} />
        <TarjetasGenealogia c={c} />
        <TarjetaSanidad c={c} />
        <TarjetaUbicacion c={c} />
        <TarjetaCostos c={c} />
        <TarjetaPremios c={c} />

        {animal.notas ? (
          <Tarjeta titulo="Notas">
            <p className="whitespace-pre-wrap text-[0.9375rem]">{animal.notas}</p>
          </Tarjeta>
        ) : null}

        <TarjetaSalida c={c} />
      </div>
    </>
  );
}
