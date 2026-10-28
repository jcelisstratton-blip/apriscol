import {
  Activity, ArrowRightLeft, Baby, Banknote, BarChart3, Beef, CalendarClock, ClipboardCheck, Droplets, FileText, FlaskConical, GitFork, HeartPulse, Download, FileSpreadsheet, Home, KeyRound, Layers, MapPin,
  Microscope, Package, PawPrint, Plus, Rocket, Scale, Shuffle, SlidersHorizontal, Snowflake, Syringe, Trophy, Truck, UserPlus, Users, Wallet, Wrench, Fence, Sheet, type LucideIcon,
  HardHat, Gift, Inbox,
} from "lucide-react";
import { puedeEscribir, puedeGestionar, puedeVer } from "@/lib/permisos";
import { servicioEnPlan, type ServicioPlan } from "@/lib/planes";
import type { ModuloApp, PlanId, RolFinca } from "@/lib/tipos";
import { sinTildes } from "@/lib/texto";

export type GrupoAtajo = "Hato" | "Leche" | "Reproducción" | "Sanidad" | "Carne" | "Corrales" | "Costos" | "Premios" | "Cuenta";
export const GRUPOS_ATAJO: GrupoAtajo[] = ["Hato", "Leche", "Reproducción", "Sanidad", "Carne", "Corrales", "Costos", "Premios", "Cuenta"];

/** «registrar» crea o anota algo; «ir» abre una pantalla. */
export type TipoAtajo = "registrar" | "ir";

export type Atajo = {
  href: string;
  titulo: string;
  detalle: string;
  grupo: GrupoAtajo;
  tipo: TipoAtajo;
  Icono: LucideIcon;
  /** Módulo que debe poder ver (o escribir, si `tipo` es «registrar») el rol y debe incluir el plan. */
  modulo?: ModuloApp;
  servicio?: ServicioPlan;
  /** Solo propietario o administrador. */
  gestion?: boolean;
  propietario?: boolean;
  /** Palabras que no están en el texto pero que la persona puede escribir al buscar. */
  clave?: string;
};

/**
 * Todo lo que se puede hacer o abrir en la app desde «Al grano», en un solo lugar. Cada entrada lleva directo a donde corresponde. Lo que es de un
 * solo animal sin elegirlo (servicio, parto, peso, baja…) manda al Hato para escoger el animal y seguir desde su ficha. Una pantalla nueva con
 * menú o con botón de «crear» se agrega aquí.
 */
