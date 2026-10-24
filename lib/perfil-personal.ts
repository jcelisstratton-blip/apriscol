/** Datos propios de cada perfil del equipo: qué se pide, qué es obligatorio y qué se guarda según el perfil. */

export type PerfilEquipo = "administrador" | "ordenador" | "veterinario" | "contador" | "ninguno";

export const ESPECIALIDADES = ["reproduccion", "sanidad", "cirugia", "nutricion", "calidad_leche"] as const;
export type Especialidad = (typeof ESPECIALIDADES)[number];
export const ETIQUETA_ESPECIALIDAD: Record<Especialidad, string> = { reproduccion: "Reproducción", sanidad: "Sanidad", cirugia: "Cirugía", nutricion: "Nutrición", calidad_leche: "Calidad de leche" };
export const DETALLE_ESPECIALIDAD: Record<Especialidad, string> = {
  reproduccion: "Servicios, diagnósticos y partos.",
  sanidad: "Vacunas, desparasitación y enfermedades.",
  cirugia: "Cesáreas y otras cirugías.",
  nutricion: "Dietas y manejo del alimento.",
  calidad_leche: "Mastitis, higiene y control de la leche.",
};

export const FORMACIONES = ["empirica", "tecnica", "tecnologica", "profesional"] as const;
export type Formacion = (typeof FORMACIONES)[number];
export const ETIQUETA_FORMACION: Record<Formacion, string> = { empirica: "Empírica", tecnica: "Técnica", tecnologica: "Tecnológica", profesional: "Profesional" };
export const DETALLE_FORMACION: Record<Formacion, string> = {
  empirica: "Aprendió en el campo.",
  tecnica: "Curso o técnico agropecuario.",
  tecnologica: "Tecnólogo agropecuario.",
  profesional: "Carrera universitaria.",
};

export const TURNOS = ["manana", "tarde", "ambos"] as const;
export type Turno = (typeof TURNOS)[number];
export const ETIQUETA_TURNO: Record<Turno, string> = { manana: "Mañana", tarde: "Tarde", ambos: "Ambos turnos" };
export const DETALLE_TURNO: Record<Turno, string> = { manana: "Ordeña en la mañana.", tarde: "Ordeña en la tarde.", ambos: "Ordeña mañana y tarde." };

export const TIPOS_ORDENO = ["manual", "mecanico", "ambos"] as const;
export type TipoOrdeno = (typeof TIPOS_ORDENO)[number];
export const ETIQUETA_TIPO_ORDENO: Record<TipoOrdeno, string> = { manual: "Manual", mecanico: "Mecánico", ambos: "Los dos" };
export const DETALLE_TIPO_ORDENO: Record<TipoOrdeno, string> = { manual: "A mano.", mecanico: "Con máquina de ordeño.", ambos: "Sabe de los dos." };

export const TIPOS_CONTADOR = ["publico", "auxiliar"] as const;
export type TipoContador = (typeof TIPOS_CONTADOR)[number];
export const ETIQUETA_TIPO_CONTADOR: Record<TipoContador, string> = { publico: "Contador público", auxiliar: "Auxiliar contable" };
export const DETALLE_TIPO_CONTADOR: Record<TipoContador, string> = { publico: "Con tarjeta profesional.", auxiliar: "Lleva los registros del día a día." };

export const LABORES = ["hato", "potreros", "alimentacion", "mantenimiento", "otra"] as const;
export type Labor = (typeof LABORES)[number];
export const ETIQUETA_LABOR: Record<Labor, string> = { hato: "Cuidado del hato", potreros: "Potreros y cercas", alimentacion: "Alimentación", mantenimiento: "Mantenimiento", otra: "Otra labor" };
export const DETALLE_LABOR: Record<Labor, string> = {
  hato: "Pastoreo, manejo y cuidado de los animales.",
  potreros: "Rotación, cercas y praderas.",
  alimentacion: "Forrajes, concentrado y suplementos.",
  mantenimiento: "Corrales, instalaciones y herramientas.",
  otra: "Otro oficio en la finca.",
};

/** Lo que llega del formulario (texto; vacío = no se llenó). */
export type EntradaPerfil = {
  telefono?: string;
  experiencia_anios?: string;
  formacion?: string;
  tarjeta_profesional?: string;
  tipo_contador?: string;
  /** Las especialidades elegidas, separadas por coma. */
  especialidades?: string;
  acreditaciones?: string;
  turno_ordeno?: string;
  tipo_ordeno?: string;
  /** «si» o «no». */
  curso_manipulacion?: string;
  curso_manipulacion_vence?: string;
  labor_principal?: string;
};

export type DatosPerfil = {
  telefono: string | null;
  experiencia_anios: number | null;
  formacion: Formacion | null;
  tarjeta_profesional: string | null;
  tipo_contador: TipoContador | null;
  especialidades: Especialidad[];
  acreditaciones: string | null;
  turno_ordeno: Turno | null;
  tipo_ordeno: TipoOrdeno | null;
  curso_manipulacion: boolean | null;
  curso_manipulacion_vence: string | null;
  labor_principal: Labor | null;
};

const vacio = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);
const dentro = <T extends string>(v: string | undefined, lista: readonly T[]): T | undefined => lista.find((x) => x === vacio(v));

/**
 * Cada perfil pide y guarda solo lo suyo. Al agregar a alguien (`exigir`) lo esencial es obligatorio: del veterinario, su tarjeta profesional y su teléfono;
 * del ordeñador, su turno y el tipo de ordeño; del contador, su tipo (y la tarjeta si es público); de quien trabaja sin acceso, su labor. Al corregir a alguien
 * que ya estaba registrado no se exige, para no bloquear (por ejemplo, retirar a un veterinario antiguo); lo que escriba sí se valida.
 */
