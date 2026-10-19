import type { Metadata } from "next";
import Link from "next/link";
import { Contacto } from "@/components/legal/Contacto";
import { Lista, P, PaginaLegal, Resumen, Tabla, type SeccionLegal } from "@/components/legal/PaginaLegal";
import { RESPONSABLE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos guarda Apriscol, dónde (Supabase), cómo se protegen y cómo ejercer tus derechos como titular.",
};

const SECCIONES: SeccionLegal[] = [
  {
    id: "responsable",
    titulo: "Quién es el responsable de tus datos",
    contenido: (
      <>
        <P>
          El responsable del tratamiento de los datos personales de Apriscol es <strong>{RESPONSABLE}</strong>. Esta política aplica a quienes usan la aplicación (propietarios, administradores, ordeñadores, veterinarios y contadores) y se rige por la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y las demás normas colombianas de protección de datos personales.
        </P>
        <P>
          Cuando creas una cuenta, nos autorizas de manera previa, expresa e informada para tratar tus datos como aquí se explica. Para escribirnos: <Contacto />.
        </P>
      </>
    ),
  },
  {
    id: "datos",
    titulo: "Qué datos guardamos",
    contenido: (
      <>
        <P>Solo guardamos lo que Apriscol necesita para funcionar:</P>
        <Tabla
          filas={[
            ["Tu cuenta", "Nombre, correo y contraseña (esta última cifrada; no se puede leer)."],
            ["Tu finca", "Nombre, departamento, municipio y vereda; coordenadas si las registras; especies y propósito del aprisco."],
            ["Tu equipo", "Correo y rol de las personas que invitas, y la fecha en que aceptan."],
            ["Tu hato y tu trabajo diario", "Animales, genealogía, leche, sanidad y retiros, reproducción, partos, corrales y movimientos, ceba y pesos, ferias y premios, compras, ventas y costos."],
            ["Tus archivos", "Fotos de animales y de premios, y soportes (facturas, constancias, resultados) en PDF o imagen."],
            ["Terceros que tú registras", "Por ejemplo, el nombre y teléfono del dueño de un semental prestado, o el nombre de tus proveedores y compradores. Debes tener su autorización para registrarlos."],
            ["Verificación del libro genealógico", "El documento del titular se convierte en un código irreversible; solo se guardan los últimos 4 dígitos. También se guarda constancia de cada intento y de cada importación."],
            ["Datos técnicos", "Cookies de sesión para mantenerte conectado y registros técnicos (por ejemplo, dirección IP y navegador) que generan Supabase y Vercel al operar el servicio."],
          ]}
        />
        <P>No recopilamos datos sensibles en el sentido de la ley (salud de personas, biometría, orientación política, etc.). La información sanitaria de Apriscol es la de tus animales.</P>
      </>
    ),
  },
  {
    id: "finalidades",
    titulo: "Para qué los usamos",
    contenido: (
      <>
        <Lista>
          <li>Crear y mantener tu cuenta, y permitirte entrar de forma segura.</li>
          <li>Prestar el servicio: mostrar tu hato, calcular endogamia, periodos de retiro, costos y reportes, y generar tus archivos de Excel.</li>
          <li>Enviarte correos del servicio (confirmación de cuenta, recuperación de contraseña, invitaciones).</li>
          <li>Darte soporte y proteger la plataforma contra abusos y accesos indebidos.</li>
          <li>Cumplir obligaciones legales.</li>
        </Lista>
        <P>No los usamos para publicidad, no los vendemos y no tomamos decisiones automatizadas sobre ti con efectos legales.</P>
      </>
    ),
  },
  {
    id: "supabase",
    titulo: "Dónde viven tus datos: Supabase",
    contenido: (
      <>
        <P>
          Toda la información de Apriscol se guarda en <strong>Supabase</strong>, que nos presta tres servicios dentro de un único proyecto:
        </P>
        <Tabla
          filas={[
            ["Base de datos (PostgreSQL)", "Guarda la información de tu finca: hato, leche, sanidad, costos, equipo y más."],
            ["Autenticación", "Guarda tu correo y la contraseña cifrada, y controla las sesiones."],
            ["Almacenamiento de archivos", "Guarda tus fotos y soportes en espacios privados, separados por finca."],
          ]}
        />
        <P>
          El proyecto de Supabase está en la región <strong>ca-central-1 (Canadá)</strong>. La aplicación se sirve desde Vercel, cuyo servidor principal está en Estados Unidos. Por eso, tus datos se tratan fuera de Colombia; al aceptar esta política autorizas esa transferencia y transmisión internacional a nuestros proveedores, que actúan como encargados del tratamiento bajo nuestras instrucciones y con compromisos de seguridad y confidencialidad. Según publica el propio proveedor, Supabase cifra la información almacenada y cumple estándares como SOC 2.
        </P>
      </>
    ),
  },
  {
    id: "proteccion",
    titulo: "Cómo protegemos tu información en Supabase",
    contenido: (
      <>
        <P>Estas son las medidas concretas, en lenguaje sencillo:</P>
        <Tabla
          filas={[
            ["Una finca no ve a otra", "Todas las tablas con datos de finca tienen seguridad a nivel de fila (RLS): la base de datos comprueba, en cada consulta, a qué finca pertenece quien pregunta. Los vínculos entre registros incluyen la finca, así que un registro no puede apuntar a otra finca."],
            ["Permisos por rol y módulo", "Propietario, administrador, ordeñador, veterinario y contador acceden solo a los módulos que su rol permite. Si un rol no aparece listado en un módulo, no entra."],
            ["Contraseñas ilegibles", "Se guardan cifradas con una función de resumen. Ni el equipo de Apriscol puede verlas; si la olvidas, se restablece, no se recupera."],
            ["Archivos privados", "Las fotos y los soportes están en espacios privados, sin lista pública, dentro de una carpeta por finca. Se abren con enlaces firmados de corta duración, nunca con un enlace permanente."],
            ["Documentos del libro genealógico", "Los documentos de los titulares nunca se guardan en claro: se transforman con un código irreversible cuyo secreto está en la bóveda (Vault) de Supabase. Solo se conservan los últimos 4 dígitos."],
            ["Libro genealógico cerrado", "La base genealógica es una tabla global que las fincas no pueden leer. Reciben únicamente los cálculos y, tras demostrar que son suyos, los datos de sus propios animales."],
            ["Límites contra abuso", "Se limitan los intentos de traer animales por persona y por titular, y queda constancia de cada uno."],
            ["Llaves separadas", "Al navegador solo llega la llave pública de Supabase, que por sí sola no da acceso a datos. Las llaves de administración nunca están en la aplicación del navegador ni en el código fuente."],
            ["Funciones con control de quién llama", "Los procesos privilegiados de la base de datos validan la identidad y la finca de quien los invoca antes de devolver nada."],
            ["Cifrado", "La conexión usa HTTPS. En Supabase, los datos y las copias de seguridad se almacenan cifrados."],
            ["Copias de seguridad", "La base cuenta con las copias automáticas que ofrece Supabase según el plan del proyecto."],
          ]}
        />
        <P>
          <strong>Quién de nuestro lado puede ver qué.</strong> El panel de administración de la plataforma muestra cifras agregadas (número de usuarios, fincas, animales, litros) y los datos de contacto de cada propietario (nombre, correo, finca y municipio) para dar soporte. No muestra tu operación diaria. El acceso técnico directo a la base de datos está limitado a personal autorizado y solo se usa para operar, dar soporte y proteger el servicio.
        </P>
        <P>
          <strong>Si algo sale mal.</strong> Ningún sistema es invulnerable. Si ocurre una violación de seguridad que afecte tus datos, lo investigaremos de inmediato, te informaremos y, cuando la ley lo exija, lo reportaremos a la Superintendencia de Industria y Comercio (SIC).
        </P>
      </>
    ),
  },
  {
    id: "terceros",
    titulo: "Con quién los compartimos",
    contenido: (
      <>
        <Lista>
          <li><strong>Supabase</strong>: base de datos, autenticación y archivos (ver arriba).</li>
          <li><strong>Vercel</strong>: publica la aplicación y procesa las solicitudes.</li>
          <li><strong>Servicio de correo</strong>: envía los mensajes de confirmación, recuperación e invitación.</li>
          <li><strong>Las personas de tu finca</strong>: según el rol que tú les des.</li>
          <li><strong>Autoridades</strong>: solo si una ley o una orden de autoridad competente lo exige.</li>
        </Lista>
        <P>Fuera de esto, no entregamos tus datos a nadie.</P>
      </>
    ),
  },
  {
    id: "cookies",
    titulo: "Cookies y rastreo",
    contenido: (
      <P>
        Usamos únicamente las cookies de sesión necesarias para que sigas conectado. No usamos cookies de publicidad ni herramientas de analítica de terceros. Las tipografías se incluyen en la propia aplicación; no se piden a servidores externos mientras la usas.
      </P>
    ),
  },
  {
    id: "conservacion",
    titulo: "Cuánto tiempo los conservamos",
    contenido: (
      <>
        <P>
          Conservamos tus datos mientras tu cuenta esté activa y el tiempo que la ley o la defensa de derechos lo requiera. Lo que borras dentro de la aplicación se marca como eliminado y puede permanecer un tiempo en la base y en las copias de seguridad antes de desaparecer definitivamente.
        </P>
        <P>Si pides cerrar tu cuenta o eliminar los datos de tu finca, los suprimimos, salvo lo que debamos conservar por obligación legal.</P>
      </>
    ),
  },
  {
    id: "derechos",
    titulo: "Tus derechos como titular",
    contenido: (
      <>
        <Lista>
          <li>Conocer, actualizar y rectificar tus datos personales.</li>
          <li>Pedir prueba de la autorización que nos diste.</li>
          <li>Ser informado sobre el uso que damos a tus datos.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio (www.sic.gov.co) por infracciones a la ley.</li>
          <li>Revocar la autorización y solicitar la supresión de tus datos cuando no se respeten los principios o derechos, o cuando ya no sean necesarios.</li>
          <li>Acceder de forma gratuita a tus datos personales.</li>
        </Lista>
        <P>
          Para ejercerlos, escríbenos a <Contacto /> desde el correo de tu cuenta, indicando qué solicitas. Respondemos las consultas en un máximo de 10 días hábiles y los reclamos en un máximo de 15 días hábiles, prorrogables como lo permite la ley. Tus datos de la finca también puedes verlos y corregirlos tú mismo dentro de la aplicación.
        </P>
      </>
    ),
  },
  {
    id: "menores",
    titulo: "Menores de edad",
    contenido: <P>Apriscol está pensado para personas mayores de edad que manejan un aprisco. No recopilamos de forma intencional datos de menores; si crees que un menor se registró, avísanos y eliminaremos la cuenta.</P>,
  },
  {
    id: "cambios",
    titulo: "Cambios en esta política",
    contenido: (
      <P>
        Si cambiamos esta política, publicaremos la nueva versión aquí con su fecha. Si el cambio altera de forma importante el uso de tus datos, te lo avisaremos en la aplicación o por correo y, cuando la ley lo exija, pediremos de nuevo tu autorización. Los <Link href="/terminos" className="font-semibold text-musgo underline underline-offset-4">Términos de servicio</Link> complementan este documento.
      </P>
    ),
  },
];

export default function PaginaPrivacidad() {
  return (
    <PaginaLegal
      actual="privacidad"
      rotulo="Política de privacidad"
      titulo="Tus datos, protegidos y bajo tu control"
      introduccion="Qué información guarda Apriscol, dónde la guarda (Supabase), cómo la protege y cómo puedes ejercer tus derechos como titular."
      resumen={
        <Resumen
          titulo="Lo esencial en 30 segundos"
          puntos={[
            "Guardamos solo lo necesario: tu cuenta, tu finca, tu hato y tus archivos.",
            "Todo vive en Supabase (Canadá), con seguridad por finca y por rol, archivos privados y contraseñas cifradas.",
            "Los documentos del libro genealógico nunca se guardan en claro.",
            "No vendemos tus datos, no hay publicidad ni analítica de terceros.",
            "Puedes pedir conocer, corregir o eliminar tus datos cuando quieras.",
          ]}
        />
      }
      secciones={SECCIONES}
    />
  );
}
