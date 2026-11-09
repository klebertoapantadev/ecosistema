"use client";

import React from "react";
import { WidgetFacturacionElectronica } from "./WidgetFacturacionElectronica";

interface Props {
  negocio?: string;
}

export function HistorialTransaccionesPago({ negocio = "tranqi" }: Props) {
  return <WidgetFacturacionElectronica negocio={negocio} />;
}
