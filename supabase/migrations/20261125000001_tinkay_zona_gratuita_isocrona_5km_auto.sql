-- ============================================================================
-- Actualización de Zona de Cobertura Gratuita de Tinkay a isodistancia vial
-- real de hasta 5 km en auto alrededor del Taller Tinkay (-0.1648075, -78.466175),
-- calculada sobre red de calles OSRM y excluyendo áreas sin calles en auto
-- (como el interior boscoso del Parque Metropolitano Guangüiltagua).
-- ============================================================================

update comun_comercio.com_zona_cobertura
set
  zon_poligono = '[
    [-0.166819,-78.466268],
    [-0.191362,-78.47095],
    [-0.190686,-78.473125],
    [-0.194184,-78.477217],
    [-0.197785,-78.485064],
    [-0.19805,-78.489426],
    [-0.193999,-78.490561],
    [-0.191817,-78.493242],
    [-0.186427,-78.492322],
    [-0.176321,-78.497958],
    [-0.170663,-78.499425],
    [-0.167382,-78.49768],
    [-0.161865,-78.501731],
    [-0.158596,-78.501649],
    [-0.156676,-78.49665],
    [-0.153243,-78.497772],
    [-0.150555,-78.49674],
    [-0.14908,-78.493493],
    [-0.143153,-78.492127],
    [-0.147317,-78.483685],
    [-0.142838,-78.484849],
    [-0.142709,-78.481659],
    [-0.137578,-78.481704],
    [-0.137323,-78.476176],
    [-0.132288,-78.475027],
    [-0.129391,-78.472472],
    [-0.128939,-78.469125],
    [-0.131082,-78.466172],
    [-0.131267,-78.46316],
    [-0.136775,-78.458617],
    [-0.135548,-78.455282],
    [-0.143427,-78.453774],
    [-0.142952,-78.450738],
    [-0.144137,-78.44886],
    [-0.141227,-78.442187],
    [-0.146404,-78.443866],
    [-0.147763,-78.442147],
    [-0.157237,-78.452984],
    [-0.156477,-78.443036],
    [-0.161367,-78.446315],
    [-0.162951,-78.445799],
    [-0.168299,-78.453407],
    [-0.170261,-78.449878],
    [-0.167677,-78.460743],
    [-0.168524,-78.462514],
    [-0.168692,-78.463924]
  ]'::jsonb,
  zon_detalle_zona = coalesce(zon_detalle_zona, '{}'::jsonb) || jsonb_build_object(
    'color', '#16A34A',
    'criterio_cobertura', 'ISODISTANCIA_VIAL_5KM_AUTO',
    'sectores_referencia', jsonb_build_array(
      'El Batán / Monteserrín',
      'La Carolina / Iñaquito',
      'Quicentro / Shirys',
      'El Inca / Jipijapa',
      'González Suárez',
      'El Bosque / Granda Centeno',
      'Kennedy / Bicentenario',
      'Granados / Zámbiza'
    )
  ),
  zon_actualizado_en = now()
where zon_negocio = 'tinkay'
  and zon_codigo = 'centro_norte_quito'
  and zon_eliminado_en is null;
