import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Droplets, FlaskConical, Layers, Moon, PawPrint, Smartphone, Tags, Trophy, Users, Warehouse, Beef, Hand, Keyboard, Download, Sprout, Building2, UserPlus } from "lucide-react";
import { CarruselCubre } from "@/components/presentacion/CarruselCubre";
import { Planes } from "@/components/presentacion/Planes";
import { PLANES, usd } from "@/lib/planes";
import { PieLegal } from "@/components/legal/PieLegal";
import { Isotipo, Marca } from "@/components/Marca";
import { Escena } from "@/components/TarjetaOpcion";
import { REPORTES } from "@/lib/costos-reportes";
import { RUBROS } from "@/lib/costos";
import { ESCENA_HATO, type EscenaDef } from "@/lib/escenas";
import { ETIQUETA_ROL } from "@/lib/permisos";

/** El rótulo pequeño de cada sección: monoespaciado, en mayúsculas y con el ocre de la marca. */
function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-ocre">{children}</p>;
}

function Seccion({ id, rotulo, titulo, texto, children }: { id?: string; rotulo: string; titulo: string; texto?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-2xl space-y-2.5">
        <Rotulo>{rotulo}</Rotulo>
        <h2 className="font-display text-[1.75rem] font-semibold leading-[1.1] tracking-tight sm:text-4xl">{titulo}</h2>
        {texto ? <p className="text-[1.0625rem] text-humo">{texto}</p> : null}
      </div>
      <div className="mt-7">{children}</div>
    </section>
  );
}

/** Una tarjeta numerada, como las de «Del contenido a la publicación»: número en mono, título y una línea. */
function Paso({ n, icono, titulo, texto }: { n: string; icono: React.ReactNode; titulo: string; texto: string }) {
  return (
    <li className="min-w-0 rounded-3xl bg-papel p-4 ring-1 ring-arena">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm font-semibold text-ocre">{n}</span>
        <span className="grid size-9 place-items-center rounded-2xl bg-musgo/10 text-musgo">{icono}</span>
      </div>
      <h3 className="mt-3 font-display text-lg font-semibold leading-tight">{titulo}</h3>
      <p className="mt-1 text-[0.9375rem] text-humo">{texto}</p>
    </li>
  );
}

type Funcion = { n: string; escena: EscenaDef; titulo: string; lema: string; puntos: string[] };
const FUNCIONES: Funcion[] = [
  { n: "01", escena: ESCENA_HATO.todos, titulo: "Hato y genealogía", lema: "Cada animal, con su historia", puntos: ["Ficha con foto, edad, estado y padres", "La endogamia se calcula antes de cruzar", "Trae tus animales del libro genealógico"] },
  { n: "02", escena: ESCENA_HATO.ordeno, titulo: "Leche", lema: "Del ordeño al tanque", puntos: ["Ordeño por jornada y por turnos", "Calidad, despachos y frío del tanque", "La leche en retiro se marca como descartada"] },
  { n: "03", escena: ESCENA_HATO.sanidad, titulo: "Sanidad", lema: "Vacunas, tratamientos y retiros", puntos: ["Programa para un lote y aplica el día que toca", "FAMACHA y pediluvio por animal", "Periodos de retiro de leche y de carne"] },
  { n: "04", escena: ESCENA_HATO.empadronamiento, titulo: "Reproducción", lema: "Monta, gestación y partos", puntos: ["Temporada de monta con control de endogamia", "Fecha prevista de parto de cada hembra", "Partos, crías y lactancias al día"] },
  { n: "05", escena: ESCENA_HATO.corrales, titulo: "Corrales", lema: "Cada animal en su sitio", puntos: ["No deja llenar un corral de más", "Rotación de potreros con días de descanso", "Cuarentena de los animales que llegan"] },
  { n: "06", escena: ESCENA_HATO.gastos, titulo: "Costos", lema: "Cuánto cuesta cada litro", puntos: ["Gastos por rubro y a quién se cargan", "Costo por litro y por animal", "Reportes en Excel por las fechas que quieras"] },
];

