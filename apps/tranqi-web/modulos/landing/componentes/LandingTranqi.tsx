"use client";

/* eslint-disable @next/next/no-img-element -- fotos estáticas de /public, como en el resto de la landing */

/**
 * Landing de la membresía tranqi (TRQ-024). Traslado de la maqueta aprobada
 * `gobernanza/productos/tranqi/maquetas/landing-membresia-v2.html`, hecha a
 * partir del «Recorrido gráfico de la landing membresía», revisión 1
 * (14-nov-2026), con «¿Eres abogado?» delante del contacto y Nosotros al final.
 *
 * El estilo vive en `landing.css`, todo bajo `.landing`, para no chocar con
 * las reglas globales de `section`, `.wrap` y `.btn` que usa el panel.
 */

import { useEffect, useState } from "react";
import { BarraLanding } from "./BarraLanding";
import { BuddieLanding } from "./BuddieLanding";
import { FormularioContacto } from "./FormularioContacto";
import { Ico, SpriteIconos } from "./IconosLanding";
import "./landing.css";

const FOTOS = "/assets/landing";

/** «$23» y no «$23.00»: el recorrido escribe el precio redondo. */
function formatearPrecio(valor: number) {
  return Number.isInteger(valor) ? `$${valor}` : `$${valor.toFixed(2)}`;
}

/**
 * La cinta («churo»). Desde las observaciones del 19-nov (TRQ-033) solo
 * queda en el hero: en el resto de secciones atravesaba el contenido y
 * competía con la lectura.
 */
function Churo({ color, d }: { color: string; d: string }) {
  return (
    <div className="churo" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="none">
        <path stroke={color} d={d} />
      </svg>
    </div>
  );
}

/** La marca se escribe «Tranqi» en los textos (el logotipo sigue siendo el suyo). */
function Quiero({ a = "#planes" }: { a?: string }) {
  return (
    <a className="btn btn-amarillo" href={a}>
      Quiero estar Tranqi <Ico nombre="flecha" />
    </a>
  );
}

