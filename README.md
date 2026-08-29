# Challenge Técnico Fullstack - Nivel Senior
## Sistema de Facturación por Lote

1. Decisiones de Modelado
¿Cómo se relacionan las entidades?
Service (1:1) BillingPending: Un servicio logístico genera un único registro de pendiente cuando alcanza el estado final de entrega.

BillingBatch (1:N) Invoice: Un lote agrupa múltiples facturas o comprobantes emitidos en una misma ejecución manual.

BillingPending (1:1) Invoice: Un pendiente de facturación se vincula directamente a una única factura generada.

Relaciones en BD: La base de datos refuerza las relaciones uno a uno mediante índices únicos sobre serviceId y pendingId. Se utiliza también una entidad BillingSequence que mantiene el último número utilizado por cada talonario.

¿Qué campos son obligatorios y por qué?
BillingPending.status: Obligatorio (PENDING, INVOICED) para filtrar en forma directa qué filas son elegibles para cobro sin hacer scans completos de tablas.

BillingBatch.receiptBook: Obligatorio para determinar el punto de venta / talonario contable sobre el cual calcular la correlatividad.

Invoice.invoiceNumber: Obligatorio y único por talonario (0001-00000001) para cumplir con normativas fiscales.

Invoice.cae: Obligatorio como identificador único de autorización del comprobante.

Separación de dominios (Logística vs. Facturación)
El dominio de logística finaliza su ciclo de vida cuando el estado alcanza DELIVERED. La entidad Service representa exclusivamente este dominio logístico y solo contiene estados operativos (PENDING -> IN_TRANSIT -> DELIVERED -> CANCELLED). No almacena estados de facturación, evitando así el acoplamiento.

El dominio de facturación reacciona a los eventos de entrega creando filas en billing_pendings. Esto permite cambiar las reglas contables (impuestos, agrupaciones, refacturaciones) sin alterar el modelo de logística. BillingPending representa la decisión explícita de enviar un servicio a facturación, mientras que BillingBatch agrupa pendientes seleccionados manualmente, e Invoice conserva la factura emitida.

Flujo API Implementado
POST /billing/services/:id/send-to-billing: Crea un pendiente PENDING únicamente para servicios DELIVERED.

POST /billing/batches: Procesa manualmente los pendientes seleccionados y genera las facturas.

GET /billing/invoices: Consulta las facturas generadas, opcionalmente filtradas por lote.

GET /billing/batches/:id/export: Prepara el payload normalizado para el ERP.

POST /billing/batches/:id/sync: Simula el envío al ERP y registra el estado SYNCED con su fecha de sincronización.

2. Concurrencia e Idempotencia

Solución ante intentos simultáneos de facturación
Para evitar race conditions (donde dos operadores procesen el mismo pendiente al mismo tiempo), se envuelve la lectura, validación, generación de facturas y actualización de estados en una única unidad atómica de trabajo utilizando dataSource.transaction.

Además, se implementa Bloqueo Pesimista (Pessimistic Locking): se ejecuta un SELECT ... FOR UPDATE sobre los registros seleccionados en billing_pendings usando .setLock('pessimistic_write', undefined, ['pending']). Lo mismo ocurre con BillingSequence para proteger la secuencia del talonario. La base de datos bloquea las filas para cualquier otra transacción concurrente hasta que la actual haga COMMIT o ROLLBACK.

Garantía de Idempotencia
Antes de procesar, la transacción valida de forma explícita que ningún billing_pending tenga el estado INVOICED. Si otro proceso cambió el estado milisegundos antes, la transacción falla lanzando una excepción 409 Conflict y deshace cualquier cambio automáticamente. Además, las restricciones únicas de base de datos (serviceId, pendingId e invoiceNumber) protegen contra duplicados a nivel estructural.

3. Alcance del Challenge
Se priorizó implementar un flujo backend completo, sólido y testeable:

Consistencia de datos y manejo de concurrencia en la facturación por lotes.

Creación de pendientes, numeración secuencial por talonario y CAE simulado.

