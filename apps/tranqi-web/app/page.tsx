"use client";

import { useEffect, useRef, useState } from "react";
import { crearClienteNavegador } from "@eco/supabase";

interface AbogadoCard {
  id: string;
  nombre: string;
  cargo: string;
  materia: string;
  ubicacion: string;
  experiencia: string;
  verificado: boolean;
}

const ABOGADOS_BASE: AbogadoCard[] = [
  { id: "1", nombre: "Mateo Salazar", cargo: "Socio fundador", materia: "Derecho Civil", ubicacion: "Quito · 4 prov.", experiencia: "12 años", verificado: true },
  { id: "2", nombre: "Camila Rosero", cargo: "Abogada litigante", materia: "Derecho Laboral", ubicacion: "Guayaquil · 2 prov.", experiencia: "8 años", verificado: true },
  { id: "3", nombre: "Andrés Villacís", cargo: "Abogado litigante", materia: "Derecho Penal", ubicacion: "Cuenca · 3 prov.", experiencia: "15 años", verificado: true },
  { id: "4", nombre: "Fernanda Cevallos", cargo: "Asesora legal", materia: "Derecho de Familia", ubicacion: "Quito · 1 prov.", experiencia: "6 años", verificado: true },
  { id: "5", nombre: "Gabriel Mendoza", cargo: "Especialista tributario", materia: "Derecho Mercantil", ubicacion: "Ambato · 3 prov.", experiencia: "10 años", verificado: true },
  { id: "6", nombre: "Sofía Alarcón", cargo: "Abogada litigante", materia: "Derecho Constitucional", ubicacion: "Loja · 2 prov.", experiencia: "7 años", verificado: true },
  { id: "7", nombre: "Roberto Peralta", cargo: "Consultor legal", materia: "Derecho Administrativo", ubicacion: "Manta · 4 prov.", experiencia: "14 años", verificado: true },
  { id: "8", nombre: "Elena Izquierdo", cargo: "Asesora corporativa", materia: "Derecho Societario", ubicacion: "Ibarra · 2 prov.", experiencia: "9 años", verificado: true },
];

const PRESENTACION =
  "¡Hola! Soy tranqi, el amigo que estudió derecho. Te acompaño mientras exploras — y si algo te da curiosidad, haz clic en mí y hablamos.";

const FALLBACK: Record<string, string> = {
  hola: "Somos una estructura digital de protección jurídica: abogados + tecnología + financiamiento.",
  problema: "Fuerte, ¿no? Hoy la justicia es cara y reactiva. Eso es justo lo que venimos a cambiar.",
  manifiesto: "Eso somos: el amigo que te explica sin enredos y no te deja solo.",
  app: "Toda tu vida legal en una app: consultas, citas, pagos y trámites.",
  planes: "USD 20 al año. Menos de 6 centavos al día por vivir tranqi.",
  statement: "Así de simple: lo legal, para todos.",
  red: "Si eres abogado, la red te da clientes, ingresos y capacitación constante.",
  equipo: "Nuestros abogados cuentan con título verificado en SENESCYT y matrícula activa en el Foro de Abogados.",
  contacto: "Este es el momento de dar el paso. Pregúntame cómo unirte.",
};

