"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlDelSitio } from "@/lib/sitio";
import { destinoSeguro } from "@/lib/redireccion";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { obtenerUsuario } from "@/lib/contexto";
import { codigoValido } from "@/lib/referidos";

export type EstadoAuth = { error?: string; aviso?: string } | undefined;

const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido.")),
  password: z.string().min(1, "Escribe tu contraseña."),
});

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(2, "Escribe tu nombre.").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido.")),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(72),
});

export async function iniciarSesion(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const datos = esquemaLogin.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!datos.success) return { error: datos.error.issues[0]?.message };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword(datos.data);
  if (error) return { error: mensajeAmigable(error.message) };
  redirect(destinoSeguro(form.get("next")));
}

export async function registrarse(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const datos = esquemaRegistro.safeParse({
    nombre: form.get("nombre"),
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!datos.success) return { error: datos.error.issues[0]?.message };

  const next = destinoSeguro(form.get("next"));
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: datos.data.email,
    password: datos.data.password,
    options: {
      // `ref`: el código de quien lo invitó con su enlace; la base lo convierte en referido (un código que no existe no cuenta).
      data: { nombre: datos.data.nombre, ref: codigoValido(form.get("ref")) },
      emailRedirectTo: `${await urlDelSitio()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: mensajeAmigable(error.message) };
  if (data.session) redirect(next);
  return { aviso: "Te enviamos un correo para confirmar tu cuenta. Ábrelo desde este mismo teléfono y vuelve aquí." };
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}

const esquemaRecuperar = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido.")),
});

/** Pide el correo de recuperación. La respuesta es la misma exista o no la cuenta (no revela quién está registrado). */
export async function pedirRecuperacion(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const datos = esquemaRecuperar.safeParse({ email: form.get("email") });
  if (!datos.success) return { error: datos.error.issues[0]?.message };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(datos.data.email, {
    redirectTo: `${await urlDelSitio()}/auth/confirm?next=${encodeURIComponent("/cambiar-clave")}`,
  });
  // Solo se informa el límite de envíos; cualquier otro resultado se responde igual.
  if (error && /rate limit|too many|over_email_send_rate_limit|security purposes/i.test(error.message)) {
    return { error: mensajeAmigable(error.message) };
  }
  return { aviso: "Si ese correo tiene una cuenta, te enviamos un enlace para elegir una contraseña nueva. Ábrelo desde este mismo teléfono." };
}

const esquemaClave = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(72, "La contraseña es demasiado larga."),
    confirmar: z.string(),
  })
  .refine((d) => d.password === d.confirmar, { message: "Las dos contraseñas no coinciden.", path: ["confirmar"] });

/** Cambia la contraseña de quien tiene sesión (viene del enlace del correo o de «Más»). */
export async function cambiarClave(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  await obtenerUsuario();
  const datos = esquemaClave.safeParse({ password: form.get("password"), confirmar: form.get("confirmar") });
  if (!datos.success) return { error: datos.error.issues[0]?.message };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: datos.data.password });
  if (error) {
    if (/different from the old password|same_password/i.test(error.message)) {
      return { error: "Elige una contraseña distinta a la anterior." };
    }
    return { error: mensajeAmigable(error.message) };
  }
  redirect("/?clave=cambiada");
}