const PASOS = [
  { n: "01", icono: <PawPrint className="size-5" strokeWidth={1.75} />, titulo: "Registra", texto: "El animal, con su arete, su raza y sus padres." },
  { n: "02", icono: <Droplets className="size-5" strokeWidth={1.75} />, titulo: "Mide", texto: "Litros por jornada, peso y ganancia diaria." },
  { n: "03", icono: <FlaskConical className="size-5" strokeWidth={1.75} />, titulo: "Cuida", texto: "Vacunas, tratamientos, pruebas y retiros." },
  { n: "04", icono: <Layers className="size-5" strokeWidth={1.75} />, titulo: "Reproduce", texto: "Monta, gestación, parto y cría." },
  { n: "05", icono: <Tags className="size-5" strokeWidth={1.75} />, titulo: "Decide", texto: "Costos, resultado y reportes en Excel." },
];

const PREGUNTAS: { p: string; r: string }[] = [
  { p: "¿Sirve para cabras y para ovejas?", r: "Sí, para las dos: en la misma finca o por separado. Cada una tiene sus parámetros, como la edad de ceba o el máximo de hembras por semental." },
  { p: "¿Se puede usar desde el celular?", r: "Está pensada primero para el celular, con botones grandes y teclado propio para los números. En el computador te da un menú lateral y más espacio." },
  { p: "¿Puedo traer mis animales de un libro genealógico?", r: "Sí. Si tus animales están en el libro genealógico, los traes una sola vez al crear tu cuenta, demostrando que son tuyos con el documento del titular y el microchip de uno de ellos." },
  { p: "¿Quién ve la información de mi finca?", r: "Solo quienes tú invites. Los datos están separados por finca, y cada persona ve únicamente lo que le toca según su rol." },
  { p: "¿Puedo invitar al ordeñador, al veterinario y al contador?", r: "Sí. El ordeñador registra leche, el veterinario maneja sanidad, reproducción y corrales, y el contador ve y registra costos." },
  { p: "¿Cuánto cuesta?", r: `Hay cuatro planes, de ${usd(PLANES[0].mensual)} a ${usd(PLANES[PLANES.length - 1].mensual)} al mes, según los servicios que uses, sin importar cuántos animales tengas. Pagando por año tienes 20 % de descuento. Los ves completos en la sección Planes.` },
  { p: "¿Puedo sacar reportes?", r: "Los reportes de costos se descargan en Excel con el periodo que elijas, y el archivo lleva el nombre de la finca, del reporte y las fechas." },
];

/**
 * La pantalla de entrada de Apriscol: una presentación completa (qué resuelve, cómo se empieza, quién ve qué, preguntas) con el formulario de
 * acceso en la tarjeta de arriba. La usan `/login` y `/registro`; cambia el formulario y el texto de la tarjeta.
 */
