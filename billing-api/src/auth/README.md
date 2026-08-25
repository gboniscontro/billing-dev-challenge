# Autenticación

La API utiliza un mock de AWS Cognito para desarrollo. El mock genera un JWT firmado localmente y permite probar el flujo de autenticación sin crear recursos reales en AWS.

## Flujo

1. El cliente ejecuta `POST /auth/login` con `username` y `password`.
2. El mock devuelve un `accessToken` JWT.
3. El cliente envía el token en cada endpoint protegido:

```http
Authorization: Bearer <accessToken>
```

4. `JwtAuthGuard` intercepta la solicitud y `JwtStrategy` valida la firma, expiración y contenido básico del token.

## Configuración

Las variables se definen en `.env`:

```env
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h
```

El mock acepta cualquier usuario y contraseña no vacíos. No reemplaza la validación real de usuarios.

## Archivos principales

- `services/cognito-mock.service.ts`: genera el JWT.
- `strategies/jwt.strategy.ts`: valida el payload.
- `guards/jwt-auth.guard.ts`: protege los endpoints.
- `guards/roles.guard.ts`: infraestructura para autorización por roles.
- `decorators/public.decorator.ts`: marca endpoints públicos.
- `decorators/roles.decorator.ts`: declara roles requeridos.

En producción se reemplazaría el login mock por AWS Cognito y se validarían issuer, audience, firma y grupos del token emitido por Cognito.
