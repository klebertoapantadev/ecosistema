'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  ItemCarrito,
  ProductoEcommerce,
  VarianteEcommerce,
  DedicatoriaArreglo,
  DatosEntrega,
  ModalidadEntrega,
  CategoriaEcommerce,
} from './tipos';
import { PRODUCTOS_TINKAY, CATEGORIAS_TINKAY } from './datos-catalogo';
import { cargarCatalogoDinamicoTinkay } from './servicio-catalogo';
import {
  expandirProductosVitrina,
  obtenerCategoriasVisibles,
  resolverCategoriaPorIdentificador,
} from './filtrado-catalogo';
import {
  crearConfiguracionLogisticaPorDefecto,
  obtenerConfiguracionLogisticaAction,
  type ConfiguracionLogisticaNegocio,
} from '@eco/comercio';

interface ContextoCarritoValor {
  items: ItemCarrito[];
  cantidadTotal: number;
  modalidadEntrega: ModalidadEntrega;
  entregaUnificada: DatosEntrega;
  drawerAbierto: boolean;
  productoSeleccionadoModal: ProductoEcommerce | null;
  checkoutAbierto: boolean;
  ordenConfirmadaId: string | null;
  productos: ProductoEcommerce[];
  categorias: CategoriaEcommerce[];
  categoriaActiva: string;
  terminoBusqueda: string;
  configLogistica: ConfiguracionLogisticaNegocio;

  // Acciones
  setDrawerAbierto: (abierto: boolean) => void;
  setProductoSeleccionadoModal: (producto: ProductoEcommerce | null) => void;
  setCheckoutAbierto: (abierto: boolean) => void;
  setModalidadEntrega: (modalidad: ModalidadEntrega) => void;
  setOrdenConfirmadaId: (id: string | null) => void;
  setCategoriaActiva: (catId: string) => void;
  setTerminoBusqueda: (termino: string) => void;
  navegarACategoria: (identificador: string) => void;

  agregarItem: (
    producto: ProductoEcommerce,
    variante: VarianteEcommerce,
    dedicatoria?: DedicatoriaArreglo,
    entregaIndividual?: DatosEntrega
  ) => void;
  eliminarItem: (itemId: string) => void;
  actualizarCantidad: (itemId: string, cantidad: number) => void;
  actualizarDedicatoria: (itemId: string, dedicatoria: DedicatoriaArreglo) => void;
  actualizarEntregaIndividual: (itemId: string, entrega: DatosEntrega) => void;
  actualizarEntregaUnificada: (datos: Partial<DatosEntrega>) => void;
  vaciarCarrito: () => void;

  // Totales
  subtotalBaseImponible: number;
  totalIva: number;
  totalFlete: number;
  totalRecargoHorarioExacto: number;
  totalPagar: number;
}

const FECHA_POR_DEFECTO = () => {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  return manana.toISOString().split('T')[0] ?? '';
};

const ENTREGA_INICIAL: DatosEntrega = {
  destinatarioNombre: '',
  destinatarioTelefono: '',
  direccion: '',
  referencia: '',
  ciudad: 'Centro-Norte de Quito',
  fechaEntrega: FECHA_POR_DEFECTO(),
  franjaHoraria: 'manana',
  horaExacta: '08:30',
  retiroEnLocal: false,
  dentroCobertura: true,
};

const ContextoCarrito = createContext<ContextoCarritoValor | undefined>(undefined);

const CLAVE_LOCALSTORAGE = 'tinkay_carrito_v1';

