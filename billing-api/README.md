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

