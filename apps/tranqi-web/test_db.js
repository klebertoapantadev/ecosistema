const { createClient } = require('@supabase/supabase-js');

console.log('--- Env Variables containing SUPABASE ---');
Object.keys(process.env).forEach(key => {
  if (key.includes('SUPABASE')) {
    console.log(`${key}: ${process.env[key] ? process.env[key].substring(0, 10) + '...' : 'undefined'}`);
  }
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Final URL:', url);
console.log('Final Key (masked):', key ? `${key.substring(0, 10)}...` : 'undefined');

if (!url || !key) {
  console.error('Faltan variables de entorno.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  console.log('\n--- Probando consulta trq_solicitud_socio ---');
  const { data, error } = await supabase
    .schema('tranqui_legal')
    .from('trq_solicitud_socio')
    .select('*');

  if (error) {
    console.error('Error al consultar:', error);
  } else {
    console.log('Resultados obtenidos (cantidad):', data ? data.length : 0);
    console.log('Primeros resultados:', JSON.stringify(data ? data.slice(0, 2) : [], null, 2));
  }
}

test();
