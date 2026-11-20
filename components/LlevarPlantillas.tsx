import { Download, FileArchive } from "lucide-react";
import { RecuadroTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { Tarjeta } from "@/components/Tarjeta";
import { escena } from "@/lib/escenas";
import { ANCLA_PLANTILLAS_CAMPO, RUTA_PLANTILLAS_CAMPO } from "@/lib/plantillas-campo";

/**
 * «Llevar las plantillas al campo» en «Migrar mi finca»: descarga en un solo archivo comprimido las plantillas que la persona puede usar, para
 * llenarlas donde no hay señal y cargarlas al volver. No lleva `"use client"`: la descarga es un enlace común.
 */
export function LlevarPlantillas({ cantidad }: { cantidad: number }) {
  return (
    <Tarjeta id={ANCLA_PLANTILLAS_CAMPO} titulo="Llevar las plantillas al campo">
      <div className="space-y-3">
        <p className="text-[0.9375rem] text-humo [overflow-wrap:anywhere]">
          ¿Vas a anotar en el potrero o en el ordeño, donde no entra la señal? Descarga tus plantillas, llénalas sin internet en el celular o en el computador, y cárgalas aquí cuando vuelvas.
        </p>
        <RecuadroTarjetas compacto className="lg:max-w-sm">
          <div className="grid grid-cols-1 gap-2.5">
            <TarjetaOpcion
              tamano="normal"
              descarga
              escena={escena(FileArchive, "oliva", Download)}
              titulo="Descargar las plantillas"
              detalle={`${cantidad} ${cantidad === 1 ? "plantilla" : "plantillas"} de Excel con las listas de tu finca y una guía, en un solo archivo comprimido`}
              href={RUTA_PLANTILLAS_CAMPO}
            />
          </div>
        </RecuadroTarjetas>
        <p className="text-sm text-humo [overflow-wrap:anywhere]">Si cambian tus corrales, razas o productos, descárgalas de nuevo: las listas salen de tu finca el día de la descarga.</p>
      </div>
    </Tarjeta>
  );
}
