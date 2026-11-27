import type { NextRequest } from "next/server";
import { manejarInicioOauthGoogleContacts } from "@eco/comercio/google-contacts-servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return manejarInicioOauthGoogleContacts(req, "tinkay");
}
