# Módulo: socios (Red y Acreditación de Socios Abogados)

Implementa **TRQ-ABG-001** (Onboarding y Acreditación de Socios Abogados), **TRQ-ABG-003** (Firma Electrónica Avanzada PAdES Zero-Custody) y **TRQ-ADM-001** (Mesa de Control y Contra-Firma Tranqi) — ver:
- [`gobernanza/productos/tranqi/especificacion-funcional.md`](../../../../gobernanza/productos/tranqi/especificacion-funcional.md)
- [`gobernanza/productos/tranqi/especificacion-tecnica.md`](../../../../gobernanza/productos/tranqi/especificacion-tecnica.md)

**Propio de Tranqi, no compartido.** A diferencia de identidad/configuración-negocio/gestión-usuarios (PLT-xxx, en `packages/*`), la red de abogados y su proceso de colegiatura y contratación bilateral es exclusivo de este negocio — reside en `apps/tranqi-web/modulos/socios/`.

---

## 1. Diagrama de Flujo y Ciclo de Vida (3 Fases de Acreditación)

```mermaid
graph TD
    subgraph Fase1["Fase 1: Postulación y Validación de Credenciales"]
        A["1. Postulante llena formulario y sube títulos"] --> B["2. Estado: Pendiente de Aprobación"]
        B --> C["3. Operador verifica SENESCYT y Foro de Abogados"]
        C -->|"Emite Decisión: Aceptada (Paso 1)"| D["4. Credenciales Validadas"]
        C -->|"Emite Observaciones"| R["Rechazada / Requiere Corrección"]
        D --> N1["Notificación 1: Credenciales Validadas (Firma Requerida)"]
    end

    subgraph Fase2["Fase 2: Firma del Contrato de Sociedad"]
        N1 --> E{"Opciones de Firma del Abogado"}
        E -->|"Opción A (Recomendada)"| F["Firma Digital en Pantalla con .p12 (Zero-Custody)"]
        E -->|"Opción B"| G["Firma Manual / Escaneo Físico (PDF)"]
        E -->|"Opción C"| H["Propuesta de Modificación al Contrato (Word)"]
        H -->|"Operador responde/ajusta"| D
        F --> I["Contrato Firmado por Abogado Cargado"]
        G --> I
        I --> N2["Notificación Staff: Contrato Firmado Recibido"]
    end

    subgraph Fase3["Fase 3: Verificación, Contra-Firma Tranqi y Activación"]
        N2 --> J["5. Operador revisa contrato firmado"]
        J --> K["6. Contra-Firma Digital Tranqi con .p12 institucional"]
        K --> L["7. Generación de Contrato Bi-firmado Definitivo"]
        L --> M["8. Activación de trq_abogado y rol ABOGADO"]
        M --> N3["Notificación 3: ¡Bienvenido a tranqi! Cuenta Activada"]
    end
```

---

## 2. Arquitectura de Firma Digital Zero-Custody (`.p12` / PAdES)

