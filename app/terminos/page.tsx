import type { Metadata } from "next";
import Link from "next/link";
import { Contacto } from "@/components/legal/Contacto";
import { Lista, P, PaginaLegal, Resumen, type SeccionLegal } from "@/components/legal/PaginaLegal";
import { RESPONSABLE } from "@/lib/legal";
import { TEXTO_SOLO_CON_PLAN } from "@/lib/referidos";

export const metadata: Metadata = {
  title: "Términos de servicio",
  description: "Las reglas claras para usar Apriscol: quién es dueño de tus datos, cómo se protegen en Supabase y qué esperamos de cada parte.",
};

const SECCIONES: SeccionLegal[] = [
  {
    id: "aceptacion",
    titulo: "Quiénes somos y qué aceptas",
    contenido: (
      <>
        <P>
          Apriscol es una aplicación web para llevar el manejo de un aprisco de cabras y ovejas: hato, genealogía y endogamia, leche, sanidad, reproducción, corrales, carne y costos. La opera {RESPONSABLE} («nosotros»).
        </P>
        <P>
          Al crear una cuenta, aceptar una invitación o usar Apriscol, aceptas estos términos y la <Link href="/privacidad" className="font-semibold text-musgo underline underline-offset-4">Política de privacidad</Link>. Si no estás de acuerdo, no uses el servicio. Debes ser mayor de edad.
        </P>
      </>
    ),
  },
  {
    id: "cuenta",
    titulo: "Tu cuenta, tu finca y tu equipo",
    contenido: (
      <>
        <P>
          Cada finca es un espacio aparte. Quien la crea queda como <strong>propietario</strong>: es el dueño y administrador de esa finca y decide quién más entra y con qué rol (administrador, ordeñador, veterinario o contador). Cada rol ve solo los módulos que le corresponden.
        </P>
        <Lista>
          <li>Eres responsable de la contraseña de tu cuenta y de lo que se haga con ella. Si sospechas que alguien más la conoce, cámbiala desde «Más → Cambiar contraseña».</li>
          <li>Eres responsable de las personas que invitas: antes de invitar a alguien, asegúrate de que sabe y acepta que su nombre y correo quedan en tu finca.</li>
          <li>La información que registras debe ser veraz y tuya, o de la que tengas derecho a usar.</li>
        </Lista>
      </>
    ),
  },
  {
    id: "planes",
    titulo: "Planes y pagos",
    contenido: (
      <>
        <P>
          Apriscol se ofrece en cuatro planes (Cría, Hato, Profesional y Hacienda) que se diferencian por <strong>los servicios que incluyen</strong>, no por cuántos animales registres. Los precios están en dólares estadounidenses (US$) y se muestran en la página de entrada; puedes pagar cada mes o cada año (con 20 % de descuento).
        </P>
        <Lista>
          <li>Puedes mejorar tu plan cuando quieras desde «Más → Mejorar mi plan». Solo se puede pasar a un plan superior al que tienes, y solo el propietario de la finca puede hacerlo.</li>
          <li>La mejora se activa cuando se confirma el pago. Pedirla no genera ningún cobro por sí sola.</li>
          <li>Los servicios que tu plan no incluye aparecen bloqueados, con el aviso del plan que los trae.</li>
          <li>Si cambiamos los precios, te avisaremos antes de que se apliquen a tu siguiente periodo de pago.</li>
        </Lista>
      </>
    ),
  },
  {
    id: "referidos",
    titulo: "Programa de referidos",
    contenido: (
      <>
        <P>
          Cada persona con cuenta tiene un enlace personal de referidos («Más → Referidos»). <strong>Por cada persona que se registre con tu enlace y adquiera un plan, recibes el 5 % del valor de ese plan cada mes durante 6 meses</strong>, contados desde que la persona adquiere su plan.
        </P>
        <Lista>
          <li>{TEXTO_SOLO_CON_PLAN}</li>
          <li>La comisión se calcula sobre el precio mensual del plan que adquiere la persona referida, en dólares estadounidenses (US$).</li>
          <li>Tú ves a tus referidos solo con su primer nombre, el plan que adquirieron y cuánto va causado; no ves sus datos ni los de su finca.</li>
          <li>Registrarse con tu propio enlace no genera comisión.</li>
        </Lista>
      </>
    ),
  },
  {
    id: "datos-tuyos",
    titulo: "Tus datos son tuyos",
    contenido: (
      <>
        <P>
          Todo lo que registras en tu finca (animales, genealogía, producción de leche, tratamientos, gastos, fotos, documentos, etc.) es tuyo. Nosotros no adquirimos ningún derecho de propiedad sobre esa información.
        </P>
        <P>Solo te pedimos un permiso limitado: guardar, procesar y mostrar tus datos <strong>únicamente para prestarte el servicio</strong> (por ejemplo, calcular la endogamia, los periodos de retiro o tus reportes en Excel).</P>
        <Lista>
          <li>No vendemos ni alquilamos tus datos.</li>
          <li>No los usamos para publicidad ni para perfilarte con fines comerciales.</li>
          <li>No los compartimos con otras fincas: una finca no puede ver la información de otra.</li>
        </Lista>
      </>
    ),
  },
  {
    id: "supabase",
    titulo: "Dónde y cómo se guardan tus datos",
    contenido: (
      <>
        <P>
          Tu información vive en <strong>Supabase</strong>, un servicio de base de datos en la nube (PostgreSQL) que también gestiona el inicio de sesión y el almacenamiento de archivos. Nuestro proyecto de Supabase está en la región <strong>ca-central-1 (Canadá)</strong>. La aplicación se publica en Vercel (Estados Unidos).
        </P>
        <P>Estas son las medidas con las que protegemos la información allí:</P>
        <Lista>
          <li><strong>Una finca no ve a otra.</strong> Todas las tablas con datos tienen seguridad a nivel de fila: la propia base de datos decide, en cada consulta, a qué finca y a qué módulos puede acceder quien pregunta.</li>
          <li><strong>Permisos por rol.</strong> Un ordeñador, un veterinario o un contador solo acceden a lo que su rol permite.</li>
          <li><strong>Contraseñas protegidas.</strong> Se guardan cifradas con una función de resumen; ni nosotros podemos leerlas.</li>
          <li><strong>Archivos privados.</strong> Las fotos y los documentos están en espacios privados, separados por finca, y se abren solo con enlaces temporales.</li>
          <li><strong>Documentos de identidad del libro genealógico.</strong> Nunca se guardan en claro: solo un código irreversible y los últimos cuatro dígitos.</li>
          <li><strong>Conexión cifrada.</strong> Todo viaja por HTTPS.</li>
        </Lista>
        <P>
          El detalle completo está en la <Link href="/privacidad#proteccion" className="font-semibold text-musgo underline underline-offset-4">Política de privacidad</Link>. Ningún sistema es invulnerable; por eso, si ocurre un incidente que afecte tus datos, te lo informaremos como exige la ley.
        </P>
      </>
    ),
  },
  {
    id: "libro",
    titulo: "Libro genealógico y «Traer mis animales»",
    contenido: (
      <>
        <P>
          Apriscol incluye una base genealógica de la asociación de criadores que sirve para calcular parentescos y endogamia. Las fincas no la consultan directamente. Puedes traer tus animales a tu hato <strong>una sola vez, al crear la cuenta</strong>, y solo los que demuestres que son tuyos: con el documento del titular <strong>y</strong> el microchip de uno de sus animales.
        </P>
        <Lista>
          <li>Debes usar solo documentos y animales propios. Intentar traer animales ajenos, o adivinar documentos, está prohibido y puede cerrar tu cuenta.</li>
          <li>Hay límites de intentos por persona y por titular para proteger a los criadores.</li>
          <li>Si se descubre que una importación no correspondía, la plataforma puede revertirla.</li>
        </Lista>
      </>
    ),
  },
  {
    id: "uso",
    titulo: "Uso aceptable",
    contenido: (
      <>
        <P>No uses Apriscol para:</P>
        <Lista>
          <li>Acceder a información de otra finca o intentar saltarte los permisos.</li>
          <li>Probar vulnerabilidades, saturar el servicio o extraer datos de forma automática sin permiso.</li>
          <li>Subir archivos con virus, contenido ilegal o que no tengas derecho a compartir.</li>
          <li>Suplantar a otra persona o crear cuentas con datos falsos.</li>
        </Lista>
      </>
    ),
  },
  {
    id: "criterio",
    titulo: "Apriscol es una herramienta de apoyo",
    contenido: (
      <>
        <P>
          Los cálculos y avisos de Apriscol (endogamia, periodos de retiro, FAMACHA, fecha prevista de parto, costos por litro o por animal, hacinamiento, rotación de potreros) ayudan a decidir, pero <strong>no reemplazan el criterio de un médico veterinario ni la normatividad sanitaria vigente</strong> (por ejemplo, la del ICA).
        </P>
        <P>Revisa los datos que registras: los resultados son tan buenos como la información con que se calculan. Las decisiones sobre tus animales, tus ventas y tus tratamientos son tuyas.</P>
      </>
    ),
  },
  {
    id: "disponibilidad",
    titulo: "Disponibilidad y copias de seguridad",
    contenido: (
      <>
        <P>
          Trabajamos para que Apriscol esté disponible, pero no podemos garantizar que funcione sin interrupciones. Puede haber mantenimientos, fallas de nuestros proveedores (Supabase, Vercel) o de tu conexión.
        </P>
        <P>
          La base de datos cuenta con las copias de seguridad que ofrece Supabase según el plan del proyecto. Aun así, te recomendamos descargar de vez en cuando tus reportes en Excel (menú Costos → Reportes) como respaldo propio.
        </P>
      </>
    ),
  },
  {
    id: "terminar",
    titulo: "Cerrar tu cuenta y eliminar tus datos",
    contenido: (
      <>
        <P>
          Puedes dejar de usar Apriscol cuando quieras. Si quieres que eliminemos tu cuenta o los datos de tu finca, solicítalo por el canal de contacto. Lo que borras dentro de la aplicación se marca como eliminado y puede permanecer un tiempo en la base de datos y en las copias de seguridad antes de desaparecer del todo.
        </P>
        <P>
          Podemos suspender o cerrar una cuenta que incumpla estos términos, ponga en riesgo a otros usuarios o la seguridad del servicio. Cuando sea posible, te avisaremos antes y podrás descargar tu información.
        </P>
      </>
    ),
  },
  {
    id: "propiedad",
    titulo: "Propiedad intelectual",
    contenido: (
      <P>
        El software, el diseño, la marca Apriscol, los textos y los íconos de la aplicación pertenecen a {RESPONSABLE}. Puedes usarlos mientras uses el servicio, pero no copiarlos, revenderlos ni presentarlos como propios. Tus datos y tus archivos siguen siendo tuyos.
      </P>
    ),
  },
  {
    id: "responsabilidad",
    titulo: "Límites de responsabilidad",
    contenido: (
      <>
        <P>
          Prestamos Apriscol «tal como está», con el cuidado razonable de un servicio profesional. En la medida que permite la ley, no respondemos por pérdidas indirectas (por ejemplo, una venta que no se concretó, una decisión sanitaria tomada sin consultar a un veterinario o datos mal digitados), ni por fallas de servicios de terceros que no controlamos.
        </P>
        <P>Esto no limita los derechos que la ley colombiana te reconoce como consumidor ni como titular de datos personales.</P>
      </>
    ),
  },
  {
    id: "cambios",
    titulo: "Cambios en estos términos",
    contenido: (
      <P>
        Podemos actualizar estos términos cuando el servicio o la ley cambien. Publicaremos la versión nueva en esta página con su fecha y, si el cambio es importante, te lo avisaremos dentro de la aplicación o por correo. Si sigues usando Apriscol después del cambio, lo aceptas.
      </P>
    ),
  },
  {
    id: "ley",
    titulo: "Ley aplicable y contacto",
    contenido: (
      <>
        <P>
          Estos términos se rigen por las leyes de la República de Colombia, en especial la Ley 1581 de 2012 y sus decretos reglamentarios sobre protección de datos personales. Cualquier diferencia se buscará resolver primero de manera directa y amistosa; si no es posible, serán competentes los jueces de Colombia.
        </P>
        <P>
          ¿Dudas sobre estos términos o sobre tus datos? Escríbenos a <Contacto />.
        </P>
      </>
    ),
  },
];

export default function PaginaTerminos() {
  return (
    <PaginaLegal
      actual="terminos"
      rotulo="Términos de servicio"
      titulo="Reglas claras para usar Apriscol"
      introduccion="Qué es tuyo, qué hacemos con tu información, cómo la protegemos en Supabase y qué esperamos de cada parte. Sin letra menuda."
      resumen={
        <Resumen
          titulo="Lo esencial en 30 segundos"
          puntos={[
            "Tus datos son tuyos. No los vendemos ni los usamos para publicidad.",
            "Se guardan en Supabase (Canadá), con seguridad por finca: una finca nunca ve a otra.",
            "El propietario administra su finca y decide quién entra y con qué rol.",
            "Los avisos y cálculos apoyan tu decisión; no reemplazan al veterinario ni al ICA.",
            "Puedes pedir en cualquier momento ver, corregir o eliminar tus datos.",
          ]}
        />
      }
      secciones={SECCIONES}
    />
  );
}
