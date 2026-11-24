'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  ItemCarrito,
  ProductoEcommerce,
  VarianteEcommerce,
  DedicatoriaArreglo,
  DatosEntrega,
  DatosEventoProforma,
  ModalidadEntrega,
  CategoriaEcommerce,
} from './tipos';
import { PRODUCTOS_TINKAY, CATEGORIAS_TINKAY } from './datos-catalogo';
import { cargarCatalogoDinamicoTinkay } from './servicio-catalogo';
import {
  expandirProductosVitrina,
  obtenerCategoriasVisibles,
  obtenerSlugCategoriaPublico,
  resolverCategoriaPorIdentificador,
  resolverProductoPorIdentificador,
} from './filtrado-catalogo';
import {
  calcularPrecioPorVolumen,
  capturarYPersistirAtribucionNavegador,
  construirEnlaceCategoriaTienda,
  construirEnlaceProductoTienda,
  cotizarEnvioDesdeEntradaAction,
  crearConfiguracionLogisticaPorDefecto,
  crearConfiguracionTiendaCheckoutPorDefecto,
  dispararEventoPixelNavegador,
  interpretarEnlaceTienda,
  obtenerConfiguracionLogisticaAction,
  obtenerConfiguracionTiendaCheckoutAction,
  obtenerEstadoRegaloPrimeraCompraAction,
  registrarMeGustaProductoAction,
  type ConfiguracionLogisticaNegocio,
  type ConfiguracionTiendaCheckout,
  type EstadoRegaloPrimeraCompra,
  type SeleccionPersonalizacionFloral,
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
  configTiendaCheckout: ConfiguracionTiendaCheckout;
  usuarioRegistrado: boolean;
  estadoRegalo: EstadoRegaloPrimeraCompra | null;
  favoritosIds: string[];
  totalFavoritos: number;
  totalMeGustaGlobalCatalogo: number;
  esFavorito: (productoId: string) => boolean;
  obtenerMeGustaProducto: (producto: ProductoEcommerce, varianteSku?: string) => number;
  toggleFavorito: (producto: ProductoEcommerce, varianteSku?: string) => void;

  // Acciones
  setDrawerAbierto: (abierto: boolean) => void;
  setProductoSeleccionadoModal: (producto: ProductoEcommerce | null) => void;
  focoPersonalizacionModal: boolean;
  setFocoPersonalizacionModal: (activo: boolean) => void;
  abrirProductoParaPersonalizar: (producto: ProductoEcommerce, varianteSku?: string) => void;
  setCheckoutAbierto: (abierto: boolean) => void;
  setModalidadEntrega: (modalidad: ModalidadEntrega) => void;
  setOrdenConfirmadaId: (id: string | null) => void;
  setCategoriaActiva: (catId: string) => void;
  setTerminoBusqueda: (termino: string) => void;
  navegarACategoria: (identificador: string) => void;
  abrirProductoPorIdentificador: (identificador: string, varianteSku?: string) => boolean;
  obtenerEnlaceCategoriaActual: (catIdOpcional?: string) => string;
  obtenerEnlaceProducto: (prod: ProductoEcommerce, skuVarianteOpcional?: string) => string;

  agregarItem: (
    producto: ProductoEcommerce,
    variante: VarianteEcommerce,
    dedicatoria?: DedicatoriaArreglo,
    entregaIndividual?: DatosEntrega,
    cantidadInicial?: number,
    abrirDrawer?: boolean,
    personalizacionFloral?: SeleccionPersonalizacionFloral
  ) => void;
  eliminarItem: (itemId: string) => void;
  actualizarCantidad: (itemId: string, cantidad: number) => void;
  actualizarDedicatoria: (itemId: string, dedicatoria: DedicatoriaArreglo) => void;
  actualizarEntregaIndividual: (itemId: string, entrega: DatosEntrega) => void;
  actualizarEntregaUnificada: (datos: Partial<DatosEntrega>) => void;
  vaciarCarrito: () => void;

  // Totales Carrito Directo
  subtotalBaseImponible: number;
  totalIva: number;
  totalFlete: number;
  totalRecargoHorarioExacto: number;
  totalPagar: number;

  // Proforma de Eventos en Autoservicio
  itemsProforma: ItemCarrito[];
  cantidadTotalProforma: number;
  drawerProformaAbierto: boolean;
  datosEventoProforma: DatosEventoProforma;
  ubicacionEventoProforma: DatosEntrega;
  setDrawerProformaAbierto: (abierto: boolean) => void;
  agregarItemProforma: (
    producto: ProductoEcommerce,
    variante: VarianteEcommerce,
    cantidadInicial?: number
  ) => void;
  eliminarItemProforma: (itemId: string) => void;
  actualizarCantidadProforma: (itemId: string, cantidad: number) => void;
  actualizarDatosEventoProforma: (datos: Partial<DatosEventoProforma>) => void;
  actualizarUbicacionEventoProforma: (datos: Partial<DatosEntrega>) => void;
  vaciarProforma: () => void;
  subtotalProforma: number;
  descuentoProforma: number;
  ivaProforma: number;
  fleteProforma: number;
  totalProforma: number;
  reserva70Proforma: number;
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
  franjaHoraria: 'A) 09:00 - 13:00',
  horaExacta: '08:30',
  retiroEnLocal: false,
  dentroCobertura: true,
};

const ContextoCarrito = createContext<ContextoCarritoValor | undefined>(undefined);

const CLAVE_LOCALSTORAGE = 'tinkay_carrito_v1';
const CLAVE_PROFORMA_LOCALSTORAGE = 'tinkay_proforma_evento_v1';
const CLAVE_FAVORITOS_LOCALSTORAGE = 'tinkay_favoritos_v1';
const CLAVE_LIKES_CONTABILIZADOS_LOCALSTORAGE = 'tinkay_likes_contabilizados_v1';