export function perfilPorRol(rol: PerfilEquipo, e: EntradaPerfil, exigir: boolean): { error: string } | { datos: DatosPerfil } {
  const telefono = vacio(e.telefono);
  if (telefono) {
    const digitos = telefono.replace(/\D/g, "");
    if (!/^[+\d\s()-]+$/.test(telefono) || digitos.length < 7 || digitos.length > 15) return { error: "Escribe un teléfono válido, solo con números (por ejemplo 300 123 4567)." };
  }
  let experiencia: number | undefined;
  if (vacio(e.experiencia_anios) !== undefined) {
    experiencia = Number(vacio(e.experiencia_anios));
    if (!Number.isInteger(experiencia) || experiencia < 0 || experiencia > 60) return { error: "Los años de experiencia deben ser un número entero entre 0 y 60." };
  }
  const datos: DatosPerfil = {
    telefono: telefono ?? null,
    experiencia_anios: experiencia ?? null,
    formacion: null,
    tarjeta_profesional: null,
    tipo_contador: null,
    especialidades: [],
    acreditaciones: null,
    turno_ordeno: null,
    tipo_ordeno: null,
    curso_manipulacion: null,
    curso_manipulacion_vence: null,
    labor_principal: null,
  };

  if (rol === "veterinario") {
    const tarjeta = vacio(e.tarjeta_profesional);
    if (exigir && !tarjeta) return { error: "Escribe la tarjeta profesional del veterinario." };
    if (exigir && !telefono) return { error: "Escribe el teléfono del veterinario: es a quien se llama en una urgencia." };
    if (tarjeta && (tarjeta.length < 3 || tarjeta.length > 40)) return { error: "La tarjeta profesional debe tener entre 3 y 40 caracteres." };
    const elegidas = (vacio(e.especialidades) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    if (elegidas.some((x) => !ESPECIALIDADES.includes(x as Especialidad))) return { error: "Una especialidad no es válida." };
    const acreditaciones = vacio(e.acreditaciones);
    if (acreditaciones && acreditaciones.length > 200) return { error: "Las acreditaciones son muy largas (máximo 200 letras)." };
    datos.tarjeta_profesional = tarjeta ?? null;
    datos.especialidades = ESPECIALIDADES.filter((x) => elegidas.includes(x));
    datos.acreditaciones = acreditaciones ?? null;
  } else if (rol === "ordenador") {
    const turno = dentro(e.turno_ordeno, TURNOS);
    const tipo = dentro(e.tipo_ordeno, TIPOS_ORDENO);
    if (exigir && !turno) return { error: "Elige el turno en que ordeña." };
    if (exigir && !tipo) return { error: "Elige qué tipo de ordeño maneja." };
    datos.turno_ordeno = turno ?? null;
    datos.tipo_ordeno = tipo ?? null;
    const curso = vacio(e.curso_manipulacion);
    if (curso === "si" || curso === "no") datos.curso_manipulacion = curso === "si";
    if (datos.curso_manipulacion) datos.curso_manipulacion_vence = vacio(e.curso_manipulacion_vence) ?? null;
  } else if (rol === "administrador") {
    datos.formacion = dentro(e.formacion, FORMACIONES) ?? null;
  } else if (rol === "contador") {
    const tipo = dentro(e.tipo_contador, TIPOS_CONTADOR);
    if (exigir && !tipo) return { error: "Indica si es contador público o auxiliar contable." };
    datos.tipo_contador = tipo ?? null;
    if (tipo === "publico") {
      const tarjeta = vacio(e.tarjeta_profesional);
      if (exigir && !tarjeta) return { error: "Escribe la tarjeta profesional del contador público." };
      if (tarjeta && (tarjeta.length < 3 || tarjeta.length > 40)) return { error: "La tarjeta profesional debe tener entre 3 y 40 caracteres." };
      datos.tarjeta_profesional = tarjeta ?? null;
    }
  } else {
    const labor = dentro(e.labor_principal, LABORES);
    if (exigir && !labor) return { error: "Elige la labor principal de la persona." };
    datos.labor_principal = labor ?? null;
  }
  return { datos };
}

/** Una línea con lo más útil del perfil, para la lista del equipo. */
export function resumenPerfil(rol: PerfilEquipo, p: Partial<DatosPerfil>): string {
  const partes: (string | false | null | undefined)[] = [];
  if (rol === "veterinario") {
    partes.push(p.tarjeta_profesional && `T.P. ${p.tarjeta_profesional}`, p.especialidades?.length ? p.especialidades.map((x) => ETIQUETA_ESPECIALIDAD[x]).join(", ") : null);
  } else if (rol === "ordenador") {
    partes.push(p.turno_ordeno && `Turno: ${ETIQUETA_TURNO[p.turno_ordeno].toLowerCase()}`, p.tipo_ordeno && `Ordeño ${ETIQUETA_TIPO_ORDENO[p.tipo_ordeno].toLowerCase()}`, p.curso_manipulacion && "Curso de manipulación");
  } else if (rol === "administrador") {
    partes.push(p.formacion && `Formación ${ETIQUETA_FORMACION[p.formacion].toLowerCase()}`);
  } else if (rol === "contador") {
    partes.push(p.tipo_contador && ETIQUETA_TIPO_CONTADOR[p.tipo_contador], p.tarjeta_profesional && `T.P. ${p.tarjeta_profesional}`);
  } else {
    partes.push(p.labor_principal && ETIQUETA_LABOR[p.labor_principal]);
  }
  if (p.experiencia_anios != null) partes.push(p.experiencia_anios === 1 ? "1 año de experiencia" : `${p.experiencia_anios} años de experiencia`);
  return partes.filter(Boolean).join(" · ");
}