export function ProveedorCarrito({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [modalidadEntrega, setModalidadEntrega] = useState<ModalidadEntrega>('unificada');
  const [entregaUnificada, setEntregaUnificada] = useState<DatosEntrega>(ENTREGA_INICIAL);
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [productoSeleccionadoModal, setProductoSeleccionadoModal] = useState<ProductoEcommerce | null>(null);
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  const [ordenConfirmadaId, setOrdenConfirmadaId] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  // Catálogo dinámico sincronizado con Supabase en tiempo real
  const [productos, setProductos] = useState<ProductoEcommerce[]>(PRODUCTOS_TINKAY);
  const [categorias, setCategorias] = useState<CategoriaEcommerce[]>(CATEGORIAS_TINKAY);
  const [categoriaActiva, setCategoriaActiva] = useState<string>('cat-todos');
  const [terminoBusqueda, setTerminoBusqueda] = useState<string>('');
  const [configLogistica, setConfigLogistica] = useState<ConfiguracionLogisticaNegocio>(() =>
    crearConfiguracionLogisticaPorDefecto('tinkay')
  );

  const navegarACategoria = React.useCallback(
    (identificador: string) => {
      const desplegados = expandirProductosVitrina(productos);
      const visibles = obtenerCategoriasVisibles(categorias, desplegados);
      const destino = resolverCategoriaPorIdentificador(
        identificador,
        visibles.length > 0 ? visibles : categorias
      );
      setCategoriaActiva(destino);
      setTerminoBusqueda('');

      if (typeof window !== 'undefined') {
        const el = document.getElementById('catalogo');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
    [productos, categorias]
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qInicial = params.get('q') || params.get('busqueda');
      const catInicial = params.get('categoria');
      if (qInicial) setTerminoBusqueda(qInicial);
      if (catInicial) {
        setCategoriaActiva(resolverCategoriaPorIdentificador(catInicial, CATEGORIAS_TINKAY));
      }
    }

    cargarCatalogoDinamicoTinkay().then(({ productos: prodsLive, categorias: catsLive }) => {
      if (prodsLive && prodsLive.length > 0) {
        setProductos(prodsLive);
      }
      if (catsLive && catsLive.length > 0) {
        setCategorias(catsLive);
        if (typeof window !== 'undefined') {
          const catParam = new URLSearchParams(window.location.search).get('categoria');
          if (catParam) {
            setCategoriaActiva(resolverCategoriaPorIdentificador(catParam, catsLive));
          }
        }
      }
    });

    obtenerConfiguracionLogisticaAction('tinkay')
      .then((cfg) => {
        if (cfg) setConfigLogistica(cfg);
      })
      .catch(() => {});
  }, []);

  // Cargar estado inicial desde LocalStorage para resiliencia
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_LOCALSTORAGE);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (Array.isArray(parsed.items)) setItems(parsed.items);
        if (parsed.modalidadEntrega) setModalidadEntrega(parsed.modalidadEntrega);
        if (parsed.entregaUnificada) setEntregaUnificada(parsed.entregaUnificada);
      }
    } catch {
      // Ignorar errores de parsing inicial
    } finally {
      setCargado(true);
    }
  }, []);

  // Persistir en LocalStorage
  useEffect(() => {
    if (!cargado) return;
    try {
      localStorage.setItem(
        CLAVE_LOCALSTORAGE,
        JSON.stringify({
          items,
          modalidadEntrega,
          entregaUnificada,
        })
      );
    } catch {
      // Fallback silencioso si excede cuota
    }
  }, [items, modalidadEntrega, entregaUnificada, cargado]);

  const agregarItem = (
    producto: ProductoEcommerce,
    variante: VarianteEcommerce,
    dedicatoria?: DedicatoriaArreglo,
    entregaIndividual?: DatosEntrega
  ) => {
    setItems((prev) => {
      // Si el producto no tiene dedicatoria específica y ya existe la misma variante, podemos sumar cantidad
      if (!dedicatoria && !entregaIndividual) {
        const indexExistente = prev.findIndex(
          (i) => i.producto.id === producto.id && i.variante.sku === variante.sku && !i.dedicatoria
        );
        if (indexExistente >= 0) {
          const clon = [...prev];
          const actual = clon[indexExistente];
          if (actual) {
            clon[indexExistente] = {
              ...actual,
              cantidad: actual.cantidad + 1,
            };
          }
          return clon;
        }
      }

      // Si tiene dedicatoria o entrega personalizada, es una línea individual
      const nuevoId = `${producto.id}-${variante.sku}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const nuevoItem: ItemCarrito = {
        id: nuevoId,
        producto,
        variante,
        cantidad: 1,
        dedicatoria: dedicatoria || {
          para: '',
          de: '',
          mensaje: '',
        },
        entregaIndividual: entregaIndividual || { ...ENTREGA_INICIAL },
      };
      return [...prev, nuevoItem];
    });

    // Abrir automáticamente el cajón del carrito para feedback inmediato
    setDrawerAbierto(true);
  };

  const eliminarItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const actualizarCantidad = (itemId: string, cantidad: number) => {
    if (cantidad <= 0) {
      eliminarItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, cantidad } : i))
    );
  };

  const actualizarDedicatoria = (itemId: string, dedicatoria: DedicatoriaArreglo) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, dedicatoria } : i))
    );
  };

  const actualizarEntregaIndividual = (itemId: string, entrega: DatosEntrega) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, entregaIndividual: entrega } : i))
    );
  };

  const actualizarEntregaUnificada = (datos: Partial<DatosEntrega>) => {
    setEntregaUnificada((prev) => ({ ...prev, ...datos }));
  };

  const vaciarCarrito = () => {
    setItems([]);
  };

  const cantidadTotal = useMemo(() => {
    return items.reduce((acc, curr) => acc + curr.cantidad, 0);
  }, [items]);

  // Cálculos financieros conformes con normativa SRI ecuatoriana (IVA 15%)
  const { subtotalBaseImponible, totalIva, totalFlete, totalRecargoHorarioExacto, totalPagar } = useMemo(() => {
    let subtotalBase = 0;
    let iva = 0;

    items.forEach((item) => {
      const baseItem = item.variante.baseImponible * item.cantidad;
      const ivaItem = (item.variante.pvp - item.variante.baseImponible) * item.cantidad;
      subtotalBase += baseItem;
      iva += ivaItem;
    });

    // Flete y logística dinámica según zona / distancia vial / retiro en tienda
    let flete = 0;
    let recargoHora = 0;
    const tarifaHoraExacta = configLogistica.recargoHoraExacta ?? 10;

    if (items.length > 0) {
      const itemsPrincipales = items.filter((it) => !it.producto.esComplemento && !it.producto.esExtra);
      const listaBase = itemsPrincipales.length > 0 ? itemsPrincipales : items;
      const algunoNoIncluye = listaBase.some(
        (it) => it.producto.deliveryIncluido === false && it.producto.modalidadTransporte !== 'SOLO_RETIRO'
      );
      const recargoEspecialTotal = listaBase.reduce(
        (acc, it) => acc + (it.producto.recargoLogisticoUsd || 0) * it.cantidad,
        0
      );

      if (modalidadEntrega === 'unificada') {
        if (entregaUnificada.retiroEnLocal) {
          flete = 0;
        } else if (typeof entregaUnificada.costoEnvioCalculado === 'number') {
          flete = entregaUnificada.costoEnvioCalculado;
        } else {
          flete =
            (algunoNoIncluye ? configLogistica.tarifaBaseNoIncluido : 0) + recargoEspecialTotal;
        }

        if (!entregaUnificada.retiroEnLocal && entregaUnificada.franjaHoraria === 'hora_exacta') {
          recargoHora = tarifaHoraExacta;
        }
      } else {
        listaBase.forEach((it) => {
          const ent = it.entregaIndividual;
          if (ent?.retiroEnLocal) {
            flete += 0;
          } else if (typeof ent?.costoEnvioCalculado === 'number') {
            flete += ent.costoEnvioCalculado;
          } else {
            flete +=
              (it.producto.deliveryIncluido === false ? configLogistica.tarifaBaseNoIncluido : 0) +
              (it.producto.recargoLogisticoUsd || 0) * it.cantidad;
          }

          if (!ent?.retiroEnLocal && ent?.franjaHoraria === 'hora_exacta') {
            recargoHora += tarifaHoraExacta;
          }
        });
      }
    }

    const total = subtotalBase + iva + flete + recargoHora;

    return {
      subtotalBaseImponible: Math.round(subtotalBase * 100) / 100,
      totalIva: Math.round(iva * 100) / 100,
      totalFlete: Math.round(flete * 100) / 100,
      totalRecargoHorarioExacto: Math.round(recargoHora * 100) / 100,
      totalPagar: Math.round(total * 100) / 100,
    };
  }, [items, modalidadEntrega, entregaUnificada, configLogistica]);

  return (
    <ContextoCarrito.Provider
      value={{
        items,
        cantidadTotal,
        modalidadEntrega,
        entregaUnificada,
        drawerAbierto,
        productoSeleccionadoModal,
        checkoutAbierto,
        ordenConfirmadaId,
        productos,
        categorias,
        categoriaActiva,
        terminoBusqueda,
        configLogistica,
        setDrawerAbierto,
        setProductoSeleccionadoModal,
        setCheckoutAbierto,
        setModalidadEntrega,
        setOrdenConfirmadaId,
        setCategoriaActiva,
        setTerminoBusqueda,
        navegarACategoria,
        agregarItem,
        eliminarItem,
        actualizarCantidad,
        actualizarDedicatoria,
        actualizarEntregaIndividual,
        actualizarEntregaUnificada,
        vaciarCarrito,
        subtotalBaseImponible,
        totalIva,
        totalFlete,
        totalRecargoHorarioExacto,
        totalPagar,
      }}
    >
      {children}
    </ContextoCarrito.Provider>
  );
}

export function useCarrito() {
  const contexto = useContext(ContextoCarrito);
  if (!contexto) {
    throw new Error('useCarrito debe usarse dentro de un ProveedorCarrito');
  }
  return contexto;
}
