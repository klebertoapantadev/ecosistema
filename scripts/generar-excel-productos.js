const fs = require('fs');
const path = require('path');
const XLSX = require('../packages/datagrid/node_modules/xlsx');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oaybbpdxhlxjbpwnoymy.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vC-t-FcOQ2Q5_XkTCcPKdQ_bveIh5YS';

async function main() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/com_producto?select=*,com_variante(*)`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Error en Supabase: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  function procesarFilas(filtroNegocio) {
    const filas = [];
    const prods = filtroNegocio ? data.filter((p) => p.pro_negocio === filtroNegocio) : data;

    prods.forEach((p) => {
      const vars = p.com_variante || [];
      if (vars.length === 0) {
        filas.push({
          'Código / SKU': p.pro_slug || p.pro_id,
          'Producto': p.pro_nombre,
          'Presentación / Variante': 'Única',
          'Nombre Completo': p.pro_nombre,
          'Precio Base ($)': 0,
          'Tarifa IVA (%)': p.pro_detalle_producto?.tarifa_iva_predeterminada ?? 0,
          'PVP ($)': 0,
          'Negocio': (p.pro_negocio || '').toUpperCase(),
          'Tipo': p.pro_tipo || 'PRODUCTO',
          'Estado': p.pro_activo ? 'Activo' : 'Inactivo',
        });
      } else {
        vars.forEach((v) => {
          const precioBase = Number(v.var_precio ?? 0);
          const ivaPorc = Number(v.var_tarifa_iva_porcentaje ?? 0);
          const pvp = ivaPorc > 0 ? Number((precioBase * (1 + ivaPorc / 100)).toFixed(2)) : precioBase;
          const esMulti = vars.length > 1;
          const nombreCompleto = esMulti ? `${p.pro_nombre} — ${v.var_nombre}` : p.pro_nombre;

          filas.push({
            'Código / SKU': v.var_sku || p.pro_slug || v.var_id,
            'Producto': p.pro_nombre,
            'Presentación / Variante': v.var_nombre,
            'Nombre Completo': nombreCompleto,
            'Precio Base ($)': precioBase,
            'Tarifa IVA (%)': ivaPorc,
            'PVP ($)': pvp,
            'Negocio': (p.pro_negocio || '').toUpperCase(),
            'Tipo': p.pro_tipo || 'PRODUCTO',
            'Estado': p.pro_activo && v.var_activo !== false ? 'Activo' : 'Inactivo',
          });
        });
      }
    });

    return filas;
  }

  const todasLasFilas = procesarFilas();
  const filasTinkay = procesarFilas('tinkay');
  const filasTranqi = procesarFilas('tranqi');

  const wb = XLSX.utils.book_new();

  // Hoja 1: Tinkay Floristería (Ordenada por nombre)
  filasTinkay.sort((a, b) => a.Producto.localeCompare(b.Producto));
  const wsTinkay = XLSX.utils.json_to_sheet(filasTinkay);
  XLSX.utils.book_append_sheet(wb, wsTinkay, 'Tinkay Floristería');

  // Hoja 2: Todos los Productos (Catálogo Ecosistema)
  todasLasFilas.sort((a, b) => a.Negocio.localeCompare(b.Negocio) || a.Producto.localeCompare(b.Producto));
  const wsGeneral = XLSX.utils.json_to_sheet(todasLasFilas);
  XLSX.utils.book_append_sheet(wb, wsGeneral, 'Catálogo General');

  // Hoja 3: Tranqi Legal
  filasTranqi.sort((a, b) => a.Producto.localeCompare(b.Producto));
  const wsTranqi = XLSX.utils.json_to_sheet(filasTranqi);
  XLSX.utils.book_append_sheet(wb, wsTranqi, 'Tranqi Legal');

  // Anchos de columna
  const colWidths = [
    { wch: 22 }, // Código / SKU
    { wch: 38 }, // Producto
    { wch: 32 }, // Presentación / Variante
    { wch: 50 }, // Nombre Completo
    { wch: 16 }, // Precio Base ($)
    { wch: 15 }, // Tarifa IVA (%)
    { wch: 14 }, // PVP ($)
    { wch: 12 }, // Negocio
    { wch: 15 }, // Tipo
    { wch: 12 }, // Estado
  ];

  [wsTinkay, wsGeneral, wsTranqi].forEach((ws) => {
    ws['!cols'] = colWidths;
  });

  const outPath = path.resolve(__dirname, '../lista_productos_ecosistema.xlsx');
  XLSX.writeFile(wb, outPath);

  console.log('EXCEL_GENERADO_CORRECTAMENTE:', outPath);
  console.log(`Total registros generados: Tinkay=${filasTinkay.length}, Tranqi=${filasTranqi.length}, Total=${todasLasFilas.length}`);
}

main().catch((err) => {
  console.error('Error generando archivo Excel:', err);
  process.exit(1);
});