Transformación de payload y simulación de sincronización para ERP contable.

Cobertura de errores global estructurada y contratos claros de respuesta.

El frontend y el procesamiento asíncrono real mediante colas se detallaron a nivel arquitectónico pero quedaron fuera del alcance de este MVP para priorizar la calidad técnica en el lado del servidor.

4. Preparación de Datos para Sincronización con ERP
Formato de Datos Diseñado
Se diseñó una estructura DTO jerárquica con una cabecera de lote (erpHeader) y un listado plano de asientos contables (accountingEntries). Este formato separa claramente los metadatos del lote (la ejecución) de los registros contables individuales, permitiendo que un adaptador futuro lo transforme fácilmente al contrato XML/JSON específico del ERP real.

Campos Incluidos y Justificación
batchId & processedAt: Para trazabilidad del lote en el sistema de origen en caso de auditoría.

externalInvoiceId & invoiceNumber: Para conciliación entre el ID interno de la API y el número de comprobante fiscal.

cae: Requisito fiscal obligatorio para validaciones contables.

customerId: Asignación del débito en la cuenta corriente del cliente en el ERP.

amount: Monto nominal parseado como numérico decimal.

serviceReferenceId: Trazabilidad operativa que permite navegar desde el asiento contable hacia el servicio logístico original.

5. Procesamiento Asíncrono (Arquitectura Propuesta)
(Estrategia diseñada para escalar la aplicación a miles de operaciones)

Tecnología Sugerida: BullMQ / Redis o AWS SQS + Lambda.

Estrategia Asíncrona: Cuando el volumen de datos escala a miles de facturas, el endpoint HTTP delega la ejecución publicando un mensaje en la cola. Un worker procesa el lote en segundo plano, ejecutando la lógica transaccional y actualizando el estado de BillingBatch de PENDING a PROCESSED o FAILED.

Manejo de Errores y Reintentos: Se implementaría un Exponential Backoff para fallos temporales (timeouts de conexión al ERP o base de datos). Si el error es de negocio (validación fiscal), el mensaje pasa a una Dead Letter Queue (DLQ) y el lote se marca como FAILED, guardando la traza del problema en la columna errorMessage.

6. Migraciones y Seeds
Migraciones
Las migraciones viven en src/migrations y gestionan la creación e índices de las tablas services, billing_pendings, billing_batches e invoices. Se ejecutan automáticamente mediante el servicio Docker migrations, el cual actúa como un contenedor init dentro de Compose, ejecutándose y finalizando antes de que el servidor principal de NestJS levante.

Cada archivo de migración contiene comentarios claros explicando las tablas e índices modificados, el porqué de la decisión y el impacto en el esquema.

Seeds (Datos de Prueba)
El script de seed (src/seed.ts) limpia las tablas y reinicia las secuencias de IDs. Puebla la base con servicios logísticos en estado DELIVERED (con sus pendientes correspondientes generados) y un servicio en IN_TRANSIT para probar ambos caminos.

Para ejecutarlo dentro del contenedor:

Bash
docker exec -it billing_challenge_api npm run seed

7. Manejo de Errores
La API utiliza un filtro global de excepciones para devolver un contrato consistente en todas las respuestas de error:

JSON
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Lote con ID 999999 no encontrado.",
  "details": null,
  "timestamp": "2026-08-28T14:00:00.000Z",
  "path": "/billing/batches/999999/export"
}
Códigos soportados: VALIDATION_ERROR, BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT e INTERNAL_SERVER_ERROR.

Niveles de validación: ValidationPipe rechaza los cuerpos/parámetros inválidos en el borde HTTP, mientras que el servicio mantiene sus propias guardas defensivas de negocio.

Seguridad: Las excepciones inesperadas responden siempre con un mensaje genérico. Stack traces, consultas SQL o datos sensibles se registran únicamente en los logs del servidor.

8. Autenticación (Mock de AWS Cognito)
La API utiliza un mock de AWS Cognito para entorno de desarrollo que genera un JWT firmado localmente.

