"""Simulación demográfica del Aprisco Piloto El Mirador (datos FICTICIOS, deterministas).

Simula día a día desde la compra de las fundadoras (2019) hasta HOY: partos, mortalidad de crías, destete, reemplazos, ceba, ventas y
descartes. De ahí salen los animales con su genealogía real (padres siempre anteriores a los hijos) y las bajas.
Solo se emiten los animales que importan hoy: los vivos, los que salieron dentro de los últimos 12 meses y los antepasados de unos y otros.

Uso:  python3 sim.py            -> imprime el resumen del hato
      (los emisores SQL importan `simular()`)
"""
from __future__ import annotations

import datetime as dt
import random
import uuid
from dataclasses import dataclass, field
from functools import lru_cache

HOY = dt.date(2026, 10, 27)
T0 = dt.date(2025, 10, 28)           # «adopción»: desde aquí hay historia en Apriscol (12 meses)
INICIO = dt.date(2019, 10, 15)       # compra de las fundadoras
NS = uuid.UUID("5e1f0a11-0000-4000-8000-00000000ffff")

# ── razas (id de la tabla razas) ────────────────────────────────────────────────────────────────────────────
SAANEN, ALPINA, TOGGENBURG, LAMANCHA, BOER, CRIOLLA, CRUCE_C = 1, 2, 3, 5, 6, 7, 8
KATAHDIN, DORPER, PELIBUEY, CRIOLLO_O, CRUCE_O = 9, 10, 11, 13, 15
VOCACION = {SAANEN: "leche", ALPINA: "leche", TOGGENBURG: "leche", LAMANCHA: "leche", BOER: "carne", CRIOLLA: "doble", CRUCE_C: "doble",
            KATAHDIN: "carne", DORPER: "carne", PELIBUEY: "carne", CRIOLLO_O: "doble", CRUCE_O: "carne"}
NOMBRE_RAZA = {SAANEN: "Saanen", ALPINA: "Alpina", TOGGENBURG: "Toggenburg", LAMANCHA: "LaMancha", BOER: "Boer", CRIOLLA: "Criolla", CRUCE_C: "Cruce",
               KATAHDIN: "Katahdin", DORPER: "Dorper", PELIBUEY: "Pelibuey", CRIOLLO_O: "Criollo colombiano", CRUCE_O: "Cruce"}
COLOR = {SAANEN: ["Blanco", "Crema"], ALPINA: ["Chamoisée", "Cou blanc", "Sundgau"], TOGGENBURG: ["Marrón con blanco", "Café claro"],
         LAMANCHA: ["Café", "Moteada", "Blanca"], BOER: ["Blanco con cabeza café", "Café"], CRIOLLA: ["Pintada", "Negra", "Café"],
         CRUCE_C: ["Pintada", "Crema", "Café"], KATAHDIN: ["Café claro", "Blanco con café"], DORPER: ["Blanco con cabeza negra", "Negro con blanco"],
         PELIBUEY: ["Canela", "Café", "Rojizo"], CRIOLLO_O: ["Café", "Pintado", "Negro"], CRUCE_O: ["Café", "Pintado"]}

NOMBRES_H_C = """Ceniza Luna Canela Perla Nube Chispa Margarita Aurora Nieve Blanca Moka Trigueña Pitufa Lucero Estrella Brisa Amapola Violeta Jazmín
Magnolia Dalia Azucena Orquídea Clavel Rosita Mariposa Gardenia Alondra Paloma Golondrina Colibrí Mirla Tórtola Candela Lluvia Neblina Escarcha Rocío
Aurelia Fresia Maya Nina Lola Sol Mora Flor Mística Dulce Princesa Reina Fiona Heidi Bambi Tamarindo Chocolatina Galleta Merengue Mantecada Arequipe
Panela Almojábana Buñuelo Natilla Brevas Cocada Alegría Esperanza Fortuna Gloria Bendición Milagros Consuelo Piedad Soledad Victoria Prudencia
Clemencia Paciencia Constancia Caridad Fe Gracia Hermosa Linda Preciosa Bella Coqueta Celosa Tímida Lista Traviesa Juguetona Bonita""".split()
NOMBRES_H_O = """Algodón Lanita Pelusa Copo Bonita Mimosa Zarza Tuna Cereza Manzana Uva Fresa Guayaba Mandarina Naranja Limón Mango Papaya Lulo Maracuyá
Granadilla Curuba Tomate Ciruela Pera Durazno Kiwi Piña Sandía Melón Coco Banana Borojó Zapote Mamoncillo Níspero Feijoa Uchuva Pitaya Aguacate
Cebolla Zanahoria Remolacha Rábano Lechuga Espinaca Acelga Albahaca Menta Romero Tomillo Orégano Cilantro Perejil Hierbabuena Manzanilla Ruda
Sábila Caléndula Lavanda Rosal Hortensia Camelia Begonia Petunia Margarita Tulipán Girasol Narciso Lirio Peonía Crisantemo""".split()
NOMBRES_M_C = """Rey Trueno Apolo Zeus Goliat Bruno Tizón Capitán Simba Rocky Toro Tarzán Hércules Fénix Relámpago Centella Rayo Cóndor Halcón Águila Lobo
Oso Tigre León Pantera Jaguar Puma Titán Atlas Júpiter Marte Neptuno Saturno Orión Sirius Bandido Chato Pepe Tito Nacho Memo Lucho Beto Cheo
Moncho Pacho Rufo Tomás Isidro Evaristo Abelardo Clodomiro Anselmo Bartolo Cleto Eusebio Fabián Gaspar Hilario Ismael Jeremías Lázaro""".split()
NOMBRES_M_O = """Sansón Hércules Atlas Titán Gladiador Campeón Patriarca Cacique Mariscal General Coronel Sargento Cabo Teniente Comandante Almirante
Emperador Faraón Sultán Califa Rajá Zar Kaiser Duque Barón Conde Marqués Vizconde Príncipe Caballero Escudero Paje Juglar Trovador
Bardo Cronista Mago Hechicero Brujo Chamán Curandero Yerbatero Sobandero Partero Cantinero Arriero Vaquero Llanero Paisano""".split()


@dataclass(eq=False)
class A:
    """Un animal del hato (o de su historia)."""
    clave: str                        # arete (único)
    especie: str                      # 'caprino' | 'ovino'
    sexo: str                         # 'hembra' | 'macho'
    raza: int
    nac: dt.date
    padre: "A | None" = None
    madre: "A | None" = None
    padre_ext: str | None = None
    madre_ext: str | None = None
    origen: str = "nacido_en_finca"   # | 'comprado'
    compra: dt.date | None = None
    valor_compra: int | None = None
    nombre: str | None = None
    peso_nacer: float | None = None
    baja: dict | None = None          # {tipo, fecha, motivo, ...}
    uso_macho: str | None = None      # 'reproductor' | 'carne' (solo machos)
    destino: str = ""                 # plan: 'reemplazo' | 'ceba' | 'reproductor' | 'cria'
    parto_n: int = 0                  # partos que ha tenido (simulados)
    proximo_parto: dt.date | None = None
    ultimo_parto: dt.date | None = None
    partos: list = field(default_factory=list)   # [(fecha, [crías], padre)]
    venta_prevista: dt.date | None = None
    nac_aprox: bool = False
    color: str = ""
    hijos: list = field(default_factory=list)
    decidido: bool = False            # ya se decidió su destino al destete
    sembrada: bool = False            # cría de un apareamiento emparentado sembrado a propósito (se conserva si es hembra)
    id: str = ""

    def edad_dias(self, d): return (d - self.nac).days
    def vivo(self, d): return self.nac <= d and (self.baja is None or self.baja["fecha"] > d)
    @property
    def es_h(self): return self.sexo == "hembra"


def _kinship_factory():
    @lru_cache(maxsize=None)
    def phi(a: A | None, b: A | None) -> float:
        if a is None or b is None: return 0.0
        if a is b: return 0.5 * (1 + f(a))
        # el más joven se descompone en sus padres
        if a.nac < b.nac: a, b = b, a
        return 0.5 * (phi(a.padre, b) + phi(a.madre, b))
    @lru_cache(maxsize=None)
    def f(a: A) -> float:
        return phi(a.padre, a.madre) if a.padre and a.madre else 0.0
    return phi, f


def simular(seed: int = 7, verbose: bool = False):
    SIEMBRA["padre_hija"] = SIEMBRA["medios"] = 0
    SIEMBRA["_ultimo"] = False
    rng = random.Random(seed)
    phi, coef = _kinship_factory()
    todos: list[A] = []
    contador = {"caprino": 0, "ovino": 0}
    usados: set[str] = set()
    nom_pool = {("caprino", "hembra"): NOMBRES_H_C[:], ("ovino", "hembra"): NOMBRES_H_O[:], ("caprino", "macho"): NOMBRES_M_C[:], ("ovino", "macho"): NOMBRES_M_O[:]}
    for v in nom_pool.values(): rng.shuffle(v)

    def nuevo(especie, sexo, raza, nac, **kw) -> A:
        contador[especie] += 1
        pref = "C" if especie == "caprino" else "O"
        clave = f"MIR-{pref}{contador[especie]:04d}"
        a = A(clave=clave, especie=especie, sexo=sexo, raza=raza, nac=nac, **kw)
        a.color = rng.choice(COLOR[raza])
        a.id = str(uuid.uuid5(NS, "animal:" + clave))
        todos.append(a)
        return a

    # ── parámetros por especie ───────────────────────────────────────────────────────────────────────────────
    P = {
        "caprino": dict(gest=150, edad_primer_parto=(440, 520), intervalo=(270, 350), camada=[(1, .50), (2, .42), (3, .08)], meta_hembras=32, deseados_machos=3,
                        peso_nacer=(2.4, 4.2), mort_cria=.06, precio_kg_vivo=9800, venta_macho_dias=(150, 250), edad_descarte=2700, p_descarte_anual=.14),
        "ovino": dict(gest=147, edad_primer_parto=(420, 500), intervalo=(250, 310), camada=[(1, .78), (2, .21), (3, .01)], meta_hembras=21, deseados_machos=2,
                      peso_nacer=(3.0, 5.0), mort_cria=.05, precio_kg_vivo=8600, venta_macho_dias=(170, 230), edad_descarte=2900, p_descarte_anual=.12),
    }

    def elegir_camada(esp):
        r, acu = rng.random(), 0.0
        for n, p in P[esp]["camada"]:
            acu += p
            if r < acu: return n
        return 1

    # ── fundadoras y fundadores (comprados) ──────────────────────────────────────────────────────────────────
    def comprado(especie, sexo, raza, nac, compra, valor, padre_ext, madre_ext, **kw):
        a = nuevo(especie, sexo, raza, nac, origen="comprado", compra=compra, valor_compra=valor, padre_ext=padre_ext, madre_ext=madre_ext, **kw)
        a.nac_aprox = True
        return a

    c0 = dt.date(2019, 10, 15)
    for raza, n in [(SAANEN, 3), (ALPINA, 2), (TOGGENBURG, 2), (LAMANCHA, 1), (CRIOLLA, 1)]:
        for _ in range(n):
            a = comprado("caprino", "hembra", raza, c0 - dt.timedelta(days=rng.randint(560, 1100)), c0, rng.randint(520, 780) * 1000,
                         "Semental de la Granja Los Almendros", "Hembra de la Granja Los Almendros")
            a.destino = "cria"
    rey = comprado("caprino", "macho", SAANEN, dt.date(2017, 8, 12), c0, 1_450_000, "Granja Los Almendros", "Granja Los Almendros", uso_macho="reproductor")
    rey.nombre = "Rey"
    trueno = comprado("caprino", "macho", ALPINA, dt.date(2018, 3, 5), c0, 1_300_000, "Granja Los Almendros", "Granja Los Almendros", uso_macho="reproductor")
    trueno.nombre = "Trueno"
    for raza, n in [(KATAHDIN, 4), (DORPER, 3), (PELIBUEY, 3), (CRIOLLO_O, 1)]:
        for _ in range(n):
            a = comprado("ovino", "hembra", raza, c0 - dt.timedelta(days=rng.randint(480, 1000)), c0 + dt.timedelta(days=20), rng.randint(380, 560) * 1000,
                         "Hato Villa Esperanza", "Hato Villa Esperanza")
            a.destino = "cria"
    atlas = comprado("ovino", "macho", KATAHDIN, dt.date(2018, 6, 2), c0 + dt.timedelta(days=20), 1_100_000, "Hato Villa Esperanza", "Hato Villa Esperanza", uso_macho="reproductor")
    atlas.nombre = "Atlas"

    # compras posteriores programadas (sangre nueva)
    compras = [
        (dt.date(2022, 3, 20), "caprino", "macho", TOGGENBURG, dt.date(2021, 6, 9), 1_250_000, "Apolo", "reproductor"),
        (dt.date(2023, 5, 10), "ovino", "macho", DORPER, dt.date(2022, 8, 14), 1_050_000, "Sansón", "reproductor"),
        (dt.date(2024, 2, 18), "caprino", "macho", BOER, dt.date(2023, 4, 22), 1_800_000, "Goliat", "reproductor"),
        (dt.date(2025, 2, 11), "caprino", "hembra", LAMANCHA, dt.date(2023, 9, 3), 900_000, None, None),
        (dt.date(2025, 6, 24), "ovino", "hembra", KATAHDIN, dt.date(2024, 5, 19), 620_000, None, None),
        (dt.date(2026, 10, 12), "caprino", "hembra", SAANEN, dt.date(2025, 3, 15), 1_100_000, None, None),   # compra reciente SIN cuarentena (alerta a propósito)
        (dt.date(2026, 10, 20), "caprino", "hembra", ALPINA, dt.date(2025, 6, 1), 1_050_000, None, None),    # en cuarentena hoy
    ]
    compras.sort()

    def abre_nacimiento(a: A):
        """Primer parto programado de una hembra nacida (o comprada) y su cadena."""
        p = P[a.especie]
        if a.origen == "comprado":
            a.proximo_parto = max(a.compra, a.nac + dt.timedelta(days=p["edad_primer_parto"][0])) + dt.timedelta(days=rng.randint(45, 140))
        else:
            a.proximo_parto = a.nac + dt.timedelta(days=rng.randint(*p["edad_primer_parto"]))

    for a in list(todos):
        if a.es_h: abre_nacimiento(a)

    # ── helpers de población ─────────────────────────────────────────────────────────────────────────────────
    def vivos(esp, d, sexo=None):
        return [a for a in todos if a.especie == esp and a.vivo(d) and (sexo is None or a.sexo == sexo)]

    def hembras_cria(esp, d):
        lim = {"caprino": 330, "ovino": 330}[esp]
        return [a for a in vivos(esp, d, "hembra") if a.edad_dias(d) >= lim or a.destino == "cria"]

    def dar_baja(a: A, d, tipo, motivo=None, **kw):
        if a.baja is not None: return
        a.baja = {"tipo": tipo, "fecha": d, "motivo": motivo, **kw}

    def precio_animal(a: A, peso: float, d) -> int:
        esp = a.especie
        if a.destino == "reemplazo" or (a.es_h and peso < 45):
            base = {SAANEN: 780, ALPINA: 740, TOGGENBURG: 700, LAMANCHA: 700, CRIOLLA: 380, CRUCE_C: 450, BOER: 900,
                    KATAHDIN: 620, DORPER: 640, PELIBUEY: 520, CRIOLLO_O: 380, CRUCE_O: 480}[a.raza]
            return int(base * 1000 * rng.uniform(.85, 1.15) / 1000) * 1000
        return int(peso * P[esp]["precio_kg_vivo"] * rng.uniform(.9, 1.1) / 1000) * 1000

    def peso_a_edad(a: A, d) -> float:
        dias = a.edad_dias(d)
        esp = a.especie
        adulto = {"caprino": 52 if a.es_h else 75, "ovino": 48 if a.es_h else 70}[esp]
        if a.raza in (BOER, DORPER, KATAHDIN) and not a.es_h: adulto *= 1.12
        nac = a.peso_nacer or 3.2
        # curva logística suave desde el peso al nacer hasta el adulto
        x = min(dias / 700.0, 1.0)
        w = nac + (adulto - nac) * (1 - (1 - x) ** 2.2)
        return round(w * rng.uniform(.94, 1.06), 1)

    # ── bucle diario ─────────────────────────────────────────────────────────────────────────────────────────
    d = INICIO
    pendientes_compra = list(compras)
    while d <= HOY:
        # compras programadas
        while pendientes_compra and pendientes_compra[0][0] <= d:
            fecha, esp, sexo, raza, nac, valor, nombre, uso = pendientes_compra.pop(0)
            a = comprado(esp, sexo, raza, nac, fecha, valor, "Granja externa", "Granja externa", uso_macho=uso if sexo == "macho" else None)
            if nombre: a.nombre = nombre
            if sexo == "hembra":
                a.destino = "cria"
                abre_nacimiento(a)
                if fecha >= dt.date(2026, 10, 1):
                    a.proximo_parto = HOY + dt.timedelta(days=200)

        # partos
        for a in [x for x in todos if x.es_h and x.proximo_parto == d and x.baja is None]:
            esp = a.especie
            p = P[esp]
            concepcion = d - dt.timedelta(days=p["gest"])
            SIEMBRA["_ultimo"] = False
            padre = elegir_padre(a, esp, concepcion, todos, phi, rng, nuevo, comprado, d)
            sembrada = SIEMBRA["_ultimo"]
            n = elegir_camada(esp)
            crias = []
            for _ in range(n):
                sexo = rng.choice(["hembra", "macho"])
                raza = raza_cria(padre, a, esp, rng)
                c = nuevo(esp, sexo, raza, d, padre=padre, madre=a, peso_nacer=round(rng.uniform(*p["peso_nacer"]) - (0.25 if n > 1 else 0), 1))
                c.uso_macho = None
                c.sembrada = sembrada
                crias.append(c)
                a.hijos.append(c)
                if padre: padre.hijos.append(c)
                if rng.random() < p["mort_cria"] and not sembrada:
                    dar_baja(c, d + dt.timedelta(days=rng.randint(1, 40)), "muerte", "sanidad")
                else:
                    c.venta_prevista = d + dt.timedelta(days=95)   # momento de decidir el destino (destete)
            a.partos.append((d, crias, padre))
            a.parto_n += 1
            a.ultimo_parto = d
            # el siguiente parto: intervalo normal; algunas quedan vacías un ciclo más
            gap = rng.randint(*p["intervalo"]) + (rng.choice([0, 0, 0, 40, 70]) if esp == "caprino" else 0)
            a.proximo_parto = d + dt.timedelta(days=gap)
            if a.proximo_parto > HOY + dt.timedelta(days=400): a.proximo_parto = None

        # destete / destino de las crías
        for c in [x for x in todos if x.venta_prevista == d and x.baja is None and not x.decidido]:
            esp = c.especie
            p = P[esp]
            c.decidido = True
            if c.es_h:
                n_h = len(hembras_cria(esp, d)) + len([x for x in vivos(esp, d, "hembra") if x.destino == "reemplazo" and x.edad_dias(d) < 330])
                if c.sembrada or (n_h < p["meta_hembras"] * 1.12 and rng.random() < .85):
                    c.destino = "reemplazo"
                    abre_nacimiento(c)
                else:
                    c.destino = "venta_h"
                    c.venta_prevista = d + dt.timedelta(days=rng.randint(40, 140))
                    continue
            else:
                n_m = len([x for x in vivos(esp, d, "macho") if x.uso_macho == "reproductor" or x.destino == "reproductor"])
                if n_m < p["deseados_machos"] and c.raza in ({SAANEN, ALPINA, TOGGENBURG, LAMANCHA} if esp == "caprino" else {KATAHDIN, DORPER, PELIBUEY}) and rng.random() < .6:
                    c.destino = "reproductor"
                    c.uso_macho = "reproductor"
                    c.venta_prevista = None
                    continue
                c.destino = "ceba"
                c.uso_macho = "carne"
                c.venta_prevista = c.nac + dt.timedelta(days=rng.randint(*p["venta_macho_dias"]))
            if c.destino in ("reemplazo", "reproductor", "cria"):
                c.venta_prevista = None

        # ventas programadas (ceba y hembras sobrantes)
        for c in [x for x in todos if x.venta_prevista == d and x.baja is None and x.destino in ("ceba", "venta_h")]:
            peso = peso_a_edad(c, d)
            if c.destino == "ceba":
                dar_baja(c, d, "venta", "otro", destino_consumo=True, peso_kg=peso, valor=precio_animal(c, peso, d), comprador="Frigorífico Don Gabriel", destino="Frigorífico Don Gabriel")
            else:
                dar_baja(c, d, "venta", "otro", destino_consumo=False, peso_kg=peso, valor=precio_animal(c, peso, d), comprador=rng.choice(["Finca La Esmeralda", "Cliente particular"]), destino="Reproducción en otra finca")
            c.venta_prevista = None

        # revisión mensual: descartes de adultos y reemplazo de reproductores
        if d.day == 15:
            for esp in ("caprino", "ovino"):
                p = P[esp]
                repros = sorted([x for x in vivos(esp, d, "macho") if x.uso_macho == "reproductor" and x.edad_dias(d) > 900], key=lambda x: x.nac)
                while len(repros) > p["deseados_machos"] + 1:
                    v = repros.pop(0)
                    peso = peso_a_edad(v, d)
                    dar_baja(v, d, "venta", "edad", destino_consumo=True, peso_kg=peso, valor=precio_animal(v, peso, d), comprador="Frigorífico Don Gabriel", destino="Frigorífico Don Gabriel")
                for a in vivos(esp, d):
                    if a.origen == "comprado" and a.compra and (d - a.compra).days < 200: continue
                    edad = a.edad_dias(d)
                    if a.es_h and a.destino in ("cria", "reemplazo") and edad > 365:
                        prob = p["p_descarte_anual"] / 12 * (3 if edad > p["edad_descarte"] else 1)
                        if rng.random() < prob and len(hembras_cria(esp, d)) > p["meta_hembras"] * .8:
                            motivo = rng.choice(["edad", "partos", "baja_produccion", "reproductivo", "sanidad"]) if edad > 1900 else rng.choice(["baja_produccion", "reproductivo", "sanidad", "accidente"])
                            tipo = rng.choices(["venta", "muerte", "sacrificio"], [.72, .2, .08])[0]
                            peso = peso_a_edad(a, d)
                            if tipo == "venta":
                                dar_baja(a, d, "venta", motivo, destino_consumo=True, peso_kg=peso, valor=precio_animal(a, peso, d), comprador="Frigorífico Don Gabriel", destino="Frigorífico Don Gabriel")
                            elif tipo == "sacrificio":
                                dar_baja(a, d, "sacrificio", motivo, destino_consumo=True, peso_kg=peso, valor=0, destino="Consumo en la finca")
                            else:
                                dar_baja(a, d, "muerte", motivo)
                            a.proximo_parto = None
                    if (not a.es_h) and a.uso_macho == "reproductor" and edad > 365 * 5.5 and rng.random() < .25:
                        peso = peso_a_edad(a, d)
                        dar_baja(a, d, "venta", "edad", destino_consumo=True, peso_kg=peso, valor=precio_animal(a, peso, d), comprador="Frigorífico Don Gabriel", destino="Frigorífico Don Gabriel")
        d += dt.timedelta(days=1)

    # ── resultado ────────────────────────────────────────────────────────────────────────────────────────────
    vivos_hoy = [a for a in todos if a.vivo(HOY) and a.nac <= HOY]
    en_ventana = [a for a in todos if a.baja and T0 <= a.baja["fecha"] <= HOY]
    # antepasados de lo que se muestra
    necesarios: set[A] = set(vivos_hoy) | set(en_ventana)
    frontera = list(necesarios)
    while frontera:
        x = frontera.pop()
        for p in (x.padre, x.madre):
            if p is not None and p not in necesarios:
                necesarios.add(p)
                frontera.append(p)
    emitir = sorted(necesarios, key=lambda a: (a.nac, a.clave))
    reservados = {a.nombre for a in emitir if a.nombre}
    for a in emitir:
        if a.nombre: continue
        pool = [n for n in nom_pool[(a.especie, a.sexo)] if n not in reservados]
        a.nombre = pool.pop() if pool else f"{('Cabrito' if a.sexo == 'macho' else 'Cabrita') if a.especie == 'caprino' else ('Cordero' if a.sexo == 'macho' else 'Corderita')} {a.clave[-3:]}"
        reservados.add(a.nombre)
        nom_pool[(a.especie, a.sexo)] = [n for n in nom_pool[(a.especie, a.sexo)] if n != a.nombre]
    if verbose:
        resumen(todos, emitir, vivos_hoy, en_ventana, phi, coef)
    return dict(todos=todos, emitir=emitir, vivos=vivos_hoy, ventana=en_ventana, phi=phi, coef=coef, rng=rng, P=P)


