"use client";

/**
 * Buddie de la landing: el personaje fijo en la esquina que comenta cada
 * sección al entrar en pantalla (atributo `data-buddie`) y abre el chat con el
 * agente ARIA de tranqi (`/api/chat`), incluido el relevo a un asesor humano.
 *
 * Trasladado tal cual desde `app/page.tsx` (TRQ-024): solo se quitaron la
 * paginación por secciones, la cinta y los «reveals», que eran de la landing
 * anterior. Cualquier elemento con `data-abrir-chat` abre el chat.
 */

import { useEffect } from "react";
import { Sparkles } from "lucide-react";

const PRESENTACION =
  "¡Hola! Soy Tranqi, tu respaldo legal de confianza. Te acompaño mientras exploras — y si algo te da curiosidad, haz clic en mí y hablamos.";

// Respuesta de reserva por sección si ARIA no contesta. Las claves son los
// `data-buddie` de LandingTranqi.
const FALLBACK: Record<string, string> = {
  como: "Afíliate, entra desde tu celular y consulta con un abogado. Así de simple.",
  beneficios: "Consultas con abogados, descuentos de hasta 20 % en honorarios y todo desde tu celular.",
  soluciones: "Lo legal no tiene por qué ser complicado ni caro. Para eso estamos.",
  planes: "Desde $23 al año con IVA incluido: unos 6 centavos al día por vivir Tranqi.",
  duda: "Cuéntame qué te pasa y te digo cómo te podemos ayudar.",
  red: "Abogados organizados por especialidad en todo el Ecuador, listos para orientarte.",
  abogado: "Si eres abogado, la red te da clientes, ingresos y capacitación constante.",
  contacto: "Este es el momento de dar el paso. Pregúntame cómo unirte.",
  faq: "¿Te quedó alguna duda? Pregúntame lo que quieras.",
  nosotros: "Cuatro generaciones de tradición jurídica, ahora con tecnología.",
};

export function BuddieLanding() {
  useEffect(() => {
    let convId = "";
    try {
      const guardado = window.localStorage.getItem("eco_chat_conv_tranqi");
      if (guardado && /^[A-Za-z0-9_-]{8,64}$/.test(guardado)) {
        convId = guardado;
      } else {
        convId = crypto.randomUUID();
        window.localStorage.setItem("eco_chat_conv_tranqi", convId);
      }
    } catch {
      convId = crypto.randomUUID();
    }
    const idsHumanosVistos = new Set<string>();
    const seen = new Set<string>();
    let busy = false;
    let globoTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelado = false;
    const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
    const cuerpo = $("cuerpo"), globo = $("globo"), avatar = $("avatar"), chispa = $("chispa");
    const chat = $("chat"), log = $("chatLog"), input = $<HTMLInputElement>("chatInput"), send = $<HTMLButtonElement>("chatSend");

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

    async function askAgent(prompt: string): Promise<{ texto: string; modoHumano?: boolean; asesoraNombre?: string }> {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, conversation_id: convId }),
      });
      const data = await r.json();
      if (r.ok && data.modoHumano) {
        return { texto: "", modoHumano: true, asesoraNombre: data.asesoraNombre || "Asesor Legal" };
      }
      if (!r.ok || data.error) throw new Error(data.error || r.status);
      return { texto: String(data.response || "") };
    }

    async function comentarSeccion(key: string) {
      if (seen.has(key) || busy) return;
      seen.add(key);
      if (key === "hero") return;
      busy = true;
      escribiendo();
      let text: string;
      try {
        const res = await askAgent(`[CONTEXTO: el visitante acaba de llegar a la sección ${key}] evento de navegación`);
        text = res.texto || FALLBACK[key] || PRESENTACION;
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
    const ctasChat = document.querySelectorAll<HTMLElement>("[data-abrir-chat]");
    const onCta = (e: MouseEvent) => { e.preventDefault(); abrirChat(); };
    ctasChat.forEach((c) => c.addEventListener("click", onCta));

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
      let answer = "";
      let enModoHumano = false;
      try {
        const res = await askAgent(text);
        answer = res.texto;
        enModoHumano = Boolean(res.modoHumano);
      } catch {
        answer = "Uy, se me cruzaron los cables un segundo. ¿Me lo repites?";
      }
      typing.remove();
      if (!enModoHumano && answer) {
        addMsg(answer, "bot");
      }
      busy = false;
      send.disabled = false;
      input.focus();
    }
    const onSendClick = () => enviar(input.value);
    send.addEventListener("click", onSendClick);
    const onInputKeydown = (e: KeyboardEvent) => e.key === "Enter" && enviar(input.value);
    input.addEventListener("keydown", onInputKeydown);

    const sincronizarAsesorHumano = async () => {
      if (cancelado || !chat.classList.contains("open")) return;
      try {
        const r = await fetch(`/api/chat?conversation_id=${encodeURIComponent(convId)}`, {
          method: "GET",
          cache: "no-store",
        });
        if (!r.ok || cancelado) return;
        const data = await r.json();
        const recibidos = Array.isArray(data?.mensajesHumanos) ? data.mensajesHumanos : [];
        for (const m of recibidos) {
          if (m?.id && !idsHumanosVistos.has(String(m.id))) {
            idsHumanosVistos.add(String(m.id));
            addMsg(`👩‍💼 ${m.autorNombre || "Asesor"}: ${m.contenido}`, "bot");
          }
        }
      } catch {
        // Silencioso ante cortes momentáneos
      }
    };
    const syncHumanTimer = setInterval(sincronizarAsesorHumano, 4500);

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

    // ── arranque ────────────────────────────────────────────────────────
    const arranque = setTimeout(() => {
      seen.add("hero");
      decirGlobo(esc(PRESENTACION) + '<span class="pista">Clic para chatear conmigo →</span>', 14000);
      addMsg(PRESENTACION, "bot");
    }, 1400);

    return () => {
      cancelado = true;
      clearTimeout(arranque);
      clearTimeout(parpadeoTimer);
      clearTimeout(globoTimer);
      clearTimeout(settle);
      clearInterval(syncHumanTimer);
      document.removeEventListener("mousemove", onMousemove);
      avatar.removeEventListener("click", onAvatarClick);
      globo.removeEventListener("click", abrirChat);
      chatClose.removeEventListener("click", onChatClose);
      ctasChat.forEach((c) => c.removeEventListener("click", onCta));
      send.removeEventListener("click", onSendClick);
      input.removeEventListener("keydown", onInputKeydown);
      obs.disconnect();
    };
  }, []);

  return (
    <>
      <div id="buddie" aria-live="polite">
        <div className="cuerpo" id="cuerpo">
          <div className="globo" id="globo" />
          <div className="avatar" id="avatar" title="Habla conmigo">
            <div className="ojos"><div className="ojo" /><div className="ojo" /></div>
            <div className="chispa" id="chispa"><Sparkles size={14} strokeWidth={1.8} /></div>
          </div>
        </div>
      </div>

      <div id="chat">
        <div className="chat-head">
          <div className="mini" />
          <div><b>Tranqi</b><small>Tu respaldo legal de confianza</small></div>
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