Conforme a la Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos del Ecuador y los pilares de seguridad de Tranqi (`legaltech-lpms-tranqi-framework`):

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Abogado / Operador Tranqi
    participant Browser as Navegador Web (Cliente)
    participant WebCrypto as Memoria Volátil (PKCS#12 Parser)
    participant Storage as Supabase Storage Privado
    participant DB as PostgreSQL (tranqui_legal)

    Usuario->>Browser: Selecciona certificado .p12/.pfx e ingresa clave
    Browser->>WebCrypto: Parsea DER/ASN.1 y descifra bolsas con node-forge
    WebCrypto-->>Browser: Extrae metadatos X.509 (Titular, Emisor, Fechas, Serie)
    Browser->>Browser: Muestra preview de validez del certificado
    Usuario->>Browser: Confirma firma sobre el PDF
    Browser->>WebCrypto: Estampa sello visual PAdES con timestamp ECT y hash SHA-256
    WebCrypto-->>Browser: Genera PDF firmado (Uint8Array)
    WebCrypto->>WebCrypto: PURGA claves y contraseñas de la memoria
    Browser->>Storage: Sube PDF firmado al bucket socios-documentos
    Browser->>DB: Registra documento en trq_documento_socio
```

### Principios de Seguridad:
1. **Cero Custodia (Zero-Custody):** La contraseña y el archivo `.p12` **NUNCA** se transmiten por red ni se almacenan en la nube o bases de datos. Todo el descifrado y estampado criptográfico ocurre dentro del navegador del usuario.
2. **Compatibilidad Nacional:** Soporta entidades de certificación de información autorizadas en Ecuador (Security Data, Banco Central del Ecuador, Consejo de la Judicatura, ANFAC, Uanataca, etc.).
3. **Estampa Visual PAdES:** Incluye recuadro institucional con nombre del firmante, entidad emisora, timestamp oficial de Ecuador (ECT), razón jurídica, número de serie y sello de integridad.

---

## 3. Matriz de Estados y Notificaciones

| Fase | Estado (`ssc_estado`) | Chip UI | Notificación Despachada | Canales | Destinatario |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fase 1** | `enviada` / `en_revision` | `⏳ Postulación Inicial` | *"Solicitud de Socio Abogado Recibida"* | In-App, Push, Email | Postulante & Staff |
| **Fase 1 Final** | `aceptada` (Paso 1) | `✍️ Esperando Firma Abogado` | **Notif 1:** *"📋 ¡Credenciales Validadas! — Descarga y Firma tu Contrato"* | In-App, Push, Email | Postulante |
| **Fase 2** | `contrato_subido` | `📄 Contrato Listo para Contra-firma` | **Notif 2:** *"📝 Contrato Firmado Recibido — Listo para Verificación y Contra-Firma"* | In-App, Push, Email | Staff Operaciones |
| **Fase 3 Final** | `aceptada` (Contrato confirmado) | `🎉 Contrato Bi-firmado (Activo)` | **Notif 3:** *"🎉 ¡Bienvenido a tranqi! Contrato Bi-firmado y Cuenta Activada"* | In-App, Push, Email | Nuevo Socio Abogado |
| **Observada** | `rechazada` | `⚠️ Requiere Corrección` | *"⚠️ Observaciones sobre tu Solicitud de Socio Abogado"* | In-App, Push, Email | Postulante |

---

## 4. Estructura de Archivos del Módulo

```
modulos/socios/
├── README.md                                  # Documentación técnica y diagramas de arquitectura
├── esquema.ts                                 # Validaciones Zod, tipos de datos y constantes
├── consultas.ts                               # Consultas de solicitudes, jerarquía de urgencias y detalle
├── acciones.ts                                # Server Actions: decidir, confirmar contrato, notificaciones
├── servicios/
│   └── servicioFirmaDigital.ts               # Parser PKCS#12 (node-forge) y estampador PAdES (pdf-lib)
└── componentes/
    ├── ModalFirmaDigitalPdf.tsx               # Modal interactivo de firma electrónica Zero-Custody
    ├── GestionContratoPostulante.tsx          # Panel del postulante (Firma .p12, manual o propuesta Word)
    ├── BotonConfirmarContrato.tsx             # Panel de contra-firma institucional Tranqi y activación
    ├── FormularioSolicitudSocio.tsx           # Formulario de postulación y acreditación inicial
    ├── AccionesSolicitud.tsx                  # Botones de decisión de credenciales (Paso 1)
    ├── ConfiguracionContratoAbogadoWidget.tsx # Editor de plantilla de contrato para administradores
    └── SubirDocumentoRevision.tsx             # Respaldo documental de operadores
```

---

## 5. Endpoints de API Relacionados

- `GET /api/solicitud-socio/contrato/pdf?solicitudId={id}`: Genera en tiempo real el PDF A4 vectorial del contrato pre-llenado con los datos del postulante y cláusulas vigentes.
- `GET /api/solicitud-socio/contrato/descargar?solicitudId={id}`: Descarga la plantilla pre-llenada en formato Word (`.docx`).
- `GET /api/solicitud-socio/contrato/firmado?solicitudId={id}`: Retorna el archivo de contrato firmado / bi-firmado almacenado en Supabase Storage mediante URL firmada.