def raza_cria(padre, madre, esp, rng):
    r1 = padre.raza if padre else None
    r2 = madre.raza
    if esp == "caprino":
        if r1 is None or r1 == r2: return r2
        return CRUCE_C
    if r1 is None or r1 == r2: return r2
    return CRUCE_O if rng.random() < .5 else rng.choice([r1, r2])


SIEMBRA = {"padre_hija": 0, "medios": 0, "_ultimo": False}   # contadores de los casos sembrados (se reinician en cada simulación)


def elegir_padre(madre, esp, concepcion, todos, phi, rng, nuevo, comprado, hoy):
    """Reproductor vivo en la concepción con parentesco bajo con la hembra (≤ 0,07); si no hay, se compra uno de fuera.
    Rara vez (≈5 %) se acepta uno de parentesco medio (≤ 0,13: medios hermanos o primos), que da los casos reales de endogamia."""
    if madre.nac > concepcion: return None
    cand = [a for a in todos if a.especie == esp and not a.es_h and a.vivo(concepcion) and a.edad_dias(concepcion) >= 240
            and (a.uso_macho == "reproductor" or a.destino == "reproductor" or a.origen == "comprado") and a.uso_macho != "carne"]
    # Casos sembrados: un error de manejo en 2023 (padre con su hija) y apareamientos entre medios hermanos en 2025
    if esp == "caprino":
        if dt.date(2022, 6, 1) <= concepcion <= dt.date(2025, 3, 30) and SIEMBRA["padre_hija"] < 2:
            pap = [a for a in cand if a is madre.padre]
            if pap:
                SIEMBRA["padre_hija"] += 1
                SIEMBRA["_ultimo"] = True
                return pap[0]
        if dt.date(2024, 9, 1) <= concepcion <= dt.date(2026, 3, 30) and SIEMBRA["medios"] < 3:
            med = [a for a in cand if 0.06 <= phi(a, madre) <= 0.13]
            if med:
                SIEMBRA["medios"] += 1
                SIEMBRA["_ultimo"] = True
                return med[0]
    misma = [a for a in cand if a.raza == madre.raza]
    boer = [a for a in cand if a.raza == BOER]
    pools = []
    if esp == "caprino" and boer and hoy >= dt.date(2024, 3, 1) and rng.random() < .18: pools.append(boer)
    pura = madre.raza in (SAANEN, ALPINA, TOGGENBURG, LAMANCHA, KATAHDIN, DORPER, PELIBUEY)
    if misma and rng.random() < .85: pools.append(misma)
    if not pura or rng.random() < .07: pools.append(cand)
    medio = None
    for pool in pools:
        if not pool: continue
        puntos = sorted(((phi(a, madre), rng.random(), a) for a in pool), key=lambda t: (t[0], t[1]))
        if puntos[0][0] <= 0.07:
            buenos = [t for t in puntos if t[0] <= puntos[0][0] + 0.02 and t[0] <= 0.07]
            return rng.choice(buenos)[2]
        if medio is None and puntos[0][0] <= 0.13: medio = puntos[0][2]
    if medio is not None and rng.random() < .15:
        return medio
    # sangre nueva: se compra un reproductor de fuera (como haría el productor)
    if esp == "caprino":
        raza = madre.raza if madre.raza in (SAANEN, ALPINA, TOGGENBURG, LAMANCHA) else rng.choice([SAANEN, ALPINA, TOGGENBURG])
    else:
        raza = madre.raza if madre.raza in (KATAHDIN, DORPER, PELIBUEY) else rng.choice([KATAHDIN, DORPER])
    compra = max(INICIO, concepcion - dt.timedelta(days=rng.randint(25, 90)))
    nac = compra - dt.timedelta(days=rng.randint(550, 950))
    return comprado(esp, "macho", raza, nac, compra, rng.randint(1_000, 1_700) * 1000, "Granja externa", "Granja externa", uso_macho="reproductor")


