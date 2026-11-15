import { NextResponse } from 'next/server';
import { obtenerProformaPorTokenAction } from '@eco/comercio/acciones-logistica';
import { generarPdfProformaBytes } from '@eco/comercio/pdf-proforma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const res = await obtenerProformaPorTokenAction(token);

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const urlPublica = `${origin}/proforma/${res.proforma.tokenAprobacion}`;
  const pdfBytes = await generarPdfProformaBytes(res.proforma, { urlPublica });
  const nombreArchivo = `Proforma_${res.proforma.codigoProforma.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

