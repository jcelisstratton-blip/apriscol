import { leerReferencia } from "@/lib/offline/campo-db";
import { esFallaDeRed, guardarEnCelular } from "@/lib/offline/campo-envio";
import { hoyBogota } from "@/lib/fechas";
import { etiquetaCampo, type ReferenciaCampo, type RegistroCampo } from "@/lib/campo";

/**
 * El respaldo sin señal de los formularios con señal (ficha del animal, Sanidad…): si al guardar se cae la señal, la acción del servidor falla con
 * un error de red y la pantalla mostraba «Algo no salió bien», perdiendo lo escrito. Con esto, un registro NUEVO queda en el celular (con el mismo
 * identificador del formulario, así nunca se duplica) y se envía solo al volver la señal; una corrección (editar) pide intentarlo de nuevo, sin
 * borrar lo escrito. Solo navegador (sin `"use client"`: lo usan componentes de cliente).
 */
export type GuardadoLocal = { local: true };
export const SIN_SENAL_CORRECCION = "Sin señal: los cambios no se guardaron. Inténtalo de nuevo cuando vuelva la señal; lo que escribiste sigue aquí.";
export const SIN_SENAL_SIN_COPIA = "Sin señal y este celular aún no tiene lo necesario para guardar aquí. Inténtalo de nuevo cuando vuelva la señal; lo que escribiste sigue aquí.";

/** Los campos de texto de un formulario (sin los vacíos ni los que se piden excluir). */
export function camposDe(datos: FormData, excluir: readonly string[] = []): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const [k, v] of datos.entries()) {
    if (typeof v !== "string" || excluir.includes(k) || v.trim() === "") continue;
    campos[k] = v;
  }
  return campos;
}

/** La copia de la finca que el panel guarda al abrir la app con señal (la de la sesión abierta), si es de esa finca. */
async function copiaDelCelular(fincaId?: string): Promise<ReferenciaCampo | null> {
  const ref = await leerReferencia();
  if (!ref || (fincaId && ref.finca.id !== fincaId)) return null;
  return ref;
}

/** Arete y nombre de un animal según la copia de la finca (para mostrarlo en lo guardado); «Animal» si no está. */
export function etiquetaDeAnimal(ref: ReferenciaCampo, id: string): string {
  const a = ref.animales.find((x) => x.id === id) ?? ref.pesar.find((x) => x.id === id) ?? ref.hembras.find((x) => x.id === id) ?? ref.ordeno.find((x) => x.id === id);
  return a ? etiquetaCampo(a) : "Animal";
}

type Registro = Omit<RegistroCampo, "estado" | "intentos" | "creadoEn" | "usuarioId" | "fincaId" | "fecha"> & { fecha?: string };

/**
 * Envuelve la acción de un formulario. `respaldo` arma el registro a guardar en el celular con los datos del formulario y la copia de la finca
 * (devuelve `null` si no aplica); sin `respaldo` (una corrección) o sin red, devuelve `{ local: true }` o un aviso amable en vez de romper la pantalla.
 */
export function accionConRespaldo<E extends { error?: string } | undefined>(
  accion: (previo: E, datos: FormData) => Promise<E>,
  respaldo: ((datos: FormData, ref: ReferenciaCampo) => Registro | null) | null,
  fincaId?: string,
): (previo: E | GuardadoLocal | { error: string }, datos: FormData) => Promise<E | GuardadoLocal | { error: string }> {
  return async (previo, datos) => {
    try {
      return await accion(previo as E, datos);
    } catch (e) {
      if (!esFallaDeRed(e)) throw e;
      if (!respaldo) return { error: SIN_SENAL_CORRECCION };
      return guardarRespaldo((ref) => respaldo(datos, ref), fincaId);
    }
  };
}

/**
 * Guarda en el celular el registro de un formulario con señal cuya acción falló por la red (para los que no usan `useActionState`, como «Dar de
 * baja»). `armar` recibe la copia de la finca y devuelve el registro (o `null` si no aplica). Devuelve `{ local: true }` o un aviso amable.
 */
export async function guardarRespaldo(armar: (ref: ReferenciaCampo) => Registro | null, fincaId?: string): Promise<GuardadoLocal | { error: string }> {
  const ref = await copiaDelCelular(fincaId);
  if (!ref) return { error: SIN_SENAL_SIN_COPIA };
  const registro = armar(ref);
  if (!registro) return { error: SIN_SENAL_CORRECCION };
  await guardarEnCelular({ ...registro, fecha: registro.fecha || hoyBogota(), usuarioId: ref.usuario.id, fincaId: ref.finca.id });
  return { local: true };
}

/** ¿El último envío quedó guardado en el celular? */
export const quedoEnCelular = (estado: unknown): boolean => Boolean(estado && typeof estado === "object" && "local" in estado);
/** El error del último envío, si lo hubo (también el aviso amable de «sin señal»). */
export const errorDe = (estado: unknown): string | undefined =>
  estado && typeof estado === "object" && "error" in estado && typeof (estado as { error?: unknown }).error === "string" ? (estado as { error: string }).error : undefined;
