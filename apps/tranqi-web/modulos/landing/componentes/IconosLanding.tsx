/**
 * Íconos de línea de la landing (estilo de la lámina 30 del brandbook): un
 * sprite SVG que se pinta una vez y `<Ico nombre="…" />` para usarlos. El
 * color sale de `currentColor` y el grosor de `.landing .ico`.
 */

export function SpriteIconos() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
      <symbol id="i-flecha" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
      <symbol id="i-abajo" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
      <symbol id="i-mas" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
      <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
      <symbol id="i-usuario" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></symbol>
      <symbol id="i-familia" viewBox="0 0 24 24"><circle cx="9" cy="7" r="3.2"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20a6 6 0 0 1 12 0M14.5 15.2A4.5 4.5 0 0 1 21 19"/></symbol>
      <symbol id="i-edificio" viewBox="0 0 24 24"><path d="M4 21V5l8-2v18M12 9h8v12M4 21h17M8 8h0M8 12h0M8 16h0M16 13h0M16 17h0"/></symbol>
      <symbol id="i-tarjeta" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h4"/></symbol>
      <symbol id="i-chat" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.4A8 8 0 1 1 21 12Z"/><path d="M8.5 11h7M8.5 14.5h4"/></symbol>
      <symbol id="i-balanza" viewBox="0 0 24 24"><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0L5 7ZM19 7l-3 7a3.5 3.5 0 0 0 6 0l-3-7Z"/></symbol>
      <symbol id="i-porcentaje" viewBox="0 0 24 24"><path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></symbol>
      <symbol id="i-pantalla" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></symbol>
      <symbol id="i-billetera" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h12v4"/><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M16 13.5h2"/></symbol>
      <symbol id="i-reloj" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
      <symbol id="i-escudo" viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></symbol>
      <symbol id="i-candado" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></symbol>
      <symbol id="i-historia" viewBox="0 0 24 24"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/></symbol>
      <symbol id="i-red" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M10.8 7.2 6.2 15.8M13.2 7.2l4.6 8.6M7.5 18h9"/></symbol>
      <symbol id="i-doc" viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></symbol>
      <symbol id="i-casa" viewBox="0 0 24 24"><path d="M3 11 12 4l9 7M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></symbol>
      <symbol id="i-maletin" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></symbol>
      <symbol id="i-auto" viewBox="0 0 24 24"><path d="M5 16V11l2-5h10l2 5v5M3 16h18v3H3zM5 11h14"/><circle cx="7.5" cy="16" r="0.5"/><circle cx="16.5" cy="16" r="0.5"/></symbol>
      <symbol id="i-avion" viewBox="0 0 24 24"><path d="M10.5 13.5 3 11l1.5-1.5 8 1 4-4.5a2 2 0 0 1 3 3l-4.5 4 1 8L15.5 22 13 14.5"/></symbol>
      <symbol id="i-moneda" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.6.8-2.6 2s1.1 1.6 2.6 2 2.7.9 2.7 2.1-1.2 2-2.7 2c-1.2 0-2.2-.5-2.7-1.4M12 6.5V8M12 16v1.5"/></symbol>
      <symbol id="i-corazon" viewBox="0 0 24 24"><path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20Z"/></symbol>
      <symbol id="i-gestor" viewBox="0 0 24 24"><circle cx="12" cy="7" r="3.5"/><path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M9.5 14l2.5 4 2.5-4"/></symbol>
      <symbol id="i-bombilla" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/></symbol>
      <symbol id="i-enlace" viewBox="0 0 24 24"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></symbol>
      <symbol id="i-telefono" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></symbol>
      <symbol id="i-correo" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3 7 9 6 9-6"/></symbol>
      <symbol id="i-ubicacion" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></symbol>
      <symbol id="i-chevron" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></symbol>
      <symbol id="i-movil" viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></symbol>
      <symbol id="i-chats" viewBox="0 0 24 24"><path d="M3 4h12v8H7.5L3 15.5V4Z"/><path d="M15 8h6v11.5L16.5 16H9v-4"/></symbol>
      <symbol id="i-mundo" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/></symbol>
      <symbol id="i-grafico" viewBox="0 0 24 24"><path d="M4 20h16M6 20v-5M10 20v-8M14 20v-6M18 20V9M5 11l5-4 4 3 5-5M16 5h3v3"/></symbol>
      <symbol id="i-apreton" viewBox="0 0 24 24"><path d="M2 9.5 5.5 6l4 2 2.5-1.5L15 6l3.5 1.5L22 10M2 9.5l4 5M22 10l-4 4.5M8 12.5l2.5 2.5M10 11l3.5 3.5a1.4 1.4 0 0 1-2 2L9 14M12.5 10.5l3.5 3.5a1.4 1.4 0 0 1-2 2"/></symbol>
      <symbol id="i-institucion" viewBox="0 0 24 24"><path d="M3 21h18M4 18h16M12 3 3 8h18L12 3ZM6 9v8M10 9v8M14 9v8M18 9v8"/></symbol>
      <symbol id="i-escudo-estrella" viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="m12 8 1.2 2.5 2.7.3-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.3Z"/></symbol>
      <symbol id="i-tarjeta-escudo" viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><rect x="7.5" y="9" width="9" height="6" rx="1"/><path d="M7.5 11.2h9"/></symbol>
    </svg>
  );
}

export function Ico({ nombre }: { nombre: string }) {
  return (
    <svg className="ico" aria-hidden="true">
      <use href={`#i-${nombre}`} />
    </svg>
  );
}