def resumen(todos, emitir, vivos_hoy, ventana, phi, coef):
    from collections import Counter
    print(f"animales simulados: {len(todos)} · se emiten: {len(emitir)} · vivos hoy: {len(vivos_hoy)} · bajas en 12 meses: {len(ventana)}")
    for esp in ("caprino", "ovino"):
        vv = [a for a in vivos_hoy if a.especie == esp]
        hem = [a for a in vv if a.es_h]
        mac = [a for a in vv if not a.es_h]
        print(f"  {esp}: vivos {len(vv)} (hembras {len(hem)}, machos {len(mac)}) | razas {dict(Counter(NOMBRE_RAZA[a.raza] for a in vv))}")
        adultas = [a for a in hem if a.edad_dias(HOY) >= 330]
        print(f"     adultas {len(adultas)} · jóvenes/crías hembras {len(hem) - len(adultas)} · reproductores {len([a for a in mac if a.uso_macho == 'reproductor'])} · ceba/jóvenes machos {len([a for a in mac if a.uso_macho != 'reproductor'])}")
        print(f"     partos en 12 meses: {sum(1 for a in todos if a.especie == esp for f, c, p in a.partos if T0 <= f <= HOY)} · crías nacidas: {sum(len(c) for a in todos if a.especie == esp for f, c, p in a.partos if T0 <= f <= HOY)}")
    ci = sorted(((coef(a), a) for a in emitir if a.padre and a.madre), key=lambda t: -t[0])[:6]
    print("  mayor endogamia (emitidos):", [(round(c, 3), a.clave, a.nombre) for c, a in ci])
    print("  bajas por tipo (12 meses):", dict(Counter(a.baja["tipo"] for a in ventana)))
    print("  generaciones máx:", max(prof(a) for a in emitir))


def prof(a: A) -> int:
    ps = [x for x in (a.padre, a.madre) if x]
    return 1 + max((prof(p) for p in ps), default=0) if ps else 1


if __name__ == "__main__":
    import sys
    simular(int(sys.argv[1]) if len(sys.argv) > 1 else 7, verbose=True)