export const ATAJOS: Atajo[] = [
  // Hato
  { grupo: "Hato", tipo: "registrar", titulo: "Animal nuevo", detalle: "Cabra, cabro, oveja o carnero", href: "/hato/nuevo", Icono: PawPrint, modulo: "hato", clave: "registrar cabra oveja arete" },
  { grupo: "Hato", tipo: "registrar", titulo: "Cargar animales desde Excel", detalle: "Muchos animales a la vez, con su genealogía", href: "/hato/importar", Icono: FileSpreadsheet, modulo: "hato", clave: "importar masivo plantilla excel subir cargar archivo xlsx" },
  { grupo: "Hato", tipo: "ir", titulo: "Mi hato", detalle: "Todos los animales y sus filtros", href: "/hato", Icono: PawPrint, modulo: "hato", clave: "animales lista buscar arete" },
  { grupo: "Hato", tipo: "ir", titulo: "Hembras del hato", detalle: "Elige una y registra servicio, diagnóstico o parto", href: "/hato?filtro=hembras", Icono: Baby, modulo: "reproduccion", clave: "parto servicio monta diagnostico gestacion cria" },
  { grupo: "Hato", tipo: "ir", titulo: "Endogamia", detalle: "Parentesco de todo el hato", href: "/hato/endogamia", Icono: GitFork, modulo: "hato", clave: "genealogia parentesco consanguinidad" },
  { grupo: "Hato", tipo: "ir", titulo: "Simular una cruza", detalle: "Mira la endogamia de una pareja antes de montarla", href: "/hato/cruza", Icono: Shuffle, modulo: "hato", clave: "cruce pareja" },

  { grupo: "Hato", tipo: "registrar", titulo: "Crear una novedad", detalle: "Avisa qué hay que comprar o aplicar; solo eliges opciones", href: "/novedades/nueva", Icono: Inbox, modulo: "novedades", clave: "novedad aviso reportar vacuna prueba diagnostica animal enfermo" },
  { grupo: "Hato", tipo: "ir", titulo: "Novedades", detalle: "Lo que el equipo ha avisado de los animales", href: "/novedades", Icono: Inbox, modulo: "novedades", clave: "avisos reportes novedad" },

  // Leche
  { grupo: "Leche", tipo: "registrar", titulo: "Registrar ordeño", detalle: "Litros por animal, jornada de hoy", href: "/hato?vista=ordeno", Icono: Droplets, modulo: "leche", clave: "litros leche ordeno jornada" },
  { grupo: "Leche", tipo: "registrar", titulo: "Análisis de calidad", detalle: "Grasa, proteína y células somáticas", href: "/leche/calidad/nuevo", Icono: FlaskConical, modulo: "leche", clave: "laboratorio grasa proteina" },
  { grupo: "Leche", tipo: "registrar", titulo: "Despacho de leche", detalle: "A dónde fue la leche y a qué precio", href: "/leche/despachos/nuevo", Icono: Truck, modulo: "leche", clave: "venta queseria comprador" },
  { grupo: "Leche", tipo: "registrar", titulo: "Medir el frío del tanque", detalle: "Temperatura del tanque", href: "/leche/frio/nuevo", Icono: Snowflake, modulo: "leche", clave: "temperatura tanque" },
  { grupo: "Leche", tipo: "registrar", titulo: "Mantenimiento del equipo", detalle: "Lavados, revisiones y pulsadores", href: "/leche/equipo/nuevo", Icono: Wrench, modulo: "leche", clave: "ordeñadora lavado" },
  { grupo: "Leche", tipo: "ir", titulo: "Producción de leche", detalle: "Litros por día y por animal", href: "/leche", Icono: Droplets, modulo: "leche" },
  { grupo: "Leche", tipo: "ir", titulo: "Calidad de la leche", detalle: "Análisis y resultados", href: "/leche?vista=calidad", Icono: FlaskConical, modulo: "leche" },
  { grupo: "Leche", tipo: "ir", titulo: "Despachos", detalle: "Lo vendido y sus controles", href: "/leche?vista=despachos", Icono: Truck, modulo: "leche" },
  { grupo: "Leche", tipo: "ir", titulo: "Frío y equipo", detalle: "Tanque y equipos de ordeño", href: "/leche?vista=frio", Icono: Snowflake, modulo: "leche" },

  // Reproducción
  { grupo: "Reproducción", tipo: "registrar", titulo: "Temporada de monta", detalle: "Crear un empadronamiento", href: "/reproduccion/empadronamiento/nuevo", Icono: CalendarClock, modulo: "reproduccion", clave: "empadronamiento semental hembras" },
  { grupo: "Reproducción", tipo: "ir", titulo: "Reproducción", detalle: "Gestaciones y partos", href: "/reproduccion", Icono: Baby, modulo: "reproduccion" },
  { grupo: "Reproducción", tipo: "ir", titulo: "Empadronamientos", detalle: "Temporadas de monta", href: "/reproduccion?vista=empadronamiento", Icono: CalendarClock, modulo: "reproduccion" },
  { grupo: "Reproducción", tipo: "ir", titulo: "Servicios", detalle: "Montas e inseminaciones", href: "/reproduccion?vista=servicios", Icono: Layers, modulo: "reproduccion", clave: "monta inseminacion" },
  { grupo: "Reproducción", tipo: "ir", titulo: "Partos", detalle: "Crías y lactancias", href: "/reproduccion?vista=partos", Icono: Baby, modulo: "reproduccion", clave: "crias lactancia" },

  // Sanidad
  { grupo: "Sanidad", tipo: "registrar", titulo: "Vacuna o tratamiento", detalle: "Para uno o varios animales", href: "/hato/sanidad/nuevo", Icono: Syringe, modulo: "sanidad", clave: "vacunar desparasitar aplicar medicamento" },
  { grupo: "Sanidad", tipo: "registrar", titulo: "Programar una aplicación", detalle: "Vacunas, desparasitaciones o podología", href: "/hato/sanidad/programar", Icono: CalendarClock, modulo: "sanidad", clave: "agendar programar podologia pezuñas" },
  { grupo: "Sanidad", tipo: "registrar", titulo: "Evaluación FAMACHA", detalle: "Color de la mucosa, puntaje de 1 a 5", href: "/hato/sanidad/famacha/nueva", Icono: HeartPulse, modulo: "sanidad", clave: "famacha anemia parasitos" },
  { grupo: "Sanidad", tipo: "registrar", titulo: "Prueba diagnóstica", detalle: "Resultado de un examen del hato", href: "/sanidad/pruebas/nueva", Icono: Microscope, modulo: "sanidad", clave: "examen laboratorio brucelosis" },
  { grupo: "Sanidad", tipo: "registrar", titulo: "Producto veterinario", detalle: "Agregar a tu catálogo", href: "/sanidad/productos/nuevo", Icono: Package, modulo: "sanidad", clave: "medicamento vacuna catalogo" },
  { grupo: "Sanidad", tipo: "ir", titulo: "Sanidad", detalle: "Lo aplicado y por atender", href: "/sanidad", Icono: Syringe, modulo: "sanidad" },
  { grupo: "Sanidad", tipo: "ir", titulo: "Historial sanitario", detalle: "Todo lo aplicado", href: "/sanidad?vista=historial", Icono: ClipboardCheck, modulo: "sanidad" },
  { grupo: "Sanidad", tipo: "ir", titulo: "Productos", detalle: "Tu catálogo veterinario", href: "/sanidad?vista=productos", Icono: Package, modulo: "sanidad" },
  { grupo: "Sanidad", tipo: "ir", titulo: "Pruebas", detalle: "Diagnósticos del hato", href: "/sanidad?vista=pruebas", Icono: Microscope, modulo: "sanidad" },
  { grupo: "Sanidad", tipo: "ir", titulo: "Sanidad por programar", detalle: "Vacunas y tratamientos que ya tocan", href: "/hato?vista=sanidad", Icono: CalendarClock, modulo: "sanidad", clave: "pendientes proximas" },

  // Carne
  { grupo: "Carne", tipo: "registrar", titulo: "Pesar animales", detalle: "Peso de los animales en ceba", href: "/hato?vista=ceba", Icono: Scale, modulo: "carne", clave: "peso ganancia ceba" },
  { grupo: "Carne", tipo: "registrar", titulo: "Lote de ceba", detalle: "Crear un grupo en engorde", href: "/carne/lotes/nuevo", Icono: Beef, modulo: "carne", clave: "engorde lote" },
  { grupo: "Carne", tipo: "ir", titulo: "Carne y ceba", detalle: "Cómo va la ceba", href: "/carne", Icono: Beef, modulo: "carne" },
  { grupo: "Carne", tipo: "ir", titulo: "Candidatos a ceba", detalle: "A quién pasar a ceba", href: "/carne?vista=candidatos", Icono: Activity, modulo: "carne" },
  { grupo: "Carne", tipo: "ir", titulo: "Lotes de ceba", detalle: "Grupos en engorde", href: "/carne?vista=lotes", Icono: Layers, modulo: "carne" },
  { grupo: "Carne", tipo: "ir", titulo: "Pesos y ganancia", detalle: "Peso y ganancia diaria", href: "/carne?vista=pesajes", Icono: Scale, modulo: "carne" },
  { grupo: "Carne", tipo: "ir", titulo: "Canales y salidas", detalle: "Rendimiento, ventas y sacrificio", href: "/carne?vista=canales", Icono: Truck, modulo: "carne", clave: "sacrificio venta salidas" },

  // Corrales
  { grupo: "Corrales", tipo: "registrar", titulo: "Corral o potrero nuevo", detalle: "Capacidad, piso y rotación", href: "/hato/corrales/nueva", Icono: Fence, modulo: "corrales", clave: "instalacion potrero" },
  { grupo: "Corrales", tipo: "registrar", titulo: "Mover animales", detalle: "Cambiar de corral a uno o a todo un lote", href: "/hato/corrales/mover", Icono: ArrowRightLeft, modulo: "corrales", clave: "rotar trasladar" },
  { grupo: "Corrales", tipo: "ir", titulo: "Corrales y potreros", detalle: "Dónde está cada animal", href: "/hato?vista=corrales", Icono: Fence, modulo: "corrales" },
  { grupo: "Corrales", tipo: "ir", titulo: "Resumen de corrales", detalle: "Ocupación, movimientos y alertas", href: "/corrales", Icono: BarChart3, modulo: "corrales", clave: "hacinamiento cuarentena" },

  // Costos
  { grupo: "Costos", tipo: "registrar", titulo: "Registrar una compra", detalle: "Alimento, sanidad, servicios y más: eliges y pones la cantidad", href: "/hato/gastos/nuevo", Icono: Wallet, modulo: "contabilidad", clave: "gasto costo factura compra concentrado" },
  { grupo: "Costos", tipo: "registrar", titulo: "Registrar una venta", detalle: "Carne, queso, abono, lana…: eliges y pones la cantidad", href: "/hato/ventas/nueva", Icono: Banknote, modulo: "contabilidad", clave: "vender ingreso cobrar queso carne abono" },
  { grupo: "Costos", tipo: "ir", titulo: "Compras", detalle: "Lo que cuesta el hato, y lo que falta por pagar", href: "/hato?vista=gastos", Icono: Wallet, modulo: "contabilidad", clave: "gastos por pagar" },
  { grupo: "Costos", tipo: "registrar", titulo: "Registrar un pago al personal", detalle: "Salario, jornal u honorarios de quien trabaja en la finca", href: "/personal/pagos/nuevo", Icono: HardHat, modulo: "contabilidad", clave: "nomina mano de obra salario jornal pago personal empleado" },
  { grupo: "Costos", tipo: "ir", titulo: "Ventas", detalle: "Lo que vendes, y lo que falta por cobrar", href: "/hato?vista=ventas", Icono: Banknote, modulo: "contabilidad", clave: "ingresos por cobrar leche animales" },
  { grupo: "Costos", tipo: "ir", titulo: "Costos y resultado", detalle: "Compras, mano de obra, ventas y resultado por fechas", href: "/costos", Icono: BarChart3, modulo: "contabilidad" },
  { grupo: "Costos", tipo: "ir", titulo: "Productos y terceros", detalle: "Tus listas de productos, proveedores y compradores", href: "/mas/productos", Icono: Package, modulo: "contabilidad", clave: "catalogo precios proveedores compradores" },
  { grupo: "Costos", tipo: "ir", titulo: "Costo por animal", detalle: "Cuánto cuesta cada animal", href: "/costos?vista=animales", Icono: PawPrint, modulo: "contabilidad", servicio: "costoAnimal" },
  { grupo: "Costos", tipo: "ir", titulo: "Reportes en Excel", detalle: "Descarga por las fechas que elijas", href: "/costos?vista=reportes", Icono: Sheet, modulo: "contabilidad", servicio: "reportes", clave: "descargar excel" },

  // Premios
  { grupo: "Premios", tipo: "registrar", titulo: "Premio o participación", detalle: "Una feria, un puesto, un campeonato", href: "/ferias/participacion/nueva", Icono: Trophy, modulo: "ferias", clave: "feria concurso" },
  { grupo: "Premios", tipo: "ir", titulo: "Premios", detalle: "Lo ganado por tus animales", href: "/ferias", Icono: Trophy, modulo: "ferias" },
  { grupo: "Premios", tipo: "ir", titulo: "Ferias", detalle: "Dónde participaste", href: "/ferias?vista=ferias", Icono: Trophy, modulo: "ferias" },

  // Cuenta
  { grupo: "Cuenta", tipo: "ir", titulo: "Hoy", detalle: "Lo que toca hacer hoy", href: "/", Icono: Home },
  { grupo: "Cuenta", tipo: "registrar", titulo: "Agregar a alguien al equipo", detalle: "Elige su perfil y su contrato: ordeñador, veterinario, jornalero…", href: "/mas/miembros", Icono: UserPlus, gestion: true, servicio: "equipo", clave: "equipo invitacion" },
  { grupo: "Cuenta", tipo: "ir", titulo: "Exportar los datos de la finca", detalle: "Todo en un Excel: animales, leche, sanidad, compras, ventas…", href: "/mas/exportar", Icono: Download, propietario: true, clave: "descargar respaldo copia backup salir cancelar sacar informacion" },
  { grupo: "Cuenta", tipo: "ir", titulo: "Referidos", detalle: "Tu enlace: 5 % del plan de quien refieras durante 6 meses", href: "/mas/referidos", Icono: Gift, clave: "referir invitar enlace comision ganar" },
  { grupo: "Cuenta", tipo: "ir", titulo: "Equipo y pagos", detalle: "Quién tiene acceso, su contrato y lo que se les paga", href: "/mas/miembros", Icono: Users, gestion: true },
  { grupo: "Cuenta", tipo: "ir", titulo: "Datos de la finca", detalle: "Nombre, ubicación y umbral de endogamia", href: "/mas/finca", Icono: MapPin, gestion: true },
  { grupo: "Cuenta", tipo: "ir", titulo: "Ajustes de la finca", detalle: "Tiempos, límites y criterios con los que avisa la finca", href: "/mas/ajustes", Icono: SlidersHorizontal, clave: "umbrales gestacion gdp celulas somaticas pediluvio nomina configuracion" },
  { grupo: "Cuenta", tipo: "ir", titulo: "Mi plan", detalle: "Tu plan y cómo mejorarlo", href: "/mas/plan", Icono: Rocket, propietario: true, clave: "mejorar plan precio" },
  { grupo: "Cuenta", tipo: "registrar", titulo: "Agregar otra finca", detalle: "Una finca más en tu cuenta", href: "/onboarding", Icono: Plus, propietario: true },
  { grupo: "Cuenta", tipo: "ir", titulo: "Cambiar contraseña", detalle: "Tu acceso a Apriscol", href: "/cambiar-clave", Icono: KeyRound, clave: "clave password" },
  { grupo: "Cuenta", tipo: "ir", titulo: "Términos y privacidad", detalle: "Cómo se protegen tus datos", href: "/terminos", Icono: FileText, clave: "legal datos supabase" },
];

/** Lo que esta persona puede hacer en esta finca: según su rol y según lo que incluye el plan. */
export function atajosPara(rol: RolFinca, plan: PlanId): Atajo[] {
  return ATAJOS.filter((a) => {
    if (a.modulo && !(a.tipo === "registrar" ? puedeEscribir(rol, a.modulo, plan) : puedeVer(rol, a.modulo, plan))) return false;
    if (a.servicio && !servicioEnPlan(plan, a.servicio)) return false;
    if (a.gestion && !puedeGestionar(rol)) return false;
    if (a.propietario && rol !== "propietario") return false;
    return true;
  });
}


/** ¿Coincide con lo que la persona escribió? Ignora tildes y mayúsculas; todas las palabras deben aparecer. */
export function coincideAtajo(a: Atajo, texto: string): boolean {
  const palabras = sinTildes(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const base = sinTildes(`${a.titulo} ${a.detalle} ${a.grupo} ${a.clave ?? ""}`);
  return palabras.every((p) => base.includes(p));
}
