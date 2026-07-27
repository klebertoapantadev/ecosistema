// Lista curada, no las ~240 que trae libphonenumber-js -- Ecuador primero
// porque es el mercado del ecosistema (PLT-007), el resto son los paises
// de la region mas probables para un contacto. La VALIDACION real de
// digitos por pais la hace libphonenumber-js (ver esquema.ts), esta lista
// solo alimenta el <select>.
export interface PaisTelefono {
  codigo: string; // ISO 3166-1 alpha-2, lo que espera libphonenumber-js
  nombre: string;
  prefijo: string; // solo para mostrar en el select
}

export const PAISES_TELEFONO: PaisTelefono[] = [
  { codigo: "EC", nombre: "Ecuador", prefijo: "+593" },
  { codigo: "CO", nombre: "Colombia", prefijo: "+57" },
  { codigo: "PE", nombre: "Perú", prefijo: "+51" },
  { codigo: "MX", nombre: "México", prefijo: "+52" },
  { codigo: "AR", nombre: "Argentina", prefijo: "+54" },
  { codigo: "CL", nombre: "Chile", prefijo: "+56" },
  { codigo: "US", nombre: "Estados Unidos", prefijo: "+1" },
  { codigo: "ES", nombre: "España", prefijo: "+34" },
];

export const PAIS_TELEFONO_DEFECTO = "EC";
