import { SenalesDeArea } from "@/components/SenalesDeArea";
const it = (n: string, nivel: "rojo" | "ambar") => ({ clave: n, etiqueta: n, detalle: "d", nivel, href: "/x", orden: 0 });
const senales = [
  { id: "dosis", area: "sanidad", titulo: "Dosis y programas por aplicar", nivel: "rojo", resumen: "8 en rojo · 3 en ámbar", items: [it("Penicilina con estreptomicina", "ambar"), it("Sulfato de zinc 10 %", "ambar"), it("Vacuna clostridial 7 vías", "rojo"), it("Cuarto", "rojo")], atendidos: [], queHacer: "Aplica cada dosis pendiente con su producto a los animales que dice la lista, empezando por las vencidas, y registra la aplicación.", queSignifica: "", regla: "" },
  { id: "x", area: "sanidad", titulo: "Pezuñas y pediluvio", nivel: "rojo", resumen: "2 en rojo", items: [it("Hongo-sin-espacios-muy-largo-para-probar-el-ajuste-en-celular-MIR-C0001", "rojo")], atendidos: [], queHacer: "Programa la revisión.", queSignifica: "", regla: "" },
] as never;
export default function P() { return <main className="mx-auto max-w-md px-4"><SenalesDeArea area="sanidad" senales={senales} /></main>; }
