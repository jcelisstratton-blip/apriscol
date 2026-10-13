import type { Metadata } from "next";
import { FormAuth } from "@/components/FormAuth";
import { Presentacion } from "@/components/presentacion/Presentacion";
import { destinoSeguro } from "@/lib/redireccion";
import { registrarse } from "@/app/login/actions";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function PaginaRegistro({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <Presentacion modo="registro" formulario={<FormAuth accion={registrarse} modo="registro" next={next ? destinoSeguro(next) : undefined} />} />
  );
}
