# Billing API

API backend para el challenge técnico de facturación por lote. Incluye configuración básica de NestJS, TypeORM, PostgreSQL y Docker.

---

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+
- Docker y Docker Compose (opcional)
- PostgreSQL 14+ (si trabajas localmente sin Docker)

### Opción A: Desarrollo con Docker Compose (Recomendado)

1. **Configurar variables de entorno**:
   ```bash
   cp env.example .env
   ```

2. **Levantar los servicios**:
   ```bash
   docker compose up -d
   ```
   Esto levantará:
   - PostgreSQL en el puerto **5434** (host) → 5432 (container)
   - La API en el puerto **3057** (host) → 3000 (container)

3. **Levantar los servicios y ejecutar migraciones**:
   ```bash
   docker compose up -d --build
   ```
   El servicio `migrations` espera a que PostgreSQL esté saludable, ejecuta las migraciones y termina. La API inicia después de una ejecución exitosa.

4. **Cargar datos de prueba (opcional)**:
   ```bash
   docker compose run --rm migrations npm run seed
   ```

5. **Verificar que funciona**:
   ```bash
   curl http://localhost:3057/health
   ```

6. **Probar autenticación (mock)**:
   ```bash
   curl -X POST http://localhost:3057/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}'
   ```

7. **Ver la documentación Swagger**:
   Abre en tu navegador: http://localhost:3057/api

---

### Opción B: Desarrollo Local (Sin Docker)

Si prefieres trabajar localmente sin Docker:

1. **Instalar PostgreSQL localmente** y crear la base de datos:
   ```bash
   createdb billing_challenge
   ```

2. **Configurar variables de entorno**:
   ```bash
   cp env.example .env
   ```
   Edita `.env` y ajusta:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=tu_usuario_postgres
   DB_PASSWORD=tu_password_postgres
   DB_DATABASE=billing_challenge
   PORT=3000
   ```

3. **Instalar dependencias y ejecutar migraciones**:
   ```bash
   npm install
   npm run typeorm:run
   ```

4. **Iniciar la aplicación**:
   ```bash
   npm run start:dev
   ```
   La API estará disponible en: http://localhost:3000

---

## 🛠️ Comandos Útiles

```bash
# Desarrollo
npm run start:dev

# Ejecutar migraciones manualmente
npm run typeorm:run

# Cargar datos de prueba
npm run seed

# Generar migración
npm run typeorm:migrate -- src/migrations/NombreMigracion

# Tests
npm test
```

## Decisiones técnicas

### Modelado y alcance

`Service` representa el dominio logístico y solo contiene estados de servicio (`PENDING`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`). `BillingPending` representa la decisión explícita de enviar un servicio a facturación y contiene su estado de facturación. `BillingBatch` agrupa pendientes seleccionados manualmente, mientras `Invoice` conserva la factura emitida y su relación con el lote y el pendiente.

Se priorizó el flujo backend completo: creación de pendientes, facturación manual, numeración por talonario, CAE simulado, exportación para ERP y sincronización simulada. Frontend y procesamiento asíncrono quedan fuera del alcance implementado.

### Manejo de errores

La API utiliza un filtro global para devolver un contrato consistente en todas las respuestas de error:

```json
{
   "statusCode": 404,
   "code": "NOT_FOUND",
   "message": "Lote con ID 999999 no encontrado.",
   "details": null,
   "timestamp": "2026-08-26T14:00:00.000Z",
   "path": "/billing/batches/999999/export"
}
```

Los códigos principales son `VALIDATION_ERROR`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` e `INTERNAL_SERVER_ERROR`. Los errores de validación incluyen sus mensajes en `details`; los errores de dominio conservan un mensaje descriptivo en español. Las excepciones inesperadas siempre responden con un mensaje genérico: stack traces, consultas SQL, credenciales y otros detalles internos solo se registran en el servidor.

La validación se realiza en dos niveles. `ValidationPipe` rechaza cuerpos y parámetros inválidos en el borde HTTP, mientras que el servicio mantiene sus propias guardas para proteger el caso de uso cuando se invoca fuera de HTTP. Por eso, un lote vacío enviado por la API produce `VALIDATION_ERROR`, y la validación defensiva del servicio continúa cubriendo llamadas internas.

### Concurrencia e idempotencia

La facturación se ejecuta dentro de una transacción. Los pendientes y la secuencia del talonario se bloquean con locks pesimistas. Las restricciones únicas de `serviceId`, `pendingId` e `invoiceNumber` protegen contra duplicados incluso si llegan solicitudes concurrentes. En producción se agregaría una clave de idempotencia por solicitud y un registro de auditoría para reintentos.

### Sincronización con ERP

La exportación devuelve un encabezado con lote, talonario y cantidad, más asientos con identificador externo, número de factura, CAE, fecha, cliente, importe y referencia del servicio. Este formato separa metadatos del lote de los registros contables y permite que un adaptador futuro lo transforme al contrato del ERP real.

### Migraciones y seeds

Las migraciones viven en `src/migrations` y se ejecutan automáticamente mediante el servicio Docker `migrations` antes de `api`. El seed se ejecuta con `npm run seed`, limpia las tablas y secuencias, y crea servicios entregados con pendientes y un servicio en tránsito para probar ambos caminos.

### Mejoras futuras

Se incorporarían una clave de idempotencia persistente, lock explícito al sincronizar, autorización por roles, filtros por rango de fechas, auditoría, reintentos con cola y un adaptador para el ERP real.

---

## 📚 Más Información

Para más detalles sobre:
- Modelo de datos y entidades
- Conceptos clave del dominio
- Endpoints a implementar
- Autenticación y autorización

Consulta el **README principal del challenge** en `../README.md`

---

## 📖 Recursos

- **`src/entities/README.md`**: Documentación de entidades
- **`src/auth/README.md`**: Guía de autenticación