Flujo de Autenticación
El cliente ejecuta POST /auth/login enviando username y password.

El mock devuelve un accessToken JWT.

El cliente envía el token en cada endpoint protegido mediante el header:

HTTP
Authorization: Bearer <accessToken>
JwtAuthGuard intercepta la solicitud y JwtStrategy valida la firma, expiración y payload del token.

Configuración (.env)
Fragmento de código
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h
En un entorno de producción, este componente se reemplaza por el servicio Cognito de AWS validando firma (JWKS), issuer y audience.

9. Mejoras Futuras
Técnicas: Incorporar clave de idempotencia persistente por Request Header, implementar locks distribuidos (Redlock) al sincronizar con el ERP, y construir adaptadores específicos según el ERP de destino (SAP, Tango, etc.).

Negocio/Operativas: Implementar autorización avanzada basada en roles (RBAC), filtros de búsqueda por rango de fechas en la API/UI, y un módulo de auditoría detallado para registrar qué usuario emitió cada lote.


> **⚠️ Perfil Esperado**: Este challenge está orientado a perfiles **Senior con fuerte experiencia en Backend**. Aunque incluye un componente frontend (React), el foco de evaluación está en el diseño de dominio, arquitectura backend, manejo de errores, y decisiones técnicas del lado del servidor. Se espera que el candidato/a demuestre profundidad técnica en backend más que en frontend.

---

## 📋 Contexto del Negocio

Somos una empresa de logística que factura servicios a mes vencido. A diferencia de sistemas de facturación automática, nuestro proceso es **manual y controlado**, inspirado en sistemas ERP tradicionales como Tango.

### Objetivo del Challenge

El objetivo de este challenge es crear un sistema para **generar facturas por lote** y **preparar los datos** para que puedan ser enviados a un sistema contable externo (ERP) para su registro contable. El sistema debe:

1. Gestionar el ciclo de vida de servicios facturables
2. Permitir la facturación manual por lotes
3. **Preparar y transformar los datos** de facturas en un formato que un sistema contable pueda procesar
4. **Simular el proceso de envío** al sistema contable externo

> **Nota**: No se requiere conectarse a un sistema contable real. El objetivo es preparar los datos en un formato que contenga la información necesaria y simular el proceso de envío.

### 📊 Flujo de Facturación

El flujo de facturación consta de tres etapas principales:

1. **Generación de pendientes**: Los servicios facturables se marcan como "enviados a facturar", creando pendientes de facturación.
2. **Facturación por lote**: Un usuario ejecuta manualmente un proceso que agrupa pendientes seleccionados, define fecha de emisión y talonario, y genera facturas con numeración correlativa.
3. **Preparación para sincronización**: Las facturas generadas se transforman a un formato estándar y se preparan para enviar al sistema contable externo (simulado).

---

## Stack Tecnológico Requerido

### Backend
- **Framework**: NestJS
- **Lenguaje**: TypeScript
- **Autenticación**: AWS Cognito (real o mock para desarrollo)

### Frontend(Optional - Client Side Rendering)
- **Framework**: React (puede usar cualquier herramienta de build)
- **Lenguaje**: TypeScript
- **Estado**: A elección del candidato (Redux, Zustand, Context API, etc.)

### Infraestructura
- **Containerización**: Docker / Docker Compose
- **Base de datos**: Libre (PostgreSQL sugerida)
- **Opcional**: 
  - Sistema de colas (SQS, RabbitMQ, Redis Queue, BullMQ, etc.) para procesamiento asíncrono

### Autenticación
- Integración con AWS Cognito para login
- Uso de Bearer Token (JWT)
- Endpoints protegidos según requerimientos

---

## Dominio Funcional

### 1. Servicios / Envíos Facturables

**Definición**: Representan servicios de logística que pueden ser facturados.

**Características**:
- Se crean con:
  - Fecha de servicio (`serviceDate` - fecha única cuando se realizó el servicio)
  - Cliente (identificador)
  - Importe (monto facturable)
- **NO tienen**:
  - Fecha de emisión
  - Número de factura
  - Estado de facturación inicial