const FECHA_EVENTO_POR_DEFECTO = () => {
  const futura = new Date();
  futura.setDate(futura.getDate() + 14);
  return futura.toISOString().split('T')[0] ?? '';
};

const DATOS_EVENTO_INICIAL: DatosEventoProforma = {
  tipoEvento: 'Boda / Ceremonia',
  fechaEvento: FECHA_EVENTO_POR_DEFECTO(),
  horaEvento: '16:00',
  invitadosEstimados: '',
  paletaColores: '',
  notasEvento: '',
};

export interface ProveedorCarritoProps {
  children: React.ReactNode;
  categoriaInicialUrl?: string;
  productoInicialUrl?: string;
  varianteInicialUrl?: string;
  usuarioRegistradoInicial?: boolean;
  productosIniciales?: ProductoEcommerce[];
  categoriasIniciales?: CategoriaEcommerce[];
}

export function ProveedorCarrito({
  children,
  categoriaInicialUrl,
  productoInicialUrl,
  varianteInicialUrl,
  usuarioRegistradoInicial,
  productosIniciales,
  categoriasIniciales,
}: ProveedorCarritoProps) {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [modalidadEntrega, setModalidadEntrega] = useState<ModalidadEntrega>('unificada');
  const [entregaUnificada, setEntregaUnificada] = useState<DatosEntrega>(ENTREGA_INICIAL);
  const [drawerAbierto, setDrawerAbiertoInterno] = useState(false);
  const [productoSeleccionadoModal, setProductoSeleccionadoModalInterno] =
    useState<ProductoEcommerce | null>(null);
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  const [ordenConfirmadaId, setOrdenConfirmadaId] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const [estadoRegalo, setEstadoRegalo] = useState<EstadoRegaloPrimeraCompra | null>(null);
  const [usuarioRegistrado, setUsuarioRegistrado] = useState<boolean>(
    Boolean(usuarioRegistradoInicial)
  );
  const [estadoCuentaVerificado, setEstadoCuentaVerificado] = useState<boolean>(
    typeof usuarioRegistradoInicial === 'boolean'
  );

  // Estado independiente de Proforma de Evento
  const [itemsProforma, setItemsProforma] = useState<ItemCarrito[]>([]);
  const [drawerProformaAbierto, setDrawerProformaAbiertoInterno] = useState(false);

  const setDrawerAbierto = React.useCallback((abierto: boolean) => {
    setDrawerAbiertoInterno(abierto);
    if (abierto) {
      setDrawerProformaAbiertoInterno(false);
    }
  }, []);

  const setDrawerProformaAbierto = React.useCallback((abierto: boolean) => {
    setDrawerProformaAbiertoInterno(abierto);
    if (abierto) {
      setDrawerAbiertoInterno(false);
      setProductoSeleccionadoModalInterno(null);
      setCheckoutAbierto(false);
    }
  }, []);
  const [datosEventoProforma, setDatosEventoProforma] =
    useState<DatosEventoProforma>(DATOS_EVENTO_INICIAL);
  const [ubicacionEventoProforma, setUbicacionEventoProforma] = useState<DatosEntrega>(() => ({
    ...ENTREGA_INICIAL,
    fechaEntrega: FECHA_EVENTO_POR_DEFECTO(),
  }));

  // Catálogo dinámico sincronizado con Supabase en tiempo real
  const [productos, setProductos] = useState<ProductoEcommerce[]>(() =>
    productosIniciales && productosIniciales.length > 0 ? productosIniciales : PRODUCTOS_TINKAY
  );
  const [categorias, setCategorias] = useState<CategoriaEcommerce[]>(() =>
    categoriasIniciales && categoriasIniciales.length > 0 ? categoriasIniciales : CATEGORIAS_TINKAY
  );
  const [categoriaActiva, setCategoriaActivaInterna] = useState<string>('cat-todos');
  const [focoPersonalizacionModal, setFocoPersonalizacionModal] = useState<boolean>(false);
  const [terminoBusqueda, setTerminoBusqueda] = useState<string>('');
  const [favoritosIds, setFavoritosIds] = useState<string[]>([]);
  const [favoritosCargados, setFavoritosCargados] = useState<boolean>(false);
  const [likesRegistradosIds, setLikesRegistradosIds] = useState<string[]>([]);
  const [configLogistica, setConfigLogistica] = useState<ConfiguracionLogisticaNegocio>(() =>
    crearConfiguracionLogisticaPorDefecto('tinkay')
  );
  const [configTiendaCheckout, setConfigTiendaCheckout] = useState<ConfiguracionTiendaCheckout>(() =>
    crearConfiguracionTiendaCheckoutPorDefecto('tinkay')
  );

  const sincronizarRutaNavegador = React.useCallback((rutaCompletaONuevaUrl: string) => {
    if (typeof window === 'undefined') return;
    try {
      const parsed = new URL(rutaCompletaONuevaUrl, window.location.origin);
      const nuevaRuta = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      const actualRuta = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nuevaRuta !== actualRuta) {
        window.history.replaceState(null, '', nuevaRuta);
      }
    } catch {
      // Ignorar fallos de History API en entornos embebidos
    }
  }, []);

  const obtenerEnlaceCategoriaActual = React.useCallback(
    (catIdOpcional?: string) => {
      const idRef = catIdOpcional ?? categoriaActiva;
      const slugRef = obtenerSlugCategoriaPublico(idRef, categorias);
      return construirEnlaceCategoriaTienda({
        negocio: 'tinkay',
        slugCategoria: slugRef,
      });
    },
    [categoriaActiva, categorias]
  );

  const obtenerEnlaceProducto = React.useCallback(
    (prod: ProductoEcommerce, skuVarianteOpcional?: string) => {
      const idRaiz = prod.id.split('__')[0] || prod.id;
      const prodMaster =
        productos.find(
          (item) =>
            (prod.proIdUuid && item.proIdUuid === prod.proIdUuid) ||
            item.id === idRaiz ||
            item.slug === idRaiz
        ) || prod;
      const skuRef =
        prodMaster.variantes.length > 1
          ? skuVarianteOpcional || prod.varianteInicialSku || prodMaster.variantes[0]?.sku
          : undefined;
      return construirEnlaceProductoTienda({
        negocio: 'tinkay',
        slugProducto: prodMaster.slug || prodMaster.id,
        skuVariante: skuRef,
      });
    },
    [productos]
  );

  const setCategoriaActiva = React.useCallback(
    (catId: string) => {
      setCategoriaActivaInterna(catId);
      if (typeof window !== 'undefined' && !productoSeleccionadoModal) {
        if (!catId || catId === 'cat-todos' || catId === 'todos') {
          sincronizarRutaNavegador('/');
        } else {
          sincronizarRutaNavegador(
            construirEnlaceCategoriaTienda({
              negocio: 'tinkay',
              slugCategoria: obtenerSlugCategoriaPublico(catId, categorias),
            })
          );
        }
      }
    },
    [categorias, productoSeleccionadoModal, sincronizarRutaNavegador]
  );

  const setProductoSeleccionadoModal = React.useCallback(
    (nuevoProd: ProductoEcommerce | null) => {
      if (!nuevoProd) {
        setFocoPersonalizacionModal(false);
      }
      setProductoSeleccionadoModalInterno(nuevoProd);
      if (typeof window === 'undefined') return;
      if (nuevoProd) {
        sincronizarRutaNavegador(obtenerEnlaceProducto(nuevoProd));
      } else {
        if (!categoriaActiva || categoriaActiva === 'cat-todos' || categoriaActiva === 'todos') {
          sincronizarRutaNavegador('/');
        } else {
          sincronizarRutaNavegador(obtenerEnlaceCategoriaActual(categoriaActiva));
        }
      }
    },
    [categoriaActiva, obtenerEnlaceCategoriaActual, obtenerEnlaceProducto, sincronizarRutaNavegador]
  );

  const abrirProductoParaPersonalizar = React.useCallback(
    (prod: ProductoEcommerce, varianteSku?: string) => {
      const prodConVariante: ProductoEcommerce = varianteSku
        ? { ...prod, varianteInicialSku: varianteSku }
        : prod;
      setFocoPersonalizacionModal(true);
      setProductoSeleccionadoModalInterno(prodConVariante);
      if (typeof window !== 'undefined') {
        sincronizarRutaNavegador(obtenerEnlaceProducto(prodConVariante, varianteSku));
      }
    },
    [obtenerEnlaceProducto, sincronizarRutaNavegador]
  );

  const navegarACategoria = React.useCallback(
    (identificador: string) => {
      const desplegados = expandirProductosVitrina(productos);
      const visibles = obtenerCategoriasVisibles(categorias, desplegados);
      const destino = resolverCategoriaPorIdentificador(
        identificador,
        visibles.length > 0 ? visibles : categorias
      );
      setProductoSeleccionadoModalInterno(null);
      setCategoriaActivaInterna(destino);
      setTerminoBusqueda('');

      if (typeof window !== 'undefined') {
        if (!destino || destino === 'cat-todos' || destino === 'todos') {
          sincronizarRutaNavegador('/#catalogo');
        } else {
          sincronizarRutaNavegador(
            construirEnlaceCategoriaTienda({
              negocio: 'tinkay',
              slugCategoria: obtenerSlugCategoriaPublico(destino, categorias),
            })
          );
        }
        const el = document.getElementById('catalogo');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
    [productos, categorias, sincronizarRutaNavegador]
  );

  const abrirProductoPorIdentificador = React.useCallback(
    (identificador: string, varianteSku?: string): boolean => {
      const resuelto = resolverProductoPorIdentificador(identificador, productos, varianteSku);
      if (!resuelto) return false;
      if (resuelto.categoriaPrincipal && resuelto.categoriaPrincipal !== 'cat-detalles') {
        const catRes = resolverCategoriaPorIdentificador(resuelto.categoriaPrincipal, categorias);
        if (catRes && catRes !== 'cat-todos') {
          setCategoriaActivaInterna(catRes);
        }
      }
      setProductoSeleccionadoModalInterno(resuelto);
      sincronizarRutaNavegador(obtenerEnlaceProducto(resuelto, resuelto.varianteInicialSku));
      return true;
    },
    [productos, categorias, obtenerEnlaceProducto, sincronizarRutaNavegador]
  );

  useEffect(() => {
    const resolverDesdeUrlOProps = (
      listaProds: ProductoEcommerce[],
      listaCats: CategoriaEcommerce[],
      hacerScrollCatalogo: boolean
    ) => {
      const destinoUrl =
        typeof window !== 'undefined'
          ? interpretarEnlaceTienda(window.location.href, window.location.origin)
          : { tipo: 'externo' as const };

      const prodObjetivo =
        productoInicialUrl ||
        (destinoUrl.tipo === 'producto' ? destinoUrl.producto : undefined);
      const varObjetivo =
        varianteInicialUrl ||
        (destinoUrl.tipo === 'producto' ? destinoUrl.variante : undefined);
      const catObjetivo =
        categoriaInicialUrl ||
        (destinoUrl.tipo === 'categoria' ? destinoUrl.categoria : undefined);
      const busqObjetivo =
        destinoUrl.tipo === 'busqueda' ? destinoUrl.busqueda : undefined;

      if (busqObjetivo) {
        setTerminoBusqueda(busqObjetivo);
      }

      if (catObjetivo) {
        const catId = resolverCategoriaPorIdentificador(catObjetivo, listaCats);
        setCategoriaActivaInterna(catId);
        if (hacerScrollCatalogo && typeof window !== 'undefined') {
          setTimeout(() => {
            const el = document.getElementById('catalogo');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 180);
        }
      }

      if (prodObjetivo) {
        const prodMatch = resolverProductoPorIdentificador(prodObjetivo, listaProds, varObjetivo);
        if (prodMatch) {
          if (prodMatch.categoriaPrincipal && prodMatch.categoriaPrincipal !== 'cat-detalles') {
            const catDeProd = resolverCategoriaPorIdentificador(
              prodMatch.categoriaPrincipal,
              listaCats
            );
            if (catDeProd && catDeProd !== 'cat-todos') {
              setCategoriaActivaInterna(catDeProd);
            }
          }
          setProductoSeleccionadoModalInterno(prodMatch);
        }
      }
    };

    const baseInicialProds =
      productosIniciales && productosIniciales.length > 0 ? productosIniciales : PRODUCTOS_TINKAY;
    const baseInicialCats =
      categoriasIniciales && categoriasIniciales.length > 0 ? categoriasIniciales : CATEGORIAS_TINKAY;
    resolverDesdeUrlOProps(baseInicialProds, baseInicialCats, false);

    let ultimaSincronizacionMs = 0;
    const refrescarCatalogoEnVivo = (aplicarDeepLink: boolean) => {
      ultimaSincronizacionMs = Date.now();
      cargarCatalogoDinamicoTinkay().then(({ productos: prodsLive, categorias: catsLive }) => {
        const prodsFinales = prodsLive && prodsLive.length > 0 ? prodsLive : baseInicialProds;
        const catsFinales = catsLive && catsLive.length > 0 ? catsLive : baseInicialCats;
        if (prodsLive && prodsLive.length > 0) {
          setProductos(prodsLive);
        }
        if (catsLive && catsLive.length > 0) {
          setCategorias(catsLive);
        }
        if (aplicarDeepLink) {
          resolverDesdeUrlOProps(prodsFinales, catsFinales, true);
        }
      });
    };

    refrescarCatalogoEnVivo(true);

    const alRecuperarFoco = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (Date.now() - ultimaSincronizacionMs < 4000) return;
      refrescarCatalogoEnVivo(false);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', alRecuperarFoco);
      document.addEventListener('visibilitychange', alRecuperarFoco);
    }

    obtenerConfiguracionLogisticaAction('tinkay')
      .then((cfg) => {
        if (cfg) setConfigLogistica(cfg);
      })
      .catch(() => {});

    obtenerConfiguracionTiendaCheckoutAction('tinkay')
      .then((cfgCheckout) => {
        if (cfgCheckout) setConfigTiendaCheckout(cfgCheckout);
      })
      .catch(() => {});

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', alRecuperarFoco);
        document.removeEventListener('visibilitychange', alRecuperarFoco);
      }
    };
  }, [categoriaInicialUrl, productoInicialUrl, varianteInicialUrl]);

  // Verificar estado de cuenta registrada y obsequio de bienvenida
  useEffect(() => {
    let cancelado = false;
    const sincronizarEstadoCuenta = () => {
      obtenerEstadoRegaloPrimeraCompraAction('tinkay')
        .then((res) => {
          if (cancelado) return;
          setEstadoRegalo(res);
          setUsuarioRegistrado(Boolean(res.autenticado));
          setEstadoCuentaVerificado(true);
        })
        .catch(() => {
          if (!cancelado) setEstadoCuentaVerificado(true);
        });
    };
    sincronizarEstadoCuenta();
    if (typeof window !== 'undefined') {
      window.addEventListener('eco:refrescar-notificaciones', sincronizarEstadoCuenta);
    }
    return () => {
      cancelado = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('eco:refrescar-notificaciones', sincronizarEstadoCuenta);
      }
    };
  }, []);

  // Recalcular automáticamente la cotización de envío si cambia el estado de registro (ej. tras registrarse)
  useEffect(() => {
    if (!cargado || !estadoCuentaVerificado) return;
    if (entregaUnificada.retiroEnLocal) return;
    if (typeof entregaUnificada.lat !== 'number' || typeof entregaUnificada.lng !== 'number') {
      return;
    }

    const itemsPrincipales = items.filter((it) => !it.producto.esComplemento && !it.producto.esExtra);
    const listaBase = itemsPrincipales.length > 0 ? itemsPrincipales : items;
    const algunoNoIncluye = listaBase.some(
      (it) =>
        it.producto.deliveryIncluido === false &&
        it.producto.modalidadTransporte !== 'SOLO_RETIRO'
    );
    const recargoEspecialTotal = listaBase.reduce(
      (acc, it) => acc + (it.producto.recargoLogisticoUsd || 0) * it.cantidad,
      0
    );

    let cancelado = false;
    cotizarEnvioDesdeEntradaAction({
      negocio: 'tinkay',
      lat: entregaUnificada.lat,
      lng: entregaUnificada.lng,
      deliveryIncluidoProducto: !algunoNoIncluye,
      recargoLogisticoProducto: recargoEspecialTotal,
      retiroEnLocal: false,
      clienteRegistrado: usuarioRegistrado,
    })
      .then((res) => {
        if (cancelado || !res.ok) return;
        const cot = res.cotizacion;
        setEntregaUnificada((prev) => {
          if (
            prev.costoEnvioCalculado === cot.costoTotalEnvio &&
            prev.reglaLogisticaAplicada === cot.reglaAplicada &&
            prev.etiquetaCotizacion === cot.etiquetaResumen
          ) {
            return prev;
          }
          return {
            ...prev,
            dentroCobertura: cot.dentroCobertura,
            zonaDetectadaNombre: cot.zonaDetectada?.nombre,
            reglaLogisticaAplicada: cot.reglaAplicada,
            distanciaVialKm: cot.distanciaVialKm,
            costoEnvioCalculado: cot.costoTotalEnvio,
            etiquetaCotizacion: cot.etiquetaResumen,
            formulaCalculoInterno: cot.formulaDetalle,
          };
        });
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioRegistrado, cargado, estadoCuentaVerificado]);

  // Cargar estado inicial desde LocalStorage para resiliencia
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_LOCALSTORAGE);
      let tieneItemsGuardados = false;
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (Array.isArray(parsed.items)) {
          setItems(parsed.items);
          tieneItemsGuardados = parsed.items.length > 0;
        }
        if (parsed.modalidadEntrega) setModalidadEntrega(parsed.modalidadEntrega);
        if (parsed.entregaUnificada) setEntregaUnificada(parsed.entregaUnificada);
      }
      const guardadoProforma = localStorage.getItem(CLAVE_PROFORMA_LOCALSTORAGE);
      if (guardadoProforma) {
        const parsedPrf = JSON.parse(guardadoProforma);
        if (Array.isArray(parsedPrf.itemsProforma)) setItemsProforma(parsedPrf.itemsProforma);
        if (parsedPrf.datosEventoProforma) {
          setDatosEventoProforma((prev) => ({ ...prev, ...parsedPrf.datosEventoProforma }));
        }
        if (parsedPrf.ubicacionEventoProforma) {
          setUbicacionEventoProforma((prev) => ({ ...prev, ...parsedPrf.ubicacionEventoProforma }));
        }
      }
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        let cambioUrl = false;
        if (params.get('proforma') === 'abierta') {
          setDrawerProformaAbierto(true);
          params.delete('proforma');
          cambioUrl = true;
        }
        if (params.get('obsequio') === '1') {
          localStorage.setItem('tinkay_obsequio_bienvenida_aceptado', '1');
          params.delete('obsequio');
          cambioUrl = true;
        }
        if (params.get('checkout') === '1' || params.get('checkout') === 'abierto') {
          if (tieneItemsGuardados) {
            setDrawerAbiertoInterno(false);
            setCheckoutAbierto(true);
          }
          params.delete('checkout');
          cambioUrl = true;
        }
        if (cambioUrl) {
          const nuevaQuery = params.toString();
          const limpia = `${window.location.pathname}${nuevaQuery ? `?${nuevaQuery}` : ''}${window.location.hash}`;
          window.history.replaceState(null, '', limpia);
        }
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

  // Persistir borrador de Proforma de Evento en LocalStorage
  useEffect(() => {
    if (!cargado) return;
    try {
      localStorage.setItem(
        CLAVE_PROFORMA_LOCALSTORAGE,
        JSON.stringify({
          itemsProforma,
          datosEventoProforma,
          ubicacionEventoProforma,
        })
      );
    } catch {
      // Fallback silencioso si excede cuota
    }
  }, [itemsProforma, datosEventoProforma, ubicacionEventoProforma, cargado]);

  const recalcularVarianteConVolumen = (
    variante: VarianteEcommerce,
    cantidad: number
  ): VarianteEcommerce => {
    const pvpNominal = variante.pvpNominalSinVolumen ?? variante.pvp;
    if (!variante.escalasVolumen || variante.escalasVolumen.length === 0) {
      return {
        ...variante,
        pvpNominalSinVolumen: pvpNominal,
      };
    }
    const calc = calcularPrecioPorVolumen({
      pvpUnitarioNominal: pvpNominal,
      tarifaIvaPorcentaje: variante.tarifaIva,
      cantidad,
      escalas: variante.escalasVolumen,
    });
    return {
      ...variante,
      pvpNominalSinVolumen: pvpNominal,
      pvp: calc.pvpUnitarioFinal,
      baseImponible: calc.baseImponibleUnitariaFinal,
    };
  };

  const agregarItem = (
    producto: ProductoEcommerce,
    variante: VarianteEcommerce,
    dedicatoria?: DedicatoriaArreglo,
    entregaIndividual?: DatosEntrega,
    cantidadInicial = 1,
    abrirDrawer = true,
    personalizacionFloral?: SeleccionPersonalizacionFloral
  ) => {
    const cantAgregar = Math.max(1, Math.floor(cantidadInicial || 1));

    setItems((prev) => {
      const clavePersNueva = personalizacionFloral?.resumenTexto?.trim() || '';
      // Solo unir cantidades si no hay dedicatoria ni entrega individual y coinciden exactamente en personalización floral
      if (!dedicatoria && !entregaIndividual) {
        const indexExistente = prev.findIndex(
          (i) =>
            i.producto.id === producto.id &&
            i.variante.sku === variante.sku &&
            !i.dedicatoria?.mensaje &&
            (i.personalizacionFloral?.resumenTexto?.trim() || '') === clavePersNueva
        );
        if (indexExistente >= 0) {
          const clon = [...prev];
          const actual = clon[indexExistente];
          if (actual) {
            const nuevaCantidad = actual.cantidad + cantAgregar;
            clon[indexExistente] = {
              ...actual,
              cantidad: nuevaCantidad,
              variante: recalcularVarianteConVolumen(actual.variante, nuevaCantidad),
            };
          }
          return clon;
        }
      }

      // Si tiene dedicatoria, personalización distinta o entrega personalizada, es una línea individual
      const nuevoId = `${producto.id}-${variante.sku}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const nuevoItem: ItemCarrito = {
        id: nuevoId,
        producto,
        variante: recalcularVarianteConVolumen(variante, cantAgregar),
        cantidad: cantAgregar,
        dedicatoria: dedicatoria || {
          para: '',
          de: '',
          mensaje: '',
        },
        personalizacionFloral,
        entregaIndividual: entregaIndividual || { ...ENTREGA_INICIAL },
      };
      return [...prev, nuevoItem];
    });

    // Abrir automáticamente el cajón del carrito salvo cuando el cliente elige Pagar Directo
    if (abrirDrawer) {
      setDrawerAbierto(true);
    }

    if (variante.sku && variante.pvp > 0) {
      dispararEventoPixelNavegador('AddToCart', {
        content_ids: [variante.sku],
        contents: [
          {
            id: variante.sku,
            quantity: cantAgregar,
            item_price: variante.pvp,
            title: producto.nombre,
          },
        ],
        content_name: `${producto.nombre} — ${variante.nombre}`,
        content_category: producto.categoriaNombre || producto.categoriaPrincipal,
        content_type: 'product',
        value: Math.round(variante.pvp * cantAgregar * 100) / 100,
        currency: 'USD',
        num_items: cantAgregar,
      });
    }
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
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              cantidad,
              variante: recalcularVarianteConVolumen(i.variante, cantidad),
            }
          : i
      )
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

  // --- Acciones Proforma de Evento ---
  const agregarItemProforma = (
    producto: ProductoEcommerce,
    variante: VarianteEcommerce,
    cantidadInicial = 1
  ) => {
    const cantAgregar = Math.max(1, Math.floor(cantidadInicial || 1));

    setItemsProforma((prev) => {
      const indexExistente = prev.findIndex(
        (i) => i.producto.id === producto.id && i.variante.sku === variante.sku
      );
      if (indexExistente >= 0) {
        const clon = [...prev];
        const actual = clon[indexExistente];
        if (actual) {
          const nuevaCantidad = actual.cantidad + cantAgregar;
          clon[indexExistente] = {
            ...actual,
            cantidad: nuevaCantidad,
            variante: recalcularVarianteConVolumen(actual.variante, nuevaCantidad),
          };
        }
        return clon;
      }

      const nuevoId = `prf-${producto.id}-${variante.sku}-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 6)}`;
      const nuevoItem: ItemCarrito = {
        id: nuevoId,
        producto,
        variante: recalcularVarianteConVolumen(variante, cantAgregar),
        cantidad: cantAgregar,
      };
      return [...prev, nuevoItem];
    });

    setDrawerAbierto(false);
    setDrawerProformaAbierto(true);
  };

  const eliminarItemProforma = (itemId: string) => {
    setItemsProforma((prev) => prev.filter((i) => i.id !== itemId));
  };

  const actualizarCantidadProforma = (itemId: string, cantidad: number) => {
    if (cantidad <= 0) {
      eliminarItemProforma(itemId);
      return;
    }
    setItemsProforma((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              cantidad,
              variante: recalcularVarianteConVolumen(i.variante, cantidad),
            }
          : i
      )
    );
  };

  const actualizarDatosEventoProforma = (datos: Partial<DatosEventoProforma>) => {
    setDatosEventoProforma((prev) => ({ ...prev, ...datos }));
  };

  const actualizarUbicacionEventoProforma = (datos: Partial<DatosEntrega>) => {
    setUbicacionEventoProforma((prev) => ({ ...prev, ...datos }));
  };

  const vaciarProforma = () => {
    setItemsProforma([]);
  };

  const cantidadTotalProforma = useMemo(() => {
    return itemsProforma.reduce((acc, curr) => acc + curr.cantidad, 0);
  }, [itemsProforma]);

  const {
    subtotalProforma,
    descuentoProforma,
    ivaProforma,
    fleteProforma,
    totalProforma,
    reserva70Proforma,
  } = useMemo(() => {
    let subtotalBase = 0;
    let iva = 0;
    let ahorroVolumen = 0;

    itemsProforma.forEach((item) => {
      const baseItem = item.variante.baseImponible * item.cantidad;
      const ivaItem = (item.variante.pvp - item.variante.baseImponible) * item.cantidad;
      const nominalUnit = item.variante.pvpNominalSinVolumen ?? item.variante.pvp;
      const ahorroItem = Math.max(0, (nominalUnit - item.variante.pvp) * item.cantidad);
      subtotalBase += baseItem;
      iva += ivaItem;
      ahorroVolumen += ahorroItem;
    });

    let flete = 0;
    if (itemsProforma.length > 0) {
      const algunoNoIncluye = itemsProforma.some(
        (it) =>
          it.producto.deliveryIncluido === false &&
          it.producto.modalidadTransporte !== 'SOLO_RETIRO'
      );
      const recargoEspecialTotal = itemsProforma.reduce(
        (acc, it) => acc + (it.producto.recargoLogisticoUsd || 0) * it.cantidad,
        0
      );

      if (ubicacionEventoProforma.retiroEnLocal) {
        flete = 0;
      } else if (typeof ubicacionEventoProforma.costoEnvioCalculado === 'number') {
        flete = ubicacionEventoProforma.costoEnvioCalculado;
      } else {
        flete =
          (algunoNoIncluye ? configLogistica.tarifaBaseNoIncluido : 0) + recargoEspecialTotal;
      }
    }

    const total = Math.round((subtotalBase + iva + flete) * 100) / 100;
    return {
      subtotalProforma: Math.round(subtotalBase * 100) / 100,
      descuentoProforma: Math.round(ahorroVolumen * 100) / 100,
      ivaProforma: Math.round(iva * 100) / 100,
      fleteProforma: Math.round(flete * 100) / 100,
      totalProforma: total,
      reserva70Proforma: Math.round(total * 0.7 * 100) / 100,
    };
  }, [itemsProforma, ubicacionEventoProforma, configLogistica]);

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
        } else if (!usuarioRegistrado && configLogistica.envioGratisSoloRegistrados !== false) {
          const baseInvitado = configLogistica.tarifaBaseNoRegistradoUsd ?? 1.0;
          flete =
            Math.max(baseInvitado, algunoNoIncluye ? configLogistica.tarifaBaseNoIncluido : 0) +
            recargoEspecialTotal;
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
  }, [items, modalidadEntrega, entregaUnificada, configLogistica, usuarioRegistrado]);

  useEffect(() => {
    if (!cargado) return;
    const catObj = categorias.find((c) => c.id === categoriaActiva || c.slug === categoriaActiva);
    capturarYPersistirAtribucionNavegador('tinkay', {
      categoriaActiva: catObj?.slug || catObj?.nombre || categoriaActiva,
    });
  }, [categoriaActiva, categorias, cargado]);

  useEffect(() => {
    if (!checkoutAbierto || items.length === 0) return;
    const skus = items.map((it) => it.variante.sku).filter(Boolean);
    dispararEventoPixelNavegador('InitiateCheckout', {
      content_ids: skus,
      contents: items.map((it) => ({
        id: it.variante.sku,
        quantity: it.cantidad,
        item_price: it.variante.pvp,
        title: it.producto.nombre,
      })),
      content_type: 'product',
      value: totalPagar,
      currency: 'USD',
      num_items: cantidadTotal,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutAbierto]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const guardado = window.localStorage.getItem(CLAVE_FAVORITOS_LOCALSTORAGE);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (Array.isArray(parsed)) {
          setFavoritosIds(
            Array.from(
              new Set(
                parsed
                  .map((v) => String(v ?? '').trim())
                  .filter((v) => v.length > 0)
              )
            )
          );
        }
      }
      const contabilizados = window.localStorage.getItem(CLAVE_LIKES_CONTABILIZADOS_LOCALSTORAGE);
      if (contabilizados) {
        const parsedCont = JSON.parse(contabilizados);
        if (Array.isArray(parsedCont)) {
          setLikesRegistradosIds(
            Array.from(
              new Set(
                parsedCont
                  .map((v) => String(v ?? '').trim())
                  .filter((v) => v.length > 0)
              )
            )
          );
        }
      }
    } catch {
      // Ignorar errores de almacenamiento local
    } finally {
      setFavoritosCargados(true);
    }
  }, []);

  useEffect(() => {
    if (!favoritosCargados || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CLAVE_FAVORITOS_LOCALSTORAGE, JSON.stringify(favoritosIds));
    } catch {
      // Ignorar errores de cuota de almacenamiento local
    }
  }, [favoritosIds, favoritosCargados]);

  useEffect(() => {
    if (!favoritosCargados || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        CLAVE_LIKES_CONTABILIZADOS_LOCALSTORAGE,
        JSON.stringify(likesRegistradosIds)
      );
    } catch {
      // Ignorar errores de cuota de almacenamiento local
    }
  }, [likesRegistradosIds, favoritosCargados]);

  const esFavorito = React.useCallback(
    (productoId: string) => favoritosIds.includes(productoId),
    [favoritosIds]
  );

  const obtenerMeGustaProducto = React.useCallback(
    (producto: ProductoEcommerce, varianteSku?: string): number => {
      const idRaiz = producto.id.split('__')[0] || producto.id;
      const skuObjetivo = (varianteSku || producto.varianteInicialSku || '').trim();
      const master = productos.find(
        (item) =>
          (producto.proIdUuid && item.proIdUuid === producto.proIdUuid) ||
          item.id === idRaiz ||
          item.slug === idRaiz
      );
      if (!master) {
        return Math.max(0, Number(producto.totalMeGusta ?? 0) || 0);
      }
      if (master.variantes.length > 1 && skuObjetivo) {
        const varMatch = master.variantes.find(
          (v) => v.sku.toLowerCase() === skuObjetivo.toLowerCase()
        );
        const sumaVarLikes = master.variantes.reduce(
          (acc, v) => acc + Math.max(0, Number(v.totalMeGusta ?? 0) || 0),
          0
        );
        if (varMatch && sumaVarLikes > 0) {
          return Math.max(0, Number(varMatch.totalMeGusta ?? 0) || 0);
        }
      }
      const unicoVarLikes =
        master.variantes.length === 1
          ? Math.max(0, Number(master.variantes[0]?.totalMeGusta ?? 0) || 0)
          : 0;
      return Math.max(0, Number(master.totalMeGusta ?? 0) || 0, unicoVarLikes);
    },
    [productos]
  );

  const aplicarLikesAProductos = React.useCallback(
    (
      producto: ProductoEcommerce,
      skuObjetivo: string | undefined,
      datos?: { proTotal?: number; varTotal?: number | null; delta?: number }
    ) => {
      const idRaiz = producto.id.split('__')[0] || producto.id;
      const skuLower = (skuObjetivo || '').trim().toLowerCase();
      setProductos((prev) =>
        prev.map((item) => {
          const coincide =
            (producto.proIdUuid && item.proIdUuid === producto.proIdUuid) ||
            item.id === idRaiz ||
            item.slug === idRaiz;
          if (!coincide) return item;

          const nuevoTotalProd =
            typeof datos?.proTotal === 'number'
              ? Math.max(Number(item.totalMeGusta ?? 0) || 0, datos.proTotal)
              : Math.max(0, (Number(item.totalMeGusta ?? 0) || 0) + (datos?.delta ?? 0));

          const nuevasVariantes = item.variantes.map((v) => {
            if (!skuLower || v.sku.toLowerCase() !== skuLower) return v;
            const nuevoTotalVar =
              typeof datos?.varTotal === 'number'
                ? Math.max(Number(v.totalMeGusta ?? 0) || 0, datos.varTotal)
                : Math.max(0, (Number(v.totalMeGusta ?? 0) || 0) + (datos?.delta ?? 0));
            return { ...v, totalMeGusta: nuevoTotalVar };
          });

          return {
            ...item,
            totalMeGusta: nuevoTotalProd,
            variantes: nuevasVariantes,
          };
        })
      );
    },
    []
  );

  const toggleFavorito = React.useCallback(
    (producto: ProductoEcommerce, varianteSku?: string) => {
      const idLimpio = (producto?.id || '').trim();
      if (!idLimpio) return;

      const yaEsFavorito = favoritosIds.includes(idLimpio);

      // 1. Lista personal del cliente (permite agregar y quitar libremente)
      setFavoritosIds((prev) =>
        prev.includes(idLimpio) ? prev.filter((id) => id !== idLimpio) : [...prev, idLimpio]
      );

      // 2. Contador global persistente: incrementa +1 cada vez que el cliente pulsa Me gusta
      //    (incluso si antes lo quitó y vuelve a presionarlo) y NUNCA decrementa al quitarlo.
      if (!yaEsFavorito) {
        const idRaiz = idLimpio.split('__')[0] || producto.slug || idLimpio;
        const skuObjetivo =
          (varianteSku || producto.varianteInicialSku || producto.variantes?.[0]?.sku || '').trim() ||
          undefined;

        setLikesRegistradosIds((prev) => (prev.includes(idLimpio) ? prev : [...prev, idLimpio]));
        aplicarLikesAProductos(producto, skuObjetivo, { delta: 1 });

        registrarMeGustaProductoAction({
          negocio: 'tinkay',
          productoId: producto.proIdUuid,
          productoSlug: idRaiz,
          varianteSku: skuObjetivo,
        })
          .then((res) => {
            if (res.ok) {
              aplicarLikesAProductos(producto, skuObjetivo, {
                proTotal: res.pro_total_me_gusta,
                varTotal: res.var_total_me_gusta,
              });
            } else {
              console.warn('No se pudo persistir Me gusta en Supabase:', res.error);
            }
          })
          .catch((err) => {
            console.warn('Error al registrar Me gusta en Supabase:', err);
          });
      }
    },
    [favoritosIds, aplicarLikesAProductos]
  );

  const totalFavoritos = useMemo(() => {
    if (favoritosIds.length === 0) return 0;
    const desplegados = expandirProductosVitrina(
      productos && productos.length > 0 ? productos : PRODUCTOS_TINKAY
    );
    const idsCatalogo = new Set(desplegados.map((p) => p.id));
    return favoritosIds.filter((id) => idsCatalogo.has(id)).length;
  }, [favoritosIds, productos]);

  const totalMeGustaGlobalCatalogo = useMemo(() => {
    return (productos || []).reduce((acc, p) => {
      if (p.esExtra || p.esComplemento) return acc;
      const likesProd = Math.max(0, Number(p.totalMeGusta ?? 0) || 0);
      const sumaVars = (p.variantes || []).reduce(
        (s, v) => s + Math.max(0, Number(v.totalMeGusta ?? 0) || 0),
        0
      );
      return acc + Math.max(likesProd, sumaVars);
    }, 0);
  }, [productos]);

  // Si el usuario estaba en la vista personal "Me gusta" y quita el último corazón, volver a catálogo
  useEffect(() => {
    if (favoritosCargados && categoriaActiva === 'grupo-favoritos' && totalFavoritos === 0) {
      setCategoriaActiva('cat-todos');
    }
  }, [favoritosCargados, categoriaActiva, totalFavoritos, setCategoriaActiva]);

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
        configTiendaCheckout,
        usuarioRegistrado,
        estadoRegalo,
        favoritosIds,
        totalFavoritos,
        totalMeGustaGlobalCatalogo,
        esFavorito,
        obtenerMeGustaProducto,
        toggleFavorito,
        setDrawerAbierto,
        setProductoSeleccionadoModal,
        focoPersonalizacionModal,
        setFocoPersonalizacionModal,
        abrirProductoParaPersonalizar,
        setCheckoutAbierto,
        setModalidadEntrega,
        setOrdenConfirmadaId,
        setCategoriaActiva,
        setTerminoBusqueda,
        navegarACategoria,
        abrirProductoPorIdentificador,
        obtenerEnlaceCategoriaActual,
        obtenerEnlaceProducto,
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
        itemsProforma,
        cantidadTotalProforma,
        drawerProformaAbierto,
        datosEventoProforma,
        ubicacionEventoProforma,
        setDrawerProformaAbierto,
        agregarItemProforma,
        eliminarItemProforma,
        actualizarCantidadProforma,
        actualizarDatosEventoProforma,
        actualizarUbicacionEventoProforma,
        vaciarProforma,
        subtotalProforma,
        descuentoProforma,
        ivaProforma,
        fleteProforma,
        totalProforma,
        reserva70Proforma,
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
