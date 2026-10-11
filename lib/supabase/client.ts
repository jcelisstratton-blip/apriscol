import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/lib/tipos";

let cliente: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function crearClienteNavegador() {
  cliente ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY);
  return cliente;
}
