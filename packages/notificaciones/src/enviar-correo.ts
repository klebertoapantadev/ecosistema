import nodemailer from "nodemailer";

// Server-only. No importar desde un client component -- lee variables de
// entorno sin NEXT_PUBLIC_ (nunca deben llegar al bundle del navegador, ver
// gobernanza/politicas/gestion-credenciales.md §3). Cada app de Vercel es un
// negocio distinto con su propio SMTP_*, por eso no hay parametro "negocio":
// esta funcion siempre manda desde el remitente de LA app que la llama.
export async function enviarCorreo({ para, asunto, html }: { para: string; asunto: string; html: string }) {
  const transportador = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transportador.sendMail({
    from: `"${process.env.SMTP_FROM_NOMBRE}" <${process.env.SMTP_USER}>`,
    to: para,
    subject: asunto,
    html,
  });
}