export function Presentacion({ modo, formulario }: { modo: "login" | "registro"; formulario: React.ReactNode }) {
  const esRegistro = modo === "registro";
  const hrefCrear = esRegistro ? "#acceso" : "/registro";
  const cifras: [string, string][] = [
    ["2", "especies: cabras y ovejas"],
    ["9", "áreas del manejo en una sola app"],
    [String(RUBROS.length), "rubros de gasto para saber cuánto cuesta cada litro"],
    [String(REPORTES.length), "reportes que se descargan en Excel"],
  ];

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:px-6">
        <nav aria-label="Principal" className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full bg-papel/85 py-1.5 pl-4 pr-1.5 shadow-sm ring-1 ring-arena backdrop-blur">
          <Link href={esRegistro ? "/registro" : "/login"} aria-label="Apriscol, inicio" className="shrink-0 whitespace-nowrap">
            <Marca />
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {[
              ["#que-resuelve", "Qué resuelve"],
              ["#como-funciona", "Cómo funciona"],
              ["#equipo", "Tu equipo"],
              ["#planes", "Planes"],
              ["#preguntas", "Preguntas"],
            ].map(([href, texto]) => (
              <a key={href} href={href} className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold text-humo hover:text-tinta">
                {texto}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Link href={esRegistro ? "/login" : "#acceso"} className="hidden min-h-10 items-center whitespace-nowrap rounded-full px-3 text-sm font-semibold text-musgo min-[400px]:inline-flex">
              Entrar
            </Link>
            <Link href={esRegistro ? "#acceso" : "/registro"} className="inline-flex min-h-10 items-center whitespace-nowrap rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo hover:brightness-110">
              Crear cuenta
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Portada y acceso */}
        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 pb-8 pt-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-12 lg:pt-14">
          <div className="min-w-0 space-y-6">
            <Isotipo className="size-24 sm:size-28" prioridad />
            <Rotulo>Para criadores de cabras y ovejas</Rotulo>
            <h1 className="font-display text-[2.375rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl">
              Registra una vez. <span className="text-musgo">Tu aprisco, al día.</span>
            </h1>
            <p className="max-w-xl text-[1.0625rem] text-humo sm:text-lg">
              Hato, genealogía, leche, sanidad, partos, corrales, carne y costos en un solo lugar. Hecho para usarlo en el corral, con una mano, desde el celular.
            </p>
            <ul className="space-y-2.5 text-[0.9375rem] sm:text-base">
              {[
                "Cada animal con su historia: genealogía, endogamia, leche y sanidad",
                "Avisa los periodos de retiro: la leche tratada no llega al tanque",
                "Corrales con cupo, rotación de potreros y cuarentena",
                "Costos por litro y por animal, y reportes en Excel por cualquier fecha",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <Check className="mt-1 size-4 shrink-0 text-musgo" strokeWidth={2.6} aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="inline-flex items-center gap-2 rounded-full bg-ok/12 px-4 py-2 text-sm font-semibold text-ok ring-1 ring-ok/25">
              <Check className="size-4" strokeWidth={2.6} aria-hidden="true" /> Crea tu cuenta en un minuto y registra tu primer animal hoy
            </p>
          </div>

          <div id="acceso" className="scroll-mt-24 rounded-[1.75rem] bg-papel p-5 shadow-sm ring-1 ring-arena sm:p-7">
            <div className="mb-5 space-y-1.5">
              <Rotulo>{esRegistro ? "Primera vez" : "Bienvenido de vuelta"}</Rotulo>
              <h2 className="font-display text-2xl font-semibold tracking-tight">{esRegistro ? "Crea tu cuenta" : "Entra a tu espacio"}</h2>
              <p className="text-[0.9375rem] text-humo">{esRegistro ? "En un minuto tienes tu finca lista para registrar el primer animal." : "Ordeños, sanidad, partos y genealogía de cabras y ovejas, desde el celular."}</p>
            </div>
            {formulario}
          </div>
        </section>

        {/* Qué cubre */}
        <CarruselCubre />

        {/* Cifras */}
        <section aria-label="Apriscol en cifras" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <dl className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {cifras.map(([n, t]) => (
              <div key={t} className="min-w-0 rounded-3xl bg-papel p-4 ring-1 ring-arena">
                <dd className="font-display text-4xl font-semibold tabular-nums text-ocre">{n}</dd>
                <dt className="mt-1 text-sm text-humo">{t}</dt>
              </div>
            ))}
          </dl>
        </section>

        {/* Qué resuelve */}
        <Seccion id="que-resuelve" rotulo="Qué resuelve" titulo="Todo lo que necesitas para manejar tu aprisco, en un vistazo">
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {FUNCIONES.map((f) => (
              <li key={f.n} className="flex min-w-0 flex-col overflow-hidden rounded-3xl bg-papel ring-1 ring-arena">
                <div className="relative">
                  <Escena escena={f.escena} alto="h-28" grande />
                  <span className="absolute left-4 top-3 font-mono text-xs font-semibold text-tinta/60">{f.n}</span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ocre">{f.titulo}</p>
                  <h3 className="mt-1 font-display text-xl font-semibold leading-tight">{f.lema}</h3>
                  <ul className="mt-3 space-y-1.5 text-[0.9375rem] text-humo">
                    {f.puntos.map((p) => (
                      <li key={p} className="flex items-start gap-2">
                        <Check className="mt-1 size-3.5 shrink-0 text-musgo" strokeWidth={2.6} aria-hidden="true" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 rounded-3xl bg-papel p-4 ring-1 ring-arena sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-humo">Y además</p>
              <span className="rounded-full bg-musgo/12 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-musgo">Incluido</span>
            </div>
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                [<Beef key="b" className="size-5" strokeWidth={1.75} />, "Carne y ceba", "Pesos, lotes, candidatos y rendimiento de la canal."],
                [<Trophy key="t" className="size-5" strokeWidth={1.75} />, "Premios y ferias", "El palmarés de cada animal y de toda la finca."],
                [<Sprout key="s" className="size-5" strokeWidth={1.75} />, "Simular cruzas", "Mira la endogamia de una pareja antes de montarla."],
              ].map(([icono, t, d]) => (
                <li key={t as string} className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-musgo/10 text-musgo">{icono}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{t as string}</span>
                    <span className="block text-sm text-humo">{d as string}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Seccion>

        {/* Tu equipo */}
        <Seccion id="equipo" rotulo="Tu equipo" titulo="Defínela una vez y cada quien ve lo suyo" texto="Creas tu finca, traes tus animales e invitas a quienes te ayudan. Cada persona entra con su rol y ve solo lo que le toca.">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
              <Paso n="01" icono={<Building2 className="size-5" strokeWidth={1.75} />} titulo="Crea tu finca" texto="Nombre, especies y ubicación, en un minuto." />
              <Paso n="02" icono={<Download className="size-5" strokeWidth={1.75} />} titulo="Trae tus animales" texto="Del libro genealógico, una sola vez, con tu documento y el microchip." />
              <Paso n="03" icono={<UserPlus className="size-5" strokeWidth={1.75} />} titulo="Invita a tu equipo" texto="Ordeñador, veterinario, contador o administrador." />
              <Paso n="04" icono={<Warehouse className="size-5" strokeWidth={1.75} />} titulo="Arma tus corrales" texto="Con cuántos animales caben en cada uno." />
            </ul>
            <div className="rounded-3xl bg-papel p-4 ring-1 ring-arena sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-humo">Quién ve qué</p>
                <Users className="size-5 text-humo" strokeWidth={1.75} aria-hidden="true" />
              </div>
              <ul className="mt-3 divide-y divide-arena">
                {(
                  [
                    ["propietario", "Todo, y decide quién entra"],
                    ["administrador", "Todo, igual que el propietario"],
                    ["ordenador", "Registra y mira la leche"],
                    ["veterinario", "Sanidad, reproducción y corrales"],
                    ["contador", "Costos, gastos y reportes"],
                  ] as const
                ).map(([rol, ve]) => (
                  <li key={rol} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="font-semibold">{ETIQUETA_ROL[rol]}</span>
                    <span className="text-right text-sm text-humo">{ve}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Seccion>

        {/* Cómo funciona */}
        <Seccion id="como-funciona" rotulo="Cómo funciona" titulo="Del animal al reporte en 5 pasos o menos">
          <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-5">
            {PASOS.map((p) => (
              <Paso key={p.n} {...p} />
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex items-start gap-4 rounded-3xl bg-papel p-4 ring-1 ring-arena sm:p-5">
              <span className="font-display text-5xl font-semibold leading-none text-ocre">3</span>
              <div className="min-w-0">
                <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ocre">Con lo que ya tienes</p>
                <p className="mt-1 text-[0.9375rem] text-humo">Registra el animal, anota el ordeño de hoy y programa la próxima vacuna. Con eso ya tienes tu hato al día; lo demás lo sumas cuando lo necesites.</p>
              </div>
            </div>
            <div className="rounded-3xl bg-papel p-4 ring-1 ring-arena sm:p-5" aria-label="Ejemplo de un día en el aprisco">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-humo">Un día en el aprisco</p>
                <span className="rounded-full bg-arena px-2.5 py-0.5 text-[0.6875rem] font-semibold text-humo">Ejemplo</span>
              </div>
              <ul className="mt-3 divide-y divide-arena text-[0.9375rem]">
                {[
                  ["Ordeño de la mañana", "Registrado", "ok"],
                  ["Vacuna clostridial", "Mañana", "aviso"],
                  ["Hembras por parir", "3 en 30 días", "musgo"],
                  ["Potrero El Mirador", "Debe salir el lote", "alerta"],
                ].map(([a, b, tono]) => (
                  <li key={a} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 font-medium">{a}</span>
                    <span className={`shrink-0 text-sm font-semibold ${tono === "ok" ? "text-ok" : tono === "alerta" ? "text-rojo" : tono === "aviso" ? "text-ambar" : "text-musgo"}`}>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Seccion>

        {/* Pensado para el celular */}
        <Seccion rotulo="Hecho para el campo" titulo="Pensado primero para el celular" texto="Con guantes, con sol y con una mano: así se usa un aprisco.">
          <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
            <Paso n="01" icono={<Hand className="size-5" strokeWidth={1.75} />} titulo="Una mano" texto="Botones grandes y lo principal siempre al alcance del pulgar." />
            <Paso n="02" icono={<Keyboard className="size-5" strokeWidth={1.75} />} titulo="Teclado propio" texto="Los litros y los pesos se anotan con un teclado hecho para eso." />
            <Paso n="03" icono={<Smartphone className="size-5" strokeWidth={1.75} />} titulo="Se adapta" texto="Desde pantallas pequeñas hasta el computador, con menú lateral." />
            <Paso n="04" icono={<Moon className="size-5" strokeWidth={1.75} />} titulo="Claro u oscuro" texto="Sigue el modo de tu teléfono, de día y de noche." />
          </ul>
        </Seccion>

        {/* Planes */}
        <Seccion id="planes" rotulo="Planes" titulo="Elige el que se ajuste al tamaño de tu aprisco" texto="Precios en dólares (US$) por mes. Pagas por los servicios que usas, no por cuántos animales tienes. Todos funcionan en el celular y en el computador, y tus datos siempre son tuyos.">
          <Planes hrefCrear={hrefCrear} />
        </Seccion>

        {/* Preguntas */}
        <Seccion id="preguntas" rotulo="Preguntas frecuentes" titulo="Antes de empezar">
          <div className="max-w-3xl space-y-2">
            {PREGUNTAS.map((q, i) => (
              <details key={q.p} className="group rounded-2xl bg-papel ring-1 ring-arena open:ring-musgo/40">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
                  <span className="font-mono text-xs font-semibold text-ocre">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 font-semibold">{q.p}</span>
                  <ChevronDown className="size-5 shrink-0 text-humo transition group-open:rotate-180" strokeWidth={1.75} aria-hidden="true" />
                </summary>
                <p className="px-4 pb-4 pl-[3.25rem] text-[0.9375rem] text-humo">{q.r}</p>
              </details>
            ))}
          </div>
        </Seccion>

        {/* Cierre */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-4 sm:px-6">
          <div className="rounded-[1.75rem] bg-musgo px-5 py-10 text-center text-sobre-musgo sm:px-10 sm:py-14">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Tu próximo ordeño puede quedar registrado hoy</h2>
            <p className="mx-auto mt-3 max-w-xl text-[1.0625rem] opacity-85">Crea tu cuenta, trae tus animales y empieza a ver tu aprisco al día.</p>
            <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2.5 sm:max-w-none sm:flex-row sm:justify-center">
              <Link href={hrefCrear} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-sobre-musgo px-6 text-base font-semibold text-musgo transition hover:brightness-95 active:scale-[0.98]">
                {esRegistro ? "Crear mi cuenta" : "Crear cuenta"} <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
              </Link>
              <Link href={esRegistro ? "/login" : "#acceso"} className="inline-flex min-h-12 items-center justify-center rounded-2xl px-6 text-base font-semibold ring-1 ring-sobre-musgo/40 transition hover:bg-sobre-musgo/10 active:scale-[0.98]">
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PieLegal />
    </div>
  );
}