**Estados** (si se implementan):
- Los estados de Service deberían ser del dominio de logística (ej: `PENDING`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`)
- **NO deberían incluir estados de facturación** (`SENT_TO_BILL`, `INVOICED`) porque contamina el dominio
- La información de facturación debe estar en `BillingPending` o en una relación separada

---

### 2. Pendientes de Facturación

**Definición**: Representan ítems listos para ser incluidos en un lote de facturación.

**Características**:
- Se generan automáticamente al marcar un servicio como "enviado a facturar"
- Representan servicios que están listos para ser facturados
- **NO se emiten facturas** en esta instancia
- Pueden ser seleccionados para formar parte de un lote

**Estados sugeridos**:
- `PENDIENTE`: Pendiente disponible para incluir en un lote
- `FACTURADO`: Pendiente ya incluido en una factura

**Restricciones**:
- Un pendiente solo puede ser facturado una vez

---

### 3. Facturación por Lote

**Definición**: Proceso explícito y manual que agrupa pendientes y genera facturas.

**Características**:
- Proceso **explícito y manual** (no automático)
- Permite seleccionar múltiples pendientes
- Define parámetros del lote:
  - **Fecha del lote** (fecha de emisión de todas las facturas)
  - **Talonario** (identificador del talonario a utilizar)
- Genera facturas con:
  - Numeración correlativa (secuencial dentro del talonario)
  - CAE simulado (Código de Autorización Electrónico)
    - **Nota**: En producción, el CAE se obtiene de AFIP. En el challenge debe simularse.
- Todas las facturas del lote comparten la misma fecha de emisión

**Estados sugeridos**:
- `PROCESADO`: Lote procesado exitosamente
- `ERROR`: Lote con errores en el procesamiento

**Restricciones críticas**:
- **No debe haber facturación automática**
- La fecha de emisión solo se define de manera forzada al ejecutar el lote

---

## 🔒 Autenticación y Autorización

### Requisitos de Autenticación

- Login mediante AWS Cognito (o mock para desarrollo)
- Uso de Bearer Token (JWT) en headers
- Endpoints protegidos:
  - Emitir lotes de facturación
  - Consultar pendientes de facturación
  - Consultar facturas generadas

### Endpoints Públicos
- Health check
- Login

---

## ⚠️ Manejo de Errores

El manejo de errores es **clave para la evaluación**.

### Mensajes de Error
- Mensajes claros y descriptivos
- Estructura consistente en toda la API
- Incluir códigos de error cuando sea apropiado

---

## 🖥️ Frontend(opcional)

### Pantallas Sugeridas

#### 1. Listado de Pendientes de Facturación
- Tabla con pendientes disponibles
- Filtros:
  - Por cliente
  - Por fecha de servicio (rango de fechas)
- Acción para seleccionar pendientes
- Indicadores de estado

#### 2. Facturación por Lote
- Formulario para crear lote:
  - Selección de pendientes (checkboxes o similar)
  - Campo de fecha de emisión
  - Campo de talonario
- Botón de ejecución explícito
- Feedback visual del proceso

#### 3. Resultado del Lote
- Visualización del resultado del procesamiento
- Listado de facturas generadas
- Información del lote (fecha, talonario, cantidad de facturas)
- Manejo de errores parciales (si se implementa)


---

## 📚 Documentación Obligatoria

El candidato debe incluir en el README una sección explicando:

### 1. Decisiones de Modelado
- ¿Cómo se relacionan las entidades?
- ¿Qué campos son obligatorios y por qué?
- ¿Service debería tener estados de facturación o esa responsabilidad pertenece a otro dominio?
- ¿Cómo se separa el dominio de logística del dominio de facturación?

### 2. Concurrencia e Idempotencia
- ¿Cómo se manejaría si dos usuarios intentan facturar el mismo pendiente?
- ¿Cómo se garantiza la idempotencia del proceso de facturación?
- ¿Qué estrategias se implementarían?

### 4. Alcance del challenge
- ¿Por qué se priorizaron ciertas features?

### 5. Preparación de Datos para Sincronización con Sistema Contable
- ¿Qué formato de datos se diseñó y por qué?
- ¿Qué información se incluyó en el formato de sincronización?
- ¿Por qué se eligieron esos campos específicos?

### 6. Procesamiento Asíncrono (Si se implementó)
- ¿Qué tecnología de colas elegiste y por qué?
- ¿Cómo manejas el procesamiento asíncrono de lotes?
- ¿Cómo se manejan los errores y reintentos?

### 7. Migraciones y Seeds
- **Migraciones**: Explicar cómo se estructuran las migraciones y qué cambios realizan
- **Documentación de migraciones**: Cada migración debe tener comentarios claros explicando:
  - Qué cambios realiza
  - Por qué se realizan esos cambios
  - Impacto en los datos existentes (si aplica)
- **Seeds**: Explicar qué datos de ejemplo se incluyen y cómo ejecutarlos

Implementar las migraciones de base de datos como un **servicio separado** en Docker Compose que se ejecute automáticamente antes del servicio principal.

- **Datos de prueba**: Los seeds deben incluir datos suficientes para probar todos los flujos del sistema

### 8. Mejoras Futuras
- ¿Qué mejoras se considerarían a futuro?
- ¿Qué problemas técnicos o de negocio se anticipan?

---

## ⭐ Opcional (Plus Senior)

Estas funcionalidades no son obligatorias

### Procesamiento Asíncrono y Colas

Implementar el procesamiento de lotes de facturación de forma **asíncrona** usando colas de mensajes.

**Objetivo**: Evaluar conocimiento en:
- Procesamiento asíncrono
- Sistemas de colas (SQS, RabbitMQ, Redis, etc.)
- Workers/Jobs en background
- Manejo de tareas de larga duración

**Implementación sugerida**:
- Al crear un lote, en lugar de procesarlo inmediatamente, enviarlo a una cola
- Implementar un worker que procese los lotes de forma asíncrona
- Manejar estados del lote: `PENDIENTE_PROCESAMIENTO`, `EN_PROCESO`, `PROCESADO`, `ERROR`
- Permitir consultar el estado del procesamiento

**Tecnologías sugerida**
- **AWS SQS**(localstack) o cualquier otra tecnología de colas

**Priorizamos calidad y criterio en backend por sobre volumen de código. El frontend debe ser funcional pero no es el foco principal de evaluación.**

---

## Dudas frecuentes

### ¿Puedo usar librerías adicionales?
Sí, siempre que estén justificadas

### ¿Debo implementar todas las funcionalidades opcionales?
No, son opcionales. Implementa las que consideres relevantes para demostrar tu nivel.

### ¿Cómo debo manejar la autenticación con Cognito?
Puedes usar Cognito real o crear un mock. Lo importante es que el flujo de autenticación funcione correctamente.

### ¿Qué nivel de testing se espera?
No es obligatorio, pero tests unitarios o de integración son bienvenidos.

### ¿Puedo usar TypeORM, Prisma u otro ORM?
Sí, la elección de herramientas es libre siempre que uses NestJS y TypeScript.

---

## 🚀 Inicio Rápido

Para comenzar con el challenge, consulta las **instrucciones detalladas de instalación y ejecución** en el README del repositorio de la API:

📖 **Ver**: `billing-api/README.md`

El repositorio `billing-api` incluye:
- Configuración completa de NestJS, TypeORM y PostgreSQL
- Docker Compose listo para usar
- Instrucciones para desarrollo con Docker o local
- Modelo de datos sugerido con migración inicial
- Autenticación básica configurada

**Importante**: 
- Debes crear y documentar todas las migraciones necesarias para el esquema de base de datos
- Debes incluir seeds para poblar la base de datos con datos de ejemplo que permitan probar el sistema

> **Nota**: Puedes agregar más repositorios al lado de `billing-api` según necesites (por ejemplo: `billing-frontend`, `billing-worker`, etc.).

---

**¡Éxito en el challenge!**


