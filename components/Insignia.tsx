type Tono = "neutro" | "ok" | "alerta" | "aviso" | "musgo";

const TONOS: Record<Tono, string> = {
  neutro: "bg-arena text-humo",
  ok: "bg-ok/15 text-ok",
  alerta: "bg-rojo/12 text-rojo",
  aviso: "bg-ambar/15 text-ambar",
  musgo: "bg-musgo/12 text-musgo",
};

export function Insignia({ tono = "neutro", children }: { tono?: Tono; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONOS[tono]}`}>{children}</span>
  );
}
