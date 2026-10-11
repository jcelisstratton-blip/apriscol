import type { Metadata } from "next";
import { Aviso } from "@/components/Aviso";
import { Encabezado } from "@/components/Encabezado";
import { ListaFincasAdmin } from "@/components/ListaFincasAdmin";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Fincas" };

export default async function PaginaFincasAdmin() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_listar_fincas");

  return (
    <>
      <Encabezado titulo="Fincas" subtitulo="Todas las de la plataforma" />
      {error ? <Aviso tipo="error">{error.message}</Aviso> : <ListaFincasAdmin filas={data ?? []} />}
    </>
  );
}
