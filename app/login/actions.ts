"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlDelSitio } from "@/lib/sitio";
import { destinoSeguro } from "@/lib/redireccion";
import { mensajeAmigable } from "@/lib/mensaje-amigable";

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
      data: { nombre: datos.data.nombre },
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
