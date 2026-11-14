import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Marca } from "@/components/Marca";
import { obtenerContexto } from "@/lib/contexto";
import { idAutorizacionValido, NUNCA_PODRA, PODRA_VER } from "@/lib/mcp/consentimiento";
import { ETIQUETA_ROL } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { negarAcceso, permitirAcceso } from "./actions";

export const metadata: Metadata = { title: "Permitir acceso", robots: { index: false } };

const Marco = ({ children }: { children: React.ReactNode }) => (
  <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-4 py-8">
    <Marca className="self-center" />
    {children}
  </main>
);

/**
 * Pantalla de permiso: Claude pidió ver la finca de la persona. Se llega aquí desde Claude (Supabase redirige con `authorization_id`); quien no ha entrado pasa
 * primero por el inicio de sesión y vuelve. La persona ve qué podrá y qué nunca podrá hacer el asistente, y decide. Sin jerga técnica.
 */
export default async function PaginaPermiso({ searchParams }: { searchParams: Promise<{ authorization_id?: string; error?: string }> }) {
  const { authorization_id: id, error } = await searchParams;
  if (!idAutorizacionValido(id)) {
    return (
      <Marco>
        <Aviso tipo="atencion">Este enlace no sirve. Vuelve a Claude y toca «Conectar» otra vez.</Aviso>
      </Marco>
    );
  }
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data, error: errorDetalle } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (data && "redirect_url" in data) redirect(data.redirect_url); // ya lo había permitido antes
  if (errorDetalle || !data || !("authorization_id" in data)) {
    return (
      <Marco>
        <Aviso tipo="atencion">Esta solicitud ya venció o ya se usó. Vuelve a Claude y toca «Conectar» otra vez.</Aviso>
      </Marco>
    );
  }
  const nombre = data.client.name?.trim() || "Un asistente de IA";

  return (
    <Marco>
      <div className="space-y-5 rounded-3xl bg-papel p-5 ring-1 ring-arena">
        <div className="space-y-1.5 text-center">
          <h1 className="font-display text-2xl font-semibold [overflow-wrap:anywhere]">{nombre} quiere ver tu finca</h1>
          <p className="text-[0.9375rem] text-humo [overflow-wrap:anywhere]">
            <strong>{finca.nombre}</strong> · entras como {ETIQUETA_ROL[rol].toLowerCase()}
          </p>
        </div>

        <div className="space-y-2.5">
          <p className="text-sm font-semibold">Podrá ver:</p>
          <ul className="space-y-2">
            {PODRA_VER.map((t) => (
              <li key={t} className="flex min-w-0 items-start gap-2.5 text-[0.9375rem]">
                <Check className="mt-0.5 size-5 shrink-0 text-musgo" strokeWidth={2} aria-hidden="true" />
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl bg-lana p-3.5 text-[0.9375rem]">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-musgo" strokeWidth={1.75} aria-hidden="true" />
          <p className="min-w-0">
            <strong>Nunca podrá:</strong> {NUNCA_PODRA}
          </p>
        </div>

        {error ? <Aviso tipo="error">No se pudo guardar tu respuesta. Intenta de nuevo.</Aviso> : null}

        <form className="grid grid-cols-1 gap-2.5">
          <input type="hidden" name="authorization_id" value={id} />
          <Boton formAction={permitirAcceso}>Permitir</Boton>
          <Boton variante="secundario" formAction={negarAcceso}>Ahora no</Boton>
        </form>
        <p className="text-center text-xs text-humo">Puedes quitar este permiso cuando quieras en Mi finca → Conexión con IA.</p>
      </div>
    </Marco>
  );
}
