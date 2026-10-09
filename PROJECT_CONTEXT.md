# 🚀 Rendy SaaS - Project Architecture & Context

## 1. Visión del Producto
Rendy es un asistente inteligente de gestión y reporte de gastos/viáticos vía WhatsApp con IA, desarrollado por la empresa **Swork**. Se comercializa como un SaaS B2B Multi-tenant para empresas.

## 2. Stack Tecnológico
- **Core / Backend Webhook:** Next.js (App Router), TypeScript.
- **AI & Processing:** Gemini API (Lectura de recibos/OCR, corrección por texto y notas de voz/audio).
- **Messaging:** Meta WhatsApp Business API (Graph API v20.0, Mensajes interactivos de listas).
- **Database & Storage:** Supabase (PostgreSQL con Row Level Security + Storage Bucket `comprobantes`).

## 3. Modelo de Datos Multi-tenant (Supabase)
- `empresas`: (id, nombre, creado_en) -> Representa a cada cliente B2B (ej. UAT, Swork Demo).
- `usuarios`: (id, empresa_id, nombre, email, telefono_whatsapp, rol ['ADMIN', 'EMPLEADO']).
- `proyectos`: (id, empresa_id, nombre, activo).
- `metodos_pago`: (id, empresa_id, nombre).
- `solicitudes_viaticos`: (id, empresa_id, usuario_id, proyecto_id, monto_solicitado, monto_aprobado, estado ['PENDIENTE', 'APROBADO', 'RECHAZADO'], motivo_rechazo).
- `gastos`: (id, empresa_id, usuario_id, proyecto_id, metodo_pago_id, solicitud_id, categoria, comercio, monto, moneda, fecha_gasto, url_comprobante, concepto, estado ['PENDIENTE', 'APROBADO', 'RECHAZADO'], datos_ocr [JSONB]).

## 4. Ecosistema de WhatsApp (Ya implementado al 100%)
1. **Recepción:** El usuario envía foto del recibo por WhatsApp.
2. **Procesamiento:** Gemini extrae los datos y guarda la foto en Supabase Storage (`comprobantes`).
3. **Flujo Interactivo:**
   - Lista 1: Selección de Proyecto (filtrado dinámicamente por `empresa_id`).
   - Lista 2: Selección de Categoría (Airfare, Food, Gas, Hotel, Materiales, etc.).
   - Lista 3: Selección de Método de Pago (filtrado por `empresa_id`).
4. **Edición:** Corrección por lenguaje natural (texto o notas de voz).
5. **Confirmación:** Al responder "SI", se inserta en la tabla `gastos` mapeando todas las FKs.

## 5. Módulos a Construir en la Plataforma Web (SaaS Dashboard)
1. **Dashboard General (KPIs & Analítica):**
   - Resumen ejecutivo: Total gastado en el mes, viáticos aprobados vs. justificados, reembolsos pendientes.
   - Gráficos interactivos de desglose por Proyecto y Categoría.
2. **Solicitudes de Viáticos:**
   - Flujo de revisión para Administradores (Aprobar / Rechazar con motivo).
   - Registro de transferencia de fondos otorgados.
3. **Progreso de Justificación de Viáticos:**
   - Monitoreo en tiempo real del porcentaje de avance de justificación de cada viático asignado:
     Monto Restante = Monto Otorgado - Suma(Gastos confirmados por WhatsApp).
4. **Gestión de Reembolsos:**
   - Listado de gastos efectuados con fondos propios del empleado.
   - Estados: Pendiente, Procesado, Pagado.
5. **Gestión de Organización & Configuración (Multi-tenant):**
   - Altas/Bajas de Usuarios y asignación de roles (`ADMIN` / `EMPLEADO`).
   - Creación de Proyectos y Métodos de Pago (disponibles en tiempo real en los desplegables de WhatsApp).