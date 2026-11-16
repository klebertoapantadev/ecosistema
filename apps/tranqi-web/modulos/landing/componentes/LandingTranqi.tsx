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
 * La cinta («churo»): UN hilo continuo. Cada tramo sale por y=900 y el
 * siguiente entra por y=0 en la misma x con tangente vertical, así el empalme
 * no se ve.
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

function Quiero() {
  return (
    <a className="btn btn-amarillo" href="#planes">
      Quiero estar tranqi <Ico nombre="flecha" />
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

  // La cinta se traza al entrar su sección. pathLength se calibra con el largo
  // real en pantalla: con non-scaling-stroke y preserveAspectRatio="none" el
  // guion «1» no cubre todo el trazo estirado (nota de TRQ-012).
  useEffect(() => {
    const calibrar = (svg: SVGSVGElement, ancho: number, alto: number) => {
      const vb = svg.viewBox.baseVal;
      if (!ancho || !alto || !vb.width || !vb.height) return;
      const sx = ancho / vb.width, sy = alto / vb.height;
      svg.querySelectorAll("path").forEach((p) => {
        const largo = p.getTotalLength();
        let enPantalla = 0, previo = p.getPointAtLength(0);
        for (let i = 1; i <= 200; i++) {
          const q = p.getPointAtLength((largo * i) / 200);
          enPantalla += Math.hypot((q.x - previo.x) * sx, (q.y - previo.y) * sy);
          previo = q;
        }
        if (enPantalla > 0) p.setAttribute("pathLength", String(largo / enPantalla));
      });
    };
    const medidor = new ResizeObserver((es) => {
      for (const e of es) calibrar(e.target as SVGSVGElement, e.contentRect.width, e.contentRect.height);
    });
    document.querySelectorAll<SVGSVGElement>(".landing .churo svg").forEach((s) => medidor.observe(s));
    const trazo = new IntersectionObserver((es) => {
      for (const e of es) e.target.querySelectorAll(".churo path").forEach((p) => p.classList.toggle("trazado", e.isIntersecting));
    }, { threshold: 0.12 });
    document.querySelectorAll(".landing section").forEach((s) => trazo.observe(s));
    return () => {
      medidor.disconnect();
      trazo.disconnect();
    };
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
          <img className="logo-grande" src="/assets/tranqi-white.svg" alt="tranqi®" />
          <h1>Tu tranquilidad también necesita <i>respaldo legal</i>.</h1>
          <p className="bajada">Accede a orientación jurídica profesional para ti y tu familia, y a servicios financieros, en un solo lugar.</p>
          <span className="sello">LegalTech + FinTech</span>
          <ul>
            <li><Ico nombre="check" />Una membresía anual</li>
            <li><Ico nombre="check" />Acceso a una red de abogados especializados</li>
            <li><Ico nombre="check" />Opciones de financiamiento y planes de pago para honorarios y servicios</li>
            <li><Ico nombre="check" />Plataforma disponible 24/7</li>
          </ul>
          <div className="oferta">
            <div className="pvp"><small>Tu membresía anual</small><b>Desde {precio}</b><em>Valor incluye IVA</em></div>
            <Quiero />
          </div>
        </div>
      </section>

      {/* 02 · CÓMO FUNCIONA — blanco, sin curva (la cinta solo roza el borde) */}
      <section id="como" data-buddie="como">
        <Churo color="#7866FF" d="M 1370 0 C 1370 250 1410 450 1395 620 C 1385 760 1370 800 1370 900" />
        <div className="wrap">
          <h2>Estar tranqi<br />es así de fácil.</h2>
          <p className="sub">En solo 3 pasos accedes a protección jurídica y soluciones financieras.</p>
          <div className="pasos">
            <div className="paso"><Ico nombre="tarjeta" /><h3>1. Afíliate</h3><p>Elige tu membresía y realiza tu pago seguro.</p></div>
            <div className="chevron" aria-hidden="true"><Ico nombre="chevron" /></div>
            <div className="paso"><Ico nombre="movil" /><h3>2. Accede</h3><p>Ingresa a tranqi desde tu dispositivo.</p></div>
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
        <Churo color="#7866FF" d="M 1370 0 C 1370 200 1340 500 1380 700 C 1395 800 1370 840 1370 900" />
        <div className="dona" aria-hidden="true">
          <img src={`${FOTOS}/app-hola.jpg`} alt="" />
          <img src={`${FOTOS}/asesoria.jpg`} alt="" />
          <img src={`${FOTOS}/tarjeta-tranqi.jpg`} alt="" />
          <img src={`${FOTOS}/app-icono.jpg`} alt="" />
        </div>
        <div className="wrap">
          <h2>El derecho a<br />estar tranqi.</h2>
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
        <Churo color="#7866FF" d="M 1370 0 C 1370 180 1420 330 1400 520 C 1380 700 1220 760 1220 900" />
        <div className="wrap">
          <h2>Soluciones legales<span>al alcance de todos.</span></h2>
          <div className="bento">
            <img className="b1" src={`${FOTOS}/manos.jpg`} alt="Manos unidas en círculo" />
            <img className="b2" src={`${FOTOS}/familia.jpg`} alt="Madre con su bebé y un adulto mayor usando el celular" />
            <img className="b3" src={`${FOTOS}/usuarios.jpg`} alt="Dos mujeres usando tranqi en el celular" />
            <img className="b4" src={`${FOTOS}/gestores.jpg`} alt="Gestora de tranqi atendiendo a una familia" />
            <img className="b5" src={`${FOTOS}/joven-celular.jpg`} alt="Joven revisando su celular" />
            <img className="b6" src={`${FOTOS}/adulto-mayor.jpg`} alt="Adulto mayor frente a su computadora" />
          </div>
        </div>
      </section>

      {/* 05 · PLANES — amarillo, Personas + Empresas, logos de todas las tarjetas */}
      <section id="planes" data-buddie="planes">
        <Churo color="#7866FF" d="M 1220 0 C 1220 140 1420 200 1400 420 C 1380 640 330 640 330 900" />
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
            <span>Paga con todas las tarjetas</span>
            <img src={`${FOTOS}/tarjetas.png`} alt="Visa, Mastercard, American Express, Alia, Discover y Diners Club" />
          </div>
        </div>
      </section>

      {/* 06 · ¿TIENES UNA DUDA LEGAL? — rosa + curva naranja */}
      <section id="duda" data-buddie="duda">
        <Churo color="#FE5800" d="M 330 0 C 330 200 600 230 900 270 C 1250 320 1340 450 1310 610 C 1290 760 1370 800 1370 900" />
        <div className="wrap">
          <h2>¿Tienes una duda legal?<span>No tienes que resolverla solo.</span></h2>
          <div className="tira">
            <img src={`${FOTOS}/manos.jpg`} alt="" />
            <img src={`${FOTOS}/consulta-video.jpg`} alt="Mujer en una videoconsulta" />
            <img src={`${FOTOS}/app-cafe.jpg`} alt="Persona usando la app de tranqi" />
            <img src={`${FOTOS}/familia.jpg`} alt="" />
          </div>
          <p className="remate">Desde una consulta cotidiana hasta una situación legal más compleja, tranqi te conecta con profesionales que pueden orientarte.</p>
        </div>
      </section>

      {/* 07 · RED DE EXPERTOS — confianza y respaldo */}
      <section id="red" data-buddie="red">
        <Churo color="#5000BA" d="M 1370 0 C 1370 200 1340 500 1380 700 C 1395 800 1370 840 1370 900" />
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
            <a className="btn btn-amarillo" href="#contacto" data-abrir-chat>Hablar con tranqi ahora <Ico nombre="flecha" /></a>
          </div>
        </div>
      </section>

      {/* 08 · ¿ERES ABOGADO? — lámina 9 del recorrido, en la posición 8 */}
      <section id="abogado" data-buddie="abogado">
        <Churo color="#5000BA" d="M 1370 0 C 1370 250 1410 450 1395 620 C 1385 760 1370 800 1370 900" />
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
              <span className="logo-violeta" role="img" aria-label="tranqi" />
            </div>
          </div>
        </div>
      </section>

      {/* 09 · CONTACTO — rosa + curva naranja; nunca fondo negro */}
      <section id="contacto" data-buddie="contacto">
        <Churo color="#FE5800" d="M 1370 0 C 1370 300 800 380 760 600 C 730 780 900 820 900 900" />
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

      {/* 10 · FAQ — menta + curva negra */}
      <section id="faq" data-buddie="faq">
        <Churo color="#111111" d="M 900 0 C 900 200 1420 220 1400 500 C 1380 760 1250 780 1250 900" />
        <div className="wrap rejilla">
          <div className="lado"><h2>FAQ</h2><p>Lo que más nos preguntan antes de estar tranqi.</p></div>
          <div className="preguntas">
            <details open><summary>¿Qué es la membresía tranqi? <Ico nombre="mas" /></summary><p>Un plan anual de protección jurídica: incluye consultas con abogados, acceso a la plataforma y descuentos en honorarios y trámites. Empieza el día que la compras y dura un año.</p></details>
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
        <Churo color="#111111" d="M 1250 0 C 1250 300 700 260 640 560 C 600 760 900 780 900 960" />
        <div className="wrap rejilla">
          <div className="carta">
            <span className="etiqueta">Nosotros</span>
            <h3>El momento de transformar el mundo legal ha llegado.</h3>
            <p>tranqi nace de una tradición jurídica de cuatro generaciones y de una convicción: frente a la corrupción, la inseguridad y la desconfianza, necesitamos elevar la calidad del servicio legal.</p>
            <p>Impulsamos la corporativización del derecho: integrar abogados, tecnología y financiamiento mediante LegalTech y FinTech, con estándares de responsabilidad y transparencia. Nuestro propósito es que las personas encuentren soluciones y puedan ejercer sus derechos.</p>
            <div className="firma"><span className="avatar">GC</span><div><b>Galo F. Chiriboga Pérez</b><small>Fundador y CEO de tranqi</small></div></div>
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
          <img src="/assets/tranqi-white.svg" alt="tranqi" />
          <span>© 2026 tranqi® · Todos los derechos reservados</span>
          <span className="enlaces">
            <a href="/terminos">Términos y privacidad</a> · <a href="/vacantes">Bolsa de empleo</a>
          </span>
        </div>
      </footer>

      <BuddieLanding />
    </div>
  );
}
