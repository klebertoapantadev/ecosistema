"use client";

import React from "react";
import { WidgetFacturacionElectronica } from "./WidgetFacturacionElectronica";

interface Props {
  negocio?: string;
  modoVistaForzado?: "cliente" | "operador" | "auto";
}

export function HistorialTransaccionesPago({ negocio = "tranqi", modoVistaForzado = "auto" }: Props) {
  return <WidgetFacturacionElectronica negocio={negocio} modoVistaForzado={modoVistaForzado} />;
}