export default function TranqiLanding() {
  const carruselRef = useRef<HTMLDivElement>(null);
  const [abogados, setAbogados] = useState<AbogadoCard[]>(ABOGADOS_BASE);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);

  const deslizarCarrusel = (dir: number) => {
    if (carruselRef.current) {
      const scrollAmount = 240 * dir;
      carruselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!carruselRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - carruselRef.current.offsetLeft;
    scrollLeftPos.current = carruselRef.current.scrollLeft;
  };
  const onMouseLeave = () => { isDragging.current = false; };
  const onMouseUp = () => { isDragging.current = false; };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !carruselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carruselRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    carruselRef.current.scrollLeft = scrollLeftPos.current - walk;
  };

  useEffect(() => {
    async function cargarAbogadosRegistrados() {
      try {
        const supabase = crearClienteNavegador();
        const { data: solicitudes } = await supabase
          .schema("tranqui_legal")
          .from("trq_solicitud_socio")
          .select("ssc_id, ssc_usuario_id, ssc_estado, ssc_creado_en")
          .order("ssc_creado_en", { ascending: false })
          .limit(12);

        if (solicitudes && solicitudes.length > 0) {
          const uIds = [...new Set(solicitudes.map((s) => s.ssc_usuario_id))];
          const { data: usuarios } = await supabase
            .schema("comun_seguridad")
            .from("seg_usuario")
            .select("usu_id, usu_nombres, usu_apellidos")
            .in("usu_id", uIds);

          const mapaUsuarios = new Map((usuarios ?? []).map((u) => [u.usu_id, u]));

          const registrados: AbogadoCard[] = solicitudes.map((sol) => {
            const u = mapaUsuarios.get(sol.ssc_usuario_id);
            const nom = u && (u.usu_nombres || u.usu_apellidos)
              ? `${u.usu_nombres ?? ""} ${u.usu_apellidos ?? ""}`.trim()
              : "Abogado Registrado";
            return {
              id: sol.ssc_id,
              nombre: nom,
              cargo: sol.ssc_estado === "ACEPTADA" ? "Abogado de la Red" : "Socio Postulante",
              materia: "Derecho General",
              ubicacion: "Ecuador",
              experiencia: "Verificado",
              verificado: sol.ssc_estado === "ACEPTADA",
            };
          });

          setAbogados((prev) => {
            const idsExistentes = new Set(prev.map((a) => a.id));
            const nuevos = registrados.filter((r) => !idsExistentes.has(r.id));
            return [...prev, ...nuevos];
          });
        }
      } catch {
        // En caso de RLS sin autenticación previa, se mantienen los abogados base demostrativos
      }
    }
    cargarAbogadosRegistrados();
  }, []);

  useEffect(() => {
    const convId = crypto.randomUUID();
    const seen = new Set<string>();
    let busy = false;
    let globoTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelado = false;

    const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
    const cuerpo = $("cuerpo"), globo = $("globo"), avatar = $("avatar"), chispa = $("chispa");
    const chat = $("chat"), log = $("chatLog"), input = $<HTMLInputElement>("chatInput"), send = $<HTMLButtonElement>("chatSend");

    // ── La cinta se traza cuando su sección entra en pantalla ──────────
    document.querySelectorAll(".ribbon path").forEach((p) => p.setAttribute("pathLength", "1"));

    const trazo = new IntersectionObserver((es) => {
      for (const e of es) {
        e.target.querySelectorAll(".ribbon path").forEach((p) => p.classList.toggle("trazado", e.isIntersecting));
      }
    }, { threshold: 0.12 });
    document.querySelectorAll("section").forEach((s) => trazo.observe(s));

    // ── PAGINACIÓN SUAVE ────────────────────────────────────────────────
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    scrollTo(0, 0);

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const secciones = [...document.querySelectorAll<HTMLElement>("section")];
    const escritorio = () => innerWidth >= 900 && !reducedMotion;
    let animando = false, indice = 0, ultimoSalto = 0;
    const DUR = 950;

    if (escritorio()) {
      document.documentElement.style.scrollSnapType = "none";
      document.documentElement.style.scrollBehavior = "auto";
    }

    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    function irASeccion(i: number) {
      i = Math.max(0, Math.min(secciones.length - 1, i));
      const inicio = scrollY;
      const dist = secciones[i]!.offsetTop - inicio;
      indice = i;
      if (Math.abs(dist) < 2) return;
      animando = true;
      const t0 = performance.now();
      requestAnimationFrame(function paso(now) {
        const t = Math.min(1, (now - t0) / DUR);
        scrollTo(0, inicio + dist * ease(t));
        if (t < 1) requestAnimationFrame(paso);
        else animando = false;
      });
    }

    const onWheel = (e: WheelEvent) => {
      if (!escritorio()) return;
      e.preventDefault();
      const ahora = performance.now();
      if (animando || ahora - ultimoSalto < DUR + 160) return;
      if (Math.abs(e.deltaY) < 6) return;
      ultimoSalto = ahora;
      irASeccion(indice + (e.deltaY > 0 ? 1 : -1));
    };
    addEventListener("wheel", onWheel, { passive: false });

    const onKeydown = (e: KeyboardEvent) => {
      if (!escritorio() || animando || document.activeElement === input) return;
      const k = e.key;
      if (k === "ArrowDown" || k === "PageDown" || k === " ") { e.preventDefault(); irASeccion(indice + 1); }
      else if (k === "ArrowUp" || k === "PageUp") { e.preventDefault(); irASeccion(indice - 1); }
      else if (k === "Home") { e.preventDefault(); irASeccion(0); }
      else if (k === "End") { e.preventDefault(); irASeccion(secciones.length - 1); }
    };
    addEventListener("keydown", onKeydown);

    const enlaces = document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]:not([href="#"])');
    const onLinkClick = (a: HTMLAnchorElement) => (e: MouseEvent) => {
      const destino = document.querySelector<HTMLElement>(a.getAttribute("href")!);
      if (!destino || !escritorio() || !secciones.includes(destino)) return;
      e.preventDefault();
      irASeccion(secciones.indexOf(destino));
    };
    const linkHandlers: Array<[HTMLAnchorElement, (e: MouseEvent) => void]> = [];
    enlaces.forEach((a) => {
      const h = onLinkClick(a);
      a.addEventListener("click", h);
      linkHandlers.push([a, h]);
    });

    const onScroll = () => { if (!animando) indice = Math.round(scrollY / innerHeight); };
    addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => { indice = Math.round(scrollY / innerHeight); };
    addEventListener("resize", onResize);

    // ── UI helpers ──────────────────────────────────────────────────────
    function decirGlobo(html: string, ms = 9000) {
      globo.innerHTML = html;
      globo.classList.add("show");
      avatar.classList.add("feliz");
      setTimeout(() => avatar.classList.remove("feliz"), 1400);
      cuerpo.classList.remove("hablando");
      void cuerpo.offsetWidth;
      cuerpo.classList.add("hablando");
      clearTimeout(globoTimer);
      if (ms) globoTimer = setTimeout(() => globo.classList.remove("show"), ms);
    }
    function escribiendo() {
      decirGlobo('<span class="typing"><i></i><i></i><i></i></span>', 0);
    }
    function addMsg(text: string, who: string) {
      const div = document.createElement("div");
      div.className = "msg " + who;
      div.textContent = text;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }
    const esc = (s: string) =>
      s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

    async function askAgent(prompt: string) {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, conversation_id: convId }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || r.status);
      return data.response as string;
    }

    async function comentarSeccion(key: string) {
      if (seen.has(key) || busy) return;
      seen.add(key);
      if (key === "hero") return;
      busy = true;
      escribiendo();
      let text: string;
      try {
        text = await askAgent(`[CONTEXTO: el visitante acaba de llegar a la sección ${key}] evento de navegación`);
      } catch {
        text = FALLBACK[key] || PRESENTACION;
      }
      busy = false;
      decirGlobo(esc(text));
      addMsg(text, "bot");
      if (!chat.classList.contains("open")) chispa.classList.add("on");
    }

    let pendiente: string | null = null, settle: ReturnType<typeof setTimeout> | undefined;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          pendiente = (e.target as HTMLElement).dataset.buddie ?? null;
          clearTimeout(settle);
          settle = setTimeout(() => pendiente && comentarSeccion(pendiente), 900);
        }
      }
    }, { threshold: 0.5 });
    document.querySelectorAll("[data-buddie]").forEach((s) => obs.observe(s));

    // ── chat ────────────────────────────────────────────────────────────
    function abrirChat() {
      chat.classList.add("open");
      globo.classList.remove("show");
      chispa.classList.remove("on");
      input.focus();
    }
    const onAvatarClick = () => (chat.classList.contains("open") ? chat.classList.remove("open") : abrirChat());
    avatar.addEventListener("click", onAvatarClick);
    globo.addEventListener("click", abrirChat);
    const chatClose = $("chatClose");
    const onChatClose = () => chat.classList.remove("open");
    chatClose.addEventListener("click", onChatClose);
    const ctaHablar = $("ctaHablar");
    const onCta = (e: MouseEvent) => { e.preventDefault(); abrirChat(); };
    ctaHablar.addEventListener("click", onCta);

    async function enviar(text: string) {
      if (!text.trim() || busy) return;
      addMsg(text, "user");
      input.value = "";
      busy = true;
      send.disabled = true;
      const typing = document.createElement("div");
      typing.className = "msg bot";
      typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
      log.appendChild(typing);
      log.scrollTop = log.scrollHeight;
      let answer: string;
      try {
        answer = await askAgent(text);
      } catch {
        answer = "Uy, se me cruzaron los cables un segundo. ¿Me lo repites?";
      }
      typing.remove();
      addMsg(answer, "bot");
      busy = false;
      send.disabled = false;
      input.focus();
    }
    const onSendClick = () => enviar(input.value);
    send.addEventListener("click", onSendClick);
    const onInputKeydown = (e: KeyboardEvent) => e.key === "Enter" && enviar(input.value);
    input.addEventListener("keydown", onInputKeydown);

    // ── ojos: siguen el cursor + parpadeo ───────────────────────────────
    const ojos = document.querySelectorAll<HTMLElement>(".ojo");
    const onMousemove = (e: MouseEvent) => {
      const r = avatar.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.min(1, Math.hypot(dx, dy) / 380);
      const a = Math.atan2(dy, dx);
      ojos.forEach((o) => (o.style.translate = `${Math.cos(a) * 2.5 * d}px ${Math.sin(a) * 2.5 * d}px`));
    };
    document.addEventListener("mousemove", onMousemove, { passive: true });

    let parpadeoTimer: ReturnType<typeof setTimeout>;
    (function parpadeo() {
      parpadeoTimer = setTimeout(() => {
        if (cancelado) return;
        avatar.classList.add("parpado");
        setTimeout(() => avatar.classList.remove("parpado"), 140);
        parpadeo();
      }, 2800 + Math.random() * 3200);
    })();

    // ── reveals ─────────────────────────────────────────────────────────
    const rev = new IntersectionObserver((es) => {
      es.forEach((e) => e.isIntersecting && e.target.classList.add("in"));
    }, { threshold: 0.15 });
    document.querySelectorAll(".reveal").forEach((el) => rev.observe(el));

    // ── arranque ────────────────────────────────────────────────────────
    const arranque = setTimeout(() => {
      seen.add("hero");
      decirGlobo(esc(PRESENTACION) + '<span class="pista">clic para chatear conmigo →</span>', 14000);
      addMsg(PRESENTACION, "bot");
    }, 1400);

    return () => {
      cancelado = true;
      clearTimeout(arranque);
      clearTimeout(parpadeoTimer);
      clearTimeout(globoTimer);
      clearTimeout(settle);
      removeEventListener("wheel", onWheel);
      removeEventListener("keydown", onKeydown);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      document.removeEventListener("mousemove", onMousemove);
      linkHandlers.forEach(([a, h]) => a.removeEventListener("click", h));
      avatar.removeEventListener("click", onAvatarClick);
      globo.removeEventListener("click", abrirChat);
      chatClose.removeEventListener("click", onChatClose);
      ctaHablar.removeEventListener("click", onCta);
      send.removeEventListener("click", onSendClick);
      input.removeEventListener("keydown", onInputKeydown);
      trazo.disconnect();
      obs.disconnect();
      rev.disconnect();
    };
  }, []);

  return (
    <>
      <nav className="nav-landing">
        <a className="logo" href="#hero"><img src="/assets/tranqi-white.svg" alt="tranqi" /></a>
        <div className="links">
          <a href="#hola">hola</a>
          <a href="#problema">el problema</a>
          <a href="#app">la app</a>
          <a href="#planes">planes</a>
          <a href="#red">abogados</a>
          <a href="#equipo">equipo</a>
          <a href="/vacantes">vacantes</a>
          <a href="/ingresar" className="link-ingresar">Ingresar</a>
          <a href="/registro" className="cta">Únete</a>
        </div>
      </nav>

      {/* HERO · el hilo nace y sale por x=1016 */}
      <section id="hero" data-buddie="hero">
        <div className="ribbon"><svg viewBox="0 0 1440 900" preserveAspectRatio="none">
          <path pathLength={1} stroke="#7866FF" d="M 1140 170 C 1400 300 1300 570 1020 570 C 770 570 730 330 970 290 C 1200 252 1250 520 1120 700 C 1070 780 1016 800 1016 900" />
        </svg></div>
        <div className="wrap">
          <img className="logo-big" src="/assets/tranqi-white.svg" alt="tranqi®" />
          <h1>El derecho a estar <i>tranqi</i>.</h1>
          <p>Una nueva forma de acceder a la justicia: simple, humana y al alcance de todos.</p>
          <div className="ctas">
            <a className="btn btn-amarillo" href="#planes">Quiero estar tranqi</a>
            <a className="btn btn-blanco-borde" href="#hola">Conócenos</a>
          </div>
        </div>
      </section>

      {/* HOLA · entra 1016 · sale 252 */}
      <section id="hola" data-buddie="hola">
        <div className="ribbon"><svg viewBox="0 0 1440 900" preserveAspectRatio="none">
          <path pathLength={1} stroke="#7866FF" d="M 1016 0 C 1016 90 940 210 700 240 C 430 274 300 400 362 540 C 410 650 252 760 252 900" />
        </svg></div>
        <div className="wrap">
          <div className="saludo reveal">hola,</div>
          <div className="somos reveal"><span>somos</span> <img src="/assets/tranqi-black.svg" alt="tranqi" /></div>
          <p className="desc reveal">Una estructura digital de Protección Jurídica que combina tres componentes clave para facilitar el acceso a la justicia:</p>
          <div className="tres reveal">
            <b><i>01</i> Red de Abogados</b>
            <b><i>02</i> Tecnología Jurídica</b>
            <b><i>03</i> Financiamiento Legal</b>
          </div>
        </div>
      </section>

      {/* PROBLEMA · entra 252 · sale 430 */}
      <section id="problema" data-buddie="problema">
        <div className="ribbon"><svg viewBox="0 0 1440 900" preserveAspectRatio="none">
          <path pathLength={1} stroke="#D8FFB3" d="M 252 0 C 252 110 480 170 500 340 C 520 520 240 560 220 400 C 200 262 420 262 470 420 C 510 550 430 760 430 900" />
        </svg></div>
        <div className="wrap">
          <h2 className="reveal">El acceso a servicios jurídicos sigue siendo limitado para millones de personas.</h2>
          <div className="items">
            <div className="reveal"><b>Costos legales elevados</b><p>Los honorarios son inaccesibles.</p></div>
            <div className="reveal"><b>Procesos complejos</b><p>Resolver problemas legales es lento y complicado.</p></div>
            <div className="reveal"><b>Falta de asesoría preventiva</b><p>Pocas personas reciben ayuda antes del conflicto.</p></div>
          </div>
        </div>
        <div className="cierre">
          <div className="wrap"><p>La justicia es un servicio reactivo y costoso, cuando debería ser preventivo y accesible.</p></div>
        </div>
      </section>

      {/* MANIFIESTO · entra 430 · sale 1180 */}
      <section id="manifiesto" data-buddie="manifiesto">
        <div className="ribbon"><svg viewBox="0 0 1440 900" preserveAspectRatio="none">
          <path pathLength={1} stroke="#7866FF" opacity={0.92} d="M 430 0 C 430 120 900 115 1120 215 C 1290 292 1180 620 1180 900" />
        </svg></div>
        <div className="wrap">
          <p className="frase">tranqi es el amigo que estudió derecho, te entiende y te aconseja sin hacerte sentir perdido.</p>
        </div>
        <p className="credito">Foto: <a href="https://unsplash.com/@silverkblack" target="_blank" rel="noopener">Vitaly Gariev</a> · Unsplash</p>
      </section>

      {/* APP · entra 1180 · sale 1244 */}
      <section id="app" data-buddie="app">
        <div className="ribbon"><svg viewBox="0 0 1440 900" preserveAspectRatio="none">
          <path pathLength={1} stroke="#7866FF" d="M 1180 0 C 1180 150 1330 355 1292 565 C 1268 700 1244 780 1244 900" />
        </svg></div>
        <div className="wrap">
          <div className="head reveal"><img src="/assets/tranqi-black.svg" alt="tranqi" /><span>App</span></div>
          <div className="app-grid">
            <div>
              <p className="lead reveal">La aplicación te permite acceder de forma rápida y segura a todos los servicios del sistema de asistencia legal.</p>
              <ul className="reveal">
                <li>Agendar citas presenciales y virtuales</li>
                <li>Contratar tu asistencia legal</li>
                <li>Realizar pagos</li>
                <li>Acceder a financiamiento jurídico</li>
                <li>Dar seguimiento a tus trámites</li>
              </ul>
              <p className="cierre-app reveal">Tecnología, asistencia legal y acompañamiento profesional, desde cualquier lugar.</p>
            </div>
            <div className="mock-panel reveal">
              <div className="mock">
                <img className="mlogo" src="/assets/tranqi-black.svg" alt="tranqi" />
                <div className="foto">Hola,</div>
                <div className="chip naranja">URGENTE</div>
                <div className="chip lila">REUNIÓN PENDIENTE</div>
                <div className="boton">AGENDAR REUNIÓN</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLANES · entra 1244 · sale 336 */}
      <section id="planes" data-buddie="planes">
        <div className="ribbon"><svg viewBox="0 0 1440 900" preserveAspectRatio="none">
          <path pathLength={1} stroke="#7866FF" d="M 1244 0 C 1244 130 1420 300 1282 500 C 1162 662 882 642 902 462 C 922 302 1182 322 1162 522 C 1140 740 336 800 336 900" />
        </svg></div>
        <div className="wrap">
          <h2 className="reveal">Protección jurídica accesible</h2>
          <div className="precio reveal">USD 20 <span style={{ fontSize: "0.35em", fontWeight: 800 }}>al año</span></div>
          <p className="sub reveal">Un sistema diseñado para que cualquier persona pueda contar con respaldo legal permanente.</p>
          <p className="nota reveal">Sé parte de un futuro donde la justicia es rápida, eficiente y accesible.</p>
          <a className="btn btn-negro reveal" href="/registro">Unirme ahora</a>
        </div>
      </section>

      {/* STATEMENT · entra 336 · sale 1094 */}
      <section id="statement" data-buddie="statement">
        <div className="ribbon"><svg viewBox="0 0 1440 900" preserveAspectRatio="none">
          <path pathLength={1} stroke="#FE5800" d="M 336 0 C 336 130 520 180 700 160 C 980 130 1100 300 980 460 C 862 618 602 562 662 422 C 722 302 1094 402 1094 900" />
        </svg></div>
        <div className="wrap">
          <p className="reveal">Lo legal, para todos.</p>
        </div>
      </section>

      {/* RED · entra 1094 · sale 174 */}
      <section id="red" data-buddie="red">
        <div className="ribbon"><svg viewBox="0 0 1440 900" preserveAspectRatio="none">
          <path pathLength={1} stroke="#7866FF" opacity={0.85} d="M 1094 0 C 1094 140 800 262 560 342 C 330 420 174 640 174 900" />
        </svg></div>
        <div className="wrap">
          <h2 className="reveal">¿Eres abogado? La red también es para ti.</h2>
          <ul className="beneficios reveal">
            <li><b>Nuevas</b> oportunidades laborales</li>
            <li><b>Nuevas</b> fuentes de ingresos</li>
            <li><b>Beneficios</b> exclusivos</li>
            <li><b>Capacitación</b> constante</li>
            <li><b>Certificaciones</b></li>
            <li><b>Derivación</b> de clientes</li>
            <li><b>Cuenta</b> digital</li>
            <li><b>Crédito</b> y desarrollo</li>
          </ul>
          <a className="btn btn-blanco-borde reveal" href="/registro?intencion=abogado&destino=/panel/solicitud-socio">Quiero ser parte de la red</a>
          <p className="pub-date reveal" style={{ marginTop: 24, fontSize: "0.78rem", color: "rgba(255, 255, 255, 0.45)", fontWeight: 500, letterSpacing: "0.04em" }}>Publicado: 23 de julio de 2026 06:21</p>
        </div>
      </section>

      {/* NUESTRO EQUIPO · entra 174 · sale 174 (TRQ-002 / PLT-019) */}
      <section id="equipo" data-buddie="equipo">
        <div className="ribbon"><svg viewBox="0 0 1440 1400" preserveAspectRatio="none">
          <path pathLength={1} stroke="#D8FFB3" strokeWidth="1" opacity={0.55} d="M 174 0 C 174 360 1200 480 1100 800 C 1000 1120 174 1050 174 1400" />
        </svg></div>
        <div className="lienzo-equipo">
          <div className="cabecera-equipo reveal">
            <div style={{ maxWidth: "58ch" }}>
              <p className="rotulo-equipo">Nuestro equipo</p>
              <h2 style={{ marginBottom: 0 }}>Abogados reales, <i>verificados</i>, listos para acompañarte.</h2>
            </div>

            <div className="acciones-equipo">
              <a className="btn btn-blanco-borde" href="/registro?intencion=abogado&destino=/panel/solicitud-socio">
                Únete al equipo Jurídico
              </a>
              <a className="btn btn-blanco-borde" href="/vacantes">
                Únete al equipo Tranqi
              </a>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => deslizarCarrusel(-1)}
              aria-label="Anterior"
              className="btn-carrusel-flotante btn-carrusel-flotante-izq"
              title="Anterior"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>

            <div
              className="cuadricula-equipo"
              ref={carruselRef}
              onMouseDown={onMouseDown}
              onMouseLeave={onMouseLeave}
              onMouseUp={onMouseUp}
              onMouseMove={onMouseMove}
            >
              {abogados.map((abg) => (
                <article key={abg.id} className="card-equipo">
                  <div className="retrato-equipo">
                    <span className="etiqueta-equipo">{abg.materia}</span>
                    <div className="silueta-equipo">
                      <svg viewBox="0 0 100 100" fill="none" stroke="#D8FFB3" strokeWidth="1.6">
                        <circle cx="50" cy="38" r="19"/>
                        <path d="M14 92c0-24 16-38 36-38s36 14 36 38"/>
                      </svg>
                    </div>
                    {abg.verificado && (
                      <span className="verificado-equipo" title="Verificado">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#06251D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5"/>
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="datos-equipo">
                    <p className="nombre-equipo">{abg.nombre}</p>
                    <p className="cargo-equipo">{abg.cargo}</p>
                    <div className="fila-meta-equipo"><span>{abg.ubicacion}</span><b>{abg.experiencia}</b></div>
                  </div>
                </article>
              ))}
            </div>

            <button
              type="button"
              onClick={() => deslizarCarrusel(1)}
              aria-label="Siguiente"
              className="btn-carrusel-flotante btn-carrusel-flotante-der"
              title="Siguiente"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>

          <div className="pie-equipo">
            <p className="confianza-equipo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
              Título y matrícula verificados antes de aparecer en la red
            </p>
          </div>
        </div>
      </section>

      {/* CONTACTO · entra 174 · el hilo muere aquí */}
      <section id="contacto" data-buddie="contacto">
        <div className="ribbon"><svg viewBox="0 0 1440 900" preserveAspectRatio="none">
          <path pathLength={1} stroke="#5000BA" d="M 174 0 C 174 140 420 330 638 425 C 750 474 720 560 720 640" />
        </svg></div>
        <div className="wrap">
          <img className="reveal" src="/assets/tranqi-white.svg" alt="tranqi" />
          <h2 className="reveal">Democratizar la justicia, para que los derechos <i>sean de todos</i>.</h2>
          <a className="btn btn-amarillo reveal" href="#" id="ctaHablar">Hablar con tranqi ahora</a>
        </div>
        <div className="pie">© tranqi® 2026 · Todos los derechos reservados · Demo impulsada por ARIA</div>
      </section>

      {/* ═══════════ BUDDIE ═══════════ */}
      <div id="buddie" aria-live="polite">
        <div className="cuerpo" id="cuerpo">
          <div className="globo" id="globo" />
          <div className="avatar" id="avatar" title="Habla conmigo">
            <div className="ojos"><div className="ojo" /><div className="ojo" /></div>
            <div className="chispa" id="chispa">✦</div>
          </div>
        </div>
      </div>

      <div id="chat">
        <div className="chat-head">
          <div className="mini" />
          <div><b>tranqi</b><small>el amigo que estudió derecho</small></div>
          <button className="x" id="chatClose" aria-label="Cerrar">×</button>
        </div>
        <div className="chat-log" id="chatLog" />
        <div className="chat-in">
          <input id="chatInput" placeholder="Pregúntame lo que quieras…" autoComplete="off" />
          <button id="chatSend">Enviar</button>
        </div>
      </div>
    </>
  );
}
