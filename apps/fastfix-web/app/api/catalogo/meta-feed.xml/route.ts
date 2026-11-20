import { NextRequest } from "next/server";
import { generarFeedXmlCatalogoMetaNegocio } from "@eco/comercio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const urlBase = (
    req.nextUrl?.origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://fastfix-web.vercel.app"
  ).replace(/\/+$/, "");

  const res = await generarFeedXmlCatalogoMetaNegocio({
    negocio: "fastfix",
    urlBaseTienda: urlBase,
  });

  return new Response(res.xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}
