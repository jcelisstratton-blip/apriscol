"""Bajas de los últimos 12 meses (ventas, sacrificios y muertes). Datos FICTICIOS."""
import datetime as dt
import sim
from sim import HOY, T0
from hato import rnd, DIAS

COBRO_VENCIDO = {"MIR-C0305", "MIR-O0224"}
DETALLE_MUERTE = {"sanidad": ["Diarrea y deshidratación", "Neumonía", "Timpanismo", "Parasitosis severa"], "accidente": ["Aplastada por la madre", "Golpe en el corral", "Atrapada en la cerca"],
                  "edad": ["Murió de vejez"], "partos": ["Infección uterina posparto"], "reproductivo": ["Infección uterina posparto", "Retención de placenta complicada"], "otro": ["Murió sin causa clara"], "baja_produccion": ["Murió de vejez"]}


def construir(res):
    filas = []
    n_guia = 0
    for a in sorted(res["ventana"], key=lambda a: (a.baja["fecha"], a.clave)):
        b = a.baja
        r = rnd("baja", a.clave)
        edad = (HOY - b["fecha"]).days
        tipo = b["tipo"]
        motivo = b.get("motivo") or "otro"
        comprador = b.get("comprador")
        consumo = bool(b.get("destino_consumo"))
        cobrado = vence = None
        if tipo == "venta" and a.clave in COBRO_VENCIDO:
            vence = b["fecha"] + DIAS(days=15)      # cartera vencida a propósito (para mostrar «Lo que te deben»)
        elif tipo == "venta":
            if edad > 30 or (edad > 15 and r.random() < .7):
                cobrado = min(HOY, b["fecha"] + DIAS(days=r.randint(0, 18)))
            else:
                vence = b["fecha"] + DIAS(days=15)
        guia = None
        if tipo == "venta":
            n_guia += 1
            guia = f"GM-{b['fecha'].year}-{n_guia:05d}"
        detalle = None
        if tipo == "muerte":
            detalle = r.choice(DETALLE_MUERTE.get(motivo, ["Murió sin causa clara"]))
        elif tipo == "sacrificio":
            detalle = "Sacrificio para consumo de la finca"
        elif tipo == "venta" and not consumo:
            detalle = "Venta como reproductor o reemplazo"
        peso = b.get("peso_kg")
        filas.append([a.clave, tipo, b["fecha"].isoformat(), motivo if tipo != "muerte" or motivo in ("edad", "partos", "baja_produccion", "sanidad", "reproductivo", "accidente", "otro") else "otro",
                      consumo, peso, b.get("valor"), comprador, b.get("destino"), guia, detalle, cobrado.isoformat() if cobrado else None, vence.isoformat() if vence else None])
    return filas