export function LandingTranqi() {
  const [precioDesde, setPrecioDesde] = useState(23);

  // Enlace de confirmación de Supabase que cae en la raíz: se pasa al callback.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (code) {
      const next = params.get("next") || "/panel";
      location.href = `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
    }
  }, []);

  // Precio «desde» del catálogo; si falla se queda el del recorrido.
  useEffect(() => {
    let vigente = true;
    fetch("/api/planes-publicos")
      .then((r) => r.json())
      .then((j) => {
        const valor = Number(j?.familiar?.precioDesde);
        if (vigente && j?.ok && valor > 0) setPrecioDesde(valor);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  // La cinta es UN hilo que sigue al scroll (TRQ-026): la punta va a la altura
  // de una línea fija de la pantalla (CABEZA), así que al bajar se dibuja y al
  // subir se recoge. Antes cada tramo se trazaba entero de golpe al entrar su
  // sección, con 1,6 s de animación: en móvil la cinta iba por detrás o por
  // delante del dedo.
  //
  // pathLength se calibra con el largo real en pantalla: con non-scaling-stroke
  // y preserveAspectRatio="none" el guion «1» no cubre todo el trazo estirado
  // (nota de TRQ-012). Con el mismo muestreo se guarda, para cada punto del
  // trazo, su altura en la sección y la fracción del largo recorrida hasta él.
  useEffect(() => {
    const CABEZA = 0.72; // fracción del alto de la pantalla donde va la punta
    const MUESTRAS = 240;
    type Tramo = { path: SVGPathElement; seccion: HTMLElement; alturas: Float32Array; fracciones: Float32Array };
    const tramos = new Map<SVGPathElement, Tramo>();
    const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const calibrar = (svg: SVGSVGElement, ancho: number, alto: number) => {
      const vb = svg.viewBox.baseVal;
      const seccion = svg.closest("section");
      if (!seccion || !ancho || !alto || !vb.width || !vb.height) return;
      const sx = ancho / vb.width, sy = alto / vb.height;
      svg.querySelectorAll("path").forEach((p) => {
        const largo = p.getTotalLength();
        const alturas = new Float32Array(MUESTRAS + 1);
        const acumulado = new Float32Array(MUESTRAS + 1);
        let previo = p.getPointAtLength(0);
        alturas[0] = previo.y * sy;
        for (let i = 1; i <= MUESTRAS; i++) {
          const q = p.getPointAtLength((largo * i) / MUESTRAS);
          acumulado[i] = acumulado[i - 1]! + Math.hypot((q.x - previo.x) * sx, (q.y - previo.y) * sy);
          alturas[i] = q.y * sy;
          previo = q;
        }
        const enPantalla = acumulado[MUESTRAS]!;
        if (enPantalla <= 0) return;
        p.setAttribute("pathLength", String(largo / enPantalla));
        tramos.set(p, { path: p, seccion, alturas, fracciones: acumulado.map((v) => v / enPantalla) });
      });
      pedirDibujo();
    };

    // Lo dibujado de cada tramo llega hasta el primer punto que queda por
    // debajo de la punta: los rizos se completan cuando la punta los pasa.
    const dibujar = () => {
      pendiente = 0;
      const punta = innerHeight * CABEZA;
      for (const t of tramos.values()) {
        const y = punta - t.seccion.getBoundingClientRect().top;
        let k = 0;
        if (sinMovimiento) k = t.alturas.length;
        else while (k < t.alturas.length && t.alturas[k]! <= y) k++;
        const fraccion = k === 0 ? 0 : t.fracciones[k - 1]!;
        // 1,05 y no 1 sin nada dibujado: con extremo redondo asomaría medio
        // círculo en el arranque del tramo.
        t.path.style.strokeDashoffset = fraccion === 0 ? "1.05" : String(1 - fraccion);
      }
    };
    let pendiente = 0;
    const pedirDibujo = () => {
      if (!pendiente) pendiente = requestAnimationFrame(dibujar);
    };

    const medidor = new ResizeObserver((es) => {
      for (const e of es) calibrar(e.target as SVGSVGElement, e.contentRect.width, e.contentRect.height);
    });
    document.querySelectorAll<SVGSVGElement>(".landing .churo svg").forEach((s) => medidor.observe(s));
    addEventListener("scroll", pedirDibujo, { passive: true });
    addEventListener("resize", pedirDibujo);
    return () => {
      medidor.disconnect();
      removeEventListener("scroll", pedirDibujo);
      removeEventListener("resize", pedirDibujo);
      cancelAnimationFrame(pendiente);
    };
  }, []);

  // Paso entre secciones (TRQ-028): al entrar una sección, su contenido sube
  // y aparece en cascada (títulos, luego tarjetas, fotos y pasos de uno en
  // uno). Lo marca JS y no el HTML: sin JS todo se ve desde el principio. El
  // hero queda fuera porque ya está en pantalla al cargar y parpadearía.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const PIEZAS = [
      ".wrap > h2", ".wrap > .sub", ".wrap > .sub2", ".oferta", ".comienza", ".centro", ".medios", ".remate",
      ".pasos > .paso", ".beneficio", ".dona", ".bento > img", ".tarjeta", ".tira > img",
      ".cabecera > *", ".respaldo > div", ".rejilla > *:not(.preguntas):not(.pilares)", ".preguntas > details",
      ".pilares > *", ".tramites > *", ".hacemos",
    ].join(", ");
    // Cada pieza se observa sola: en móvil una sección mide varias pantallas y,
    // si se activara entera, lo de abajo ya habría aparecido al llegar. La
    // cascada se arma con las piezas que entran juntas, en orden de lectura.
    const piezas = [...document.querySelectorAll<HTMLElement>(".landing section:not(#hero)")].flatMap((s) => [
      ...s.querySelectorAll<HTMLElement>(PIEZAS),
    ]);
    piezas.forEach((el) => el.classList.add("aparece"));
    const vista = new IntersectionObserver(
      (es) => {
        const entran = es.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
        entran.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        entran.forEach((el, i) => {
          el.style.setProperty("--i", String(Math.min(i, 8)));
          el.classList.add("es-visible");
          vista.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
    );
    piezas.forEach((el) => vista.observe(el));
    return () => vista.disconnect();
  }, []);

  const precio = formatearPrecio(precioDesde);

  return (
    <div className="landing">
      <SpriteIconos />
      <BarraLanding />

      {/* 01 · HERO — entender y actuar */}
      <section id="hero" data-buddie="hero">
        <Churo color="#7866FF" d="M 1500 140 C 1260 140 1100 300 1150 470 C 1200 640 1420 600 1400 430 C 1380 270 1150 300 1110 520 C 1080 690 1370 760 1370 900" />
        <div className="wrap">
          <img className="logo-grande" src="/assets/tranqi-white.svg" alt="Tranqi®" />
          <span className="sello">Tranqi · LegalTech + FinTech</span>
          <h1>Tu tranquilidad también necesita <i>respaldo legal</i>.</h1>
          <p className="bajada">Protege tus derechos, encuentra respaldo profesional y accede a soluciones financieras para ti y tu familia. Todo en un solo lugar.</p>
          <p className="lema-hero">Una membresía. Múltiples soluciones.</p>
          <ul>
            <li><Ico nombre="escudo" /><div><b>Membresía anual</b><span>Accede a beneficios y servicios según tu plan.</span></div></li>
            <li><Ico nombre="balanza" /><div><b>Red de abogados especializados</b><span>Conecta con profesionales para recibir orientación y asistencia jurídica.</span></div></li>
            <li><Ico nombre="billetera" /><div><b>Soluciones financieras</b><span>Opciones de financiamiento y planes de pago para honorarios y servicios legales.</span></div></li>
            <li><Ico nombre="reloj" /><div><b>Plataforma digital 24/7</b><span>Accede a tu plataforma y gestiona tus solicitudes desde cualquier lugar.</span></div></li>
          </ul>
          {/* Dos llamados a la acción: el precio lleva a los planes y «Quiero
              estar Tranqi» a lo que incluye la membresía. */}
          <div className="oferta">
            <a className="pvp" href="#planes">
              <span><small>Conoce tu membresía anual</small><b>Desde {precio}</b><em>Valor incluye IVA</em></span>
              <span className="ir"><Ico nombre="flecha" /></span>
            </a>
            <Quiero a="#beneficios" />
          </div>
        </div>
      </section>

      {/* 02 · CÓMO FUNCIONA — blanco */}
      <section id="como" data-buddie="como">
        <div className="wrap">
          <h2>Estar <b className="marca">Tranqi</b><br />es así de fácil.</h2>
          <p className="sub">En solo 3 pasos accedes a protección jurídica y soluciones financieras.</p>
          <div className="pasos">
            <div className="paso"><Ico nombre="tarjeta" /><h3>1. Afíliate</h3><p>Elige tu membresía y realiza tu pago seguro.</p></div>
            <div className="chevron" aria-hidden="true"><Ico nombre="chevron" /></div>
            <div className="paso"><Ico nombre="movil" /><h3>2. Accede</h3><p>Ingresa a Tranqi desde tu dispositivo.</p></div>
            <div className="chevron" aria-hidden="true"><Ico nombre="chevron" /></div>
            <div className="paso"><Ico nombre="chats" /><h3>3. Consulta</h3><p>Conecta con un abogado de la especialidad que necesitas.</p></div>
          </div>
          <div className="comienza">
            <div className="rotulo">Comienza<b>AHORA</b></div>
            <Quiero />
            <p>Acceder a respaldo legal es más fácil de lo que imaginas.</p>
          </div>
        </div>
      </section>

      {/* 03 · QUÉ INCLUYE — blanco, íconos violeta, letras negras, media dona de fotos */}
      <section id="beneficios" data-buddie="beneficios">
        <div className="dona" aria-hidden="true">
          <img src={`${FOTOS}/app-hola.jpg`} alt="" />
          <img src={`${FOTOS}/asesoria.jpg`} alt="" />
          <img src={`${FOTOS}/tarjeta-tranqi.jpg`} alt="" />
          <img src={`${FOTOS}/app-icono.jpg`} alt="" />
        </div>
        <div className="wrap">
          <h2>El derecho a<br />estar <b className="marca">Tranqi</b>.</h2>
          <p className="sub2">Qué incluye tu membresía</p>
          <div className="beneficios">
            <div className="beneficio"><Ico nombre="familia" /><h3>Respaldo para tu familia</h3><p>Protección individual y familiar según tu cobertura.</p></div>
            <div className="beneficio"><Ico nombre="tarjeta" /><h3>Facilidades de pago</h3><p>Pago con todas las tarjetas de crédito. Opciones de financiamiento directo o bancario para determinados servicios legales (sujeto a aprobación).</p></div>
            <div className="beneficio"><Ico nombre="mundo" /><h3>Acceso digital</h3><p>Gestiona tus solicitudes y consulta información desde cualquier dispositivo.</p></div>
            <div className="beneficio"><Ico nombre="porcentaje" /><h3>Ahorro en servicios legales</h3><p>Descuentos de hasta el 20 % en honorarios profesionales y 10 % en trámites y gestiones.</p></div>
            <div className="beneficio"><Ico nombre="chats" /><h3>Consultas jurídicas</h3><p>Consultas con abogados de la red durante la vigencia de tu membresía.</p></div>
            <div className="beneficio"><Ico nombre="reloj" /><h3>Disponibilidad digital 24/7</h3><p>Plataforma operativa disponible 24/7 para gestionar solicitudes, según el servicio.</p></div>
          </div>
          <div className="oferta"><Quiero /></div>
        </div>
      </section>

      {/* 04 · SOLUCIONES LEGALES — degradado lavanda → rosa, collage con la foto de gestores */}
      <section id="soluciones" data-buddie="soluciones">
        <div className="wrap">
          <h2>Soluciones legales<span>al alcance de todos.</span></h2>
          <div className="bento">
            <img className="b1" src={`${FOTOS}/manos.jpg`} alt="Manos unidas en círculo" />
            <img className="b2" src={`${FOTOS}/familia.jpg`} alt="Madre con su bebé y un adulto mayor usando el celular" />
            <img className="b3" src={`${FOTOS}/usuarios.jpg`} alt="Dos mujeres usando Tranqi en el celular" />
            <img className="b4" src={`${FOTOS}/gestores.jpg`} alt="Gestora de Tranqi atendiendo a una familia" />
            <img className="b5" src={`${FOTOS}/joven-celular.jpg`} alt="Joven revisando su celular" />
            <img className="b6" src={`${FOTOS}/adulto-mayor.jpg`} alt="Adulto mayor frente a su computadora" />
          </div>
        </div>
      </section>

      {/* 05 · PLANES — amarillo, Personas + Empresas, logos de todas las tarjetas */}
      <section id="planes" data-buddie="planes">
        <div className="wrap">
          <h2>Planes para<span>protección jurídica continua</span></h2>
          <div className="tarjetas">
            <article className="tarjeta">
              <div className="cuerpo">
                <h3>Personas</h3>
                <div className="precio"><div><small>Planes desde</small><b>{precio}</b></div><span>incluido<br />IVA</span></div>
                <p className="para">Para personas naturales.</p>
                <ul>
                  <li><span className="cuadroico"><Ico nombre="escudo" /></span>Asistencia jurídica confiable</li>
                  <li><span className="cuadroico"><Ico nombre="familia" /></span>Red de profesionales</li>
                  <li><span className="cuadroico"><Ico nombre="billetera" /></span>Opciones de pago y financiamiento</li>
                </ul>
                <a className="btn btn-amarillo" href="/ingresar">Contrata aquí <Ico nombre="flecha" /></a>
              </div>
              <div className="foto" style={{ backgroundImage: `url('${FOTOS}/personas.jpg')` }} role="img" aria-label="Niño abrazando a su perro" />
            </article>
            <article className="tarjeta empresa">
              <div className="cuerpo">
                <h3>Empresas</h3>
                <p className="lema">Soluciones de protección jurídica para tu empresa.</p>
                <ul>
                  <li><span className="cuadroico"><Ico nombre="escudo" /></span>Protección y tranquilidad para tu equipo</li>
                  <li><span className="cuadroico"><Ico nombre="grafico" /></span>Gestión eficiente y segura</li>
                  <li><span className="cuadroico"><Ico nombre="apreton" /></span>Respaldo de una red profesional</li>
                </ul>
                <a className="btn btn-amarillo" href="/empresas/contacto">Más información <Ico nombre="flecha" /></a>
              </div>
              <div className="foto" style={{ backgroundImage: `url('${FOTOS}/empresas.jpg')` }} role="img" aria-label="Ejecutiva sonriendo" />
            </article>
          </div>
          <div className="medios">
            <span className="medios-ico"><Ico nombre="tarjeta-escudo" /></span>
            <p><span>Aceptamos todas</span><b>las tarjetas de crédito</b></p>
            <img src={`${FOTOS}/tarjetas.png`} alt="Visa, Mastercard, American Express, Alia, Discover y Diners Club" />
          </div>
        </div>
      </section>

      {/* 06 · ¿TIENES UNA DUDA LEGAL? — blanco */}
      <section id="duda" data-buddie="duda">
        <div className="wrap">
          <h2>¿Tienes una duda legal?<span>No tienes que resolverla solo.</span></h2>
          <div className="tira">
            <img src={`${FOTOS}/manos.jpg`} alt="" />
            <img src={`${FOTOS}/consulta-video.jpg`} alt="Mujer en una videoconsulta" />
            <img src={`${FOTOS}/app-cafe.jpg`} alt="Persona usando la app de Tranqi" />
            <img src={`${FOTOS}/familia.jpg`} alt="" />
          </div>
          <p className="remate">Desde una consulta cotidiana hasta una situación legal más compleja, <b className="marca">Tranqi</b> te conecta con profesionales que pueden orientarte.</p>
        </div>
      </section>

      {/* 07 · RED DE EXPERTOS — confianza y respaldo */}
      <section id="red" data-buddie="red">
        <div className="wrap">
          <div className="cabecera">
            <div className="foto"><img src={`${FOTOS}/abogados-firma.jpg`} alt="Abogados revisando un contrato" /></div>
            <div>
              <h2>Una red de expertos<br />a tu servicio.</h2>
              <p className="sub">Contamos con la mejor red de abogados en todo el Ecuador para brindarte respaldo y confianza.</p>
            </div>
          </div>
          <div className="respaldo">
            <div><Ico nombre="institucion" /><div><b>Trayectoria empresarial</b><p>El respaldo de un grupo empresarial con casi 100 años de trayectoria en el mercado legal y otras áreas de servicio.</p></div></div>
            <div><Ico nombre="escudo-estrella" /><div><b>Protección de información</b><p>Tratamiento responsable de datos personales y confidencialidad de las consultas.</p></div></div>
            <div><Ico nombre="balanza" /><div><b>Red de profesionales</b><p>Abogados registrados y organizados por especialidad. Gestores jurídico-tecnológicos con presencia territorial.</p></div></div>
            <div><Ico nombre="tarjeta-escudo" /><div><b>Pagos confiables</b><p>Procesamiento de pagos mediante una pasarela segura y confirmación de la transacción.</p></div></div>
          </div>
          <div className="centro">
            <a className="btn btn-amarillo" href="#contacto" data-abrir-chat>Hablar con Tranqi ahora <Ico nombre="flecha" /></a>
          </div>
        </div>
      </section>

      {/* 07b · TRÁMITES (TRQ-034) — blanco. Cliente → plataforma → gestor y
          abogado coordinados; pedido de negocio del 19-nov: la web no hablaba
          de los gestores (tramitadores). */}
      <section id="tramites" data-buddie="tramites">
        <div className="wrap">
          <h2>Tus trámites, en nuestras manos.<span>Te asesoramos, te ayudamos y gestionamos por ti.</span></h2>
          <div className="tramites">
            <div className="cliente-t">
              <img src={`${FOTOS}/joven-celular.jpg`} alt="Cliente escribiendo desde su celular" />
              <b>Cliente</b>
              <p>Cuéntanos tu necesidad o trámite.</p>
            </div>
            <span className="flecha-t" aria-hidden="true"><Ico nombre="flecha" /></span>
            <div className="plataforma-t">
              <img src={`${FOTOS}/app-icono.jpg`} alt="La app de Tranqi en un celular" />
              <b>Plataforma Tranqi</b>
              <p>Coordinamos la asesoría, la gestión y el trámite por ti.</p>
            </div>
            <span className="flecha-t" aria-hidden="true"><Ico nombre="flecha" /></span>
            <div className="equipo">
              <article className="rol">
                <img className="gestor" src={`${FOTOS}/gestores.jpg`} alt="Gestora de Tranqi revisando un trámite con una familia" />
                <div><h3>Gestor</h3><p>Realiza por ti los trámites y gestiones administrativas ante entidades públicas y privadas.</p></div>
              </article>
              <span className="coordinado">Trabajo coordinado</span>
              <article className="rol">
                <img src={`${FOTOS}/abogados-firma.jpg`} alt="Abogados revisando un documento" />
                <div><h3>Abogado</h3><p>Te asesora, revisa la documentación, elabora escritos y te representa cuando es necesario.</p></div>
              </article>
            </div>
          </div>
          <div className="hacemos">
            <h3>¿Qué hacemos por ti?</h3>
            <ul>
              <li><Ico nombre="balanza" /><div><b>Te asesoramos</b><span>Orientación jurídica clara y oportuna.</span></div></li>
              <li><Ico nombre="doc" /><div><b>Gestionamos tus trámites</b><span>Ante entidades públicas y privadas.</span></div></li>
              <li><Ico nombre="apreton" /><div><b>Te representamos cuando corresponde</b><span>En tus gestiones legales y procesos.</span></div></li>
            </ul>
          </div>
        </div>
      </section>

      {/* 08 · ¿ERES ABOGADO? — lámina 9 del recorrido, en la posición 8 */}
      <section id="abogado" data-buddie="abogado">
        <div className="wrap rejilla">
          <div>
            <div className="arco"><img src={`${FOTOS}/abogados-red.jpg`} alt="Abogados trabajando juntos" /></div>
            <p className="lema">Tu experiencia jurídica<br />merece llegar más lejos.</p>
          </div>
          <div className="texto">
            <h2>¿Eres abogado?<br />La red también es para ti.</h2>
            <p>Forma parte de una red de abogados que conecta a profesionales del derecho con personas, familias y empresas que necesitan orientación y servicios legales.</p>
            <ul>
              <li><Ico nombre="check" />Amplía tu alcance profesional.</li>
              <li><Ico nombre="check" />Accede a nuevas oportunidades de atención.</li>
              <li><Ico nombre="check" />Forma parte de una comunidad jurídica.</li>
            </ul>
            <div className="acciones">
              <a className="btn btn-amarillo" href="/abogados">Más información <Ico nombre="flecha" /></a>
            </div>
          </div>
        </div>
      </section>

      {/* 09 · CONTACTO — blanco; nunca fondo negro */}
      <section id="contacto" data-buddie="contacto">
        <div className="wrap rejilla">
          <div className="izquierda">
            <h2>Estamos aquí<br />para ayudarte.</h2>
            <div className="datos">
              <h3>Info de contacto</h3>
              <div><span className="cuadroico"><Ico nombre="telefono" /></span>1800 TRANQI (872674)</div>
              <div><span className="cuadroico"><Ico nombre="correo" /></span>hola@tranqi24.com</div>
              <div><span className="cuadroico"><Ico nombre="ubicacion" /></span>Quito, Ecuador</div>
            </div>
            <Quiero />
          </div>
          <FormularioContacto />
        </div>
      </section>

      {/* 10 · FAQ — menta */}
      <section id="faq" data-buddie="faq">
        <div className="wrap rejilla">
          <div className="lado"><h2>FAQ</h2><p>Lo que más nos preguntan antes de estar Tranqi.</p></div>
          <div className="preguntas">
            <details open><summary>¿Qué es la membresía Tranqi? <Ico nombre="mas" /></summary><p>Un plan anual de protección jurídica: incluye consultas con abogados, acceso a la plataforma y descuentos en honorarios y trámites. Empieza el día que la compras y dura un año.</p></details>
            <details><summary>¿Cuánto cuesta y cómo pago? <Ico nombre="mas" /></summary><p>Desde {precio} al año con IVA incluido (unos $1,92 al mes). Pagas una vez, en línea, con cualquier tarjeta de crédito o débito.</p></details>
            <details><summary>¿Puedo incluir a mi familia? <Ico nombre="mas" /></summary><p>Sí. TRANQI +3 Familiar cubre a cuatro personas por $28,75 al año, y TRANQI +5 Familiar a seis personas por $34,99 al año.</p></details>
            <details><summary>¿Cómo son las consultas? <Ico nombre="mas" /></summary><p>Son telemáticas, de hasta 30 minutos, con un abogado asignado según la materia de tu caso. Tu plan incluye de 2 a 4 consultas al año.</p></details>
            <details><summary>¿Y si necesito más consultas? <Ico nombre="mas" /></summary><p>Como afiliado puedes contratar una consulta telemática adicional por $10 + IVA, o una consulta presencial por $25 + IVA la hora.</p></details>
            <details><summary>¿La membresía cubre el juicio o el trámite completo? <Ico nombre="mas" /></summary><p>La membresía incluye la orientación. Si tu caso necesita un abogado o un gestor que lo lleve, lo contratas con descuento por ser afiliado y con opciones de financiamiento.</p></details>
            <details><summary>¿Mis datos están seguros? <Ico nombre="mas" /></summary><p>Sí. Tratamos tus datos conforme a la Ley Orgánica de Protección de Datos Personales y tus consultas son confidenciales.</p></details>
          </div>
        </div>
      </section>

      {/* NOSOTROS — fuera de la revisión 1; sigue en el menú y va al final */}
      <section id="nosotros" data-buddie="nosotros">
        <div className="wrap rejilla">
          <div className="carta">
            <span className="etiqueta">Nosotros</span>
            <h3>El momento de transformar el mundo legal ha llegado.</h3>
            <p>Tranqi nace de una tradición jurídica de cuatro generaciones y de una convicción: frente a la corrupción, la inseguridad y la desconfianza, necesitamos elevar la calidad del servicio legal.</p>
            <p>Impulsamos la corporativización del derecho: integrar abogados, tecnología y financiamiento mediante LegalTech y FinTech, con estándares de responsabilidad y transparencia. Nuestro propósito es que las personas encuentren soluciones y puedan ejercer sus derechos.</p>
            <div className="firma"><span className="avatar">GC</span><div><b>Galo F. Chiriboga Pérez</b><small>Fundador y CEO de Tranqi</small></div></div>
          </div>
          <div className="pilares">
            <h3>Nuestros pilares institucionales</h3>
            <div className="pilar"><span className="cuadroico"><Ico nombre="bombilla" /></span><div><b>Innovación</b><span>Transformamos los servicios tradicionales mediante tecnología y soluciones digitales.</span></div></div>
            <div className="pilar"><span className="cuadroico"><Ico nombre="usuario" /></span><div><b>Accesibilidad</b><span>Acercamos la asistencia jurídica y profesional a todas las personas y empresas.</span></div></div>
            <div className="pilar"><span className="cuadroico"><Ico nombre="enlace" /></span><div><b>Conectividad</b><span>Integramos usuarios, abogados, profesionales, empresas y aliados estratégicos.</span></div></div>
            <div className="pilar"><span className="cuadroico"><Ico nombre="escudo" /></span><div><b>Confianza</b><span>Construimos relaciones basadas en transparencia, responsabilidad y seguridad.</span></div></div>
            <div className="pilar"><span className="cuadroico"><Ico nombre="corazon" /></span><div><b>Impacto social</b><span>Trabajamos para reducir las barreras de acceso a servicios y oportunidades.</span></div></div>
          </div>
        </div>
      </section>

      <footer className="pie-landing">
        <div className="wrap">
          <img src="/assets/tranqi-white.svg" alt="Tranqi" />
          <span>© 2026 Tranqi® · Todos los derechos reservados</span>
          <span className="enlaces">
            <a href="/terminos">Términos y privacidad</a> · <a href="/vacantes">Bolsa de empleo</a>
          </span>
        </div>
      </footer>

      <BuddieLanding />
    </div>
  );
}
