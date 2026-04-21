# Litebank API — Contrato HTTP (v1)

Documento orientado a **generar o mantener un cliente HTTP**: rutas, métodos, cabeceras, cuerpos JSON y respuestas esperadas. Comportamiento derivado del código NestJS en `src/`.

**Especificación interactiva (OpenAPI):** `GET /docs` (Swagger UI) en el mismo host que la API.

**Base URL (desarrollo por defecto):** `http://localhost:3000` (puerto `PORT` en entorno, por defecto `3000`).

**Formato:** salvo `GET /` (texto plano), las peticiones y respuestas con cuerpo usan **`Content-Type: application/json`**.

---

## 1. Autenticación

### 1.1 JWT de acceso (Bearer)

Rutas bajo **`/customers/*`**, **`/accounts/*`** y **`POST /users/logout`** exigen:

```http
Authorization: Bearer <access_token>
```

- Algoritmo: **RS256**.
- Validez típica del access token: **15 minutos** (`expiresIn: '15m'`).
- El servidor valida **issuer** y **audience** fijos en código:
  - `iss`: `http://localhost:3000`
  - `aud`: `general`
- Claims relevantes:
  - **`sub`** — UUID del usuario (`users.public_id`), no el `id` numérico interno.
  - **`sessionId`** — entero, PK de la fila `sessions` asociada al login o al último refresh. El `JwtAuthGuard` comprueba en cada petición que la sesión exista, no esté revocada (`revoked_at` nulo) y no haya expirado; si no, **`401`** (p. ej. `Session revoked`, `Session expired`).

Si falta el header, el token es inválido o expiró: **`401 Unauthorized`** con cuerpo estilo Nest (`{ "message": "...", "statusCode": 401 }`).

### 1.2 Cerrar sesión (`POST /users/logout`)

- **Auth:** Bearer JWT de la sesión que se desea cerrar.
- **Cuerpo:** ninguno.
- **204 No Content:** la sesión queda revocada (`sessions.revoked_at`). Los **refresh tokens** ligados a esa sesión dejan de ser válidos en `POST /users/refresh`, y el **mismo access token** deja de aceptarse en rutas protegidas (el guard detecta sesión revocada).
- **401 Unauthorized:** token inválido/expirado, sesión ya revocada o expirada, o sesión no pertenece al `sub` del JWT.

### 1.3 Refresh token (opaco)

- Cadena hexadecimal aleatoria (64 caracteres en la implementación actual: 32 bytes en hex).
- Se envía solo en **`POST /users/refresh`** en el cuerpo JSON.
- Rotación: un uso exitoso de refresh **invalida** el token anterior a favor de uno nuevo en la misma respuesta.
- Si la sesión está **revocada** (p. ej. tras `POST /users/logout`) o expirada, **`POST /users/refresh`** responde **`401 Unauthorized`** (mensaje tipo `Session invalid or expired`).

---

## 2. Idempotencia

Algunas rutas están marcadas como idempotentes y pasan por `IdempotencyInterceptor`.

### 2.1 Cabecera obligatoria

```http
Idempotency-Key: <uuid>
```

El valor debe ser un **UUID** que cumpla el regex del servidor (incluye restricción de variante en el tercer grupo de la versión). Ejemplo válido: `550e8400-e29b-41d4-a716-446655440000`.

- **`400 Bad Request`**: cabecera ausente o no UUID válido (`Missing or invalid Idempotency-Key header`).

### 2.2 Semántica

- La clave identifica **una única operación lógica** por combinación de: método, ruta, query, cuerpo y usuario autenticado (`sub` en rutas con JWT).
- **Reintentos** con la misma clave y la **misma** petición (mismo hash interno): el servidor **reproduce** el mismo código HTTP y cuerpo almacenado (incluidos fallos previos).
- **`409 Conflict`** en casos como:
  - misma clave pero **petición distinta** (cuerpo/ruta/método distinto);
  - solicitud anterior **aún en procesamiento**;
  - condiciones de carrera en creación de la clave.

Rutas que exigen `Idempotency-Key` en esta versión:

| Método | Ruta |
|--------|------|
| `POST` | `/users/register` |
| `DELETE` | `/accounts/:id` |
| `POST` | `/accounts` |
| `POST` | `/accounts/deposit` |
| `POST` | `/accounts/withdraw` |
| `POST` | `/accounts/transfer` |

---

## 3. Modelos de datos (JSON)

### 3.1 Usuario (respuesta registro)

Objeto devuelto por `POST /users/register` (selección Prisma):

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | `number` | PK interna |
| `publicId` | `string` | UUID; coincide con `sub` del JWT |
| `email` | `string` | |
| `createdAt` | `string` (ISO 8601) | |
| `customers` | `array` | Relación; en el flujo actual suele haber **un** elemento |

Cada elemento de `customers`:

| Campo | Tipo |
|-------|------|
| `id` | `number` |
| `email` | `string` |
| `firstName` | `string` |
| `lastName` | `string` |
| `userId` | `number` |

### 3.2 Cliente (`/customers/me`)

| Campo | Tipo |
|-------|------|
| `id` | `number` |
| `email` | `string` |
| `firstName` | `string` |
| `lastName` | `string` |

### 3.3 Cuenta

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | `number` | Identificador en **ruta** `GET/DELETE /accounts/:id` |
| `publicId` | `string` | Identificador estable para operaciones de fondos |
| `balanceMinor` | `number` | Entero **no negativo**; unidades menores (ej. centavos) |
| `currency` | `string` | Código almacenado en BD (ej. `USD`); sin validación ISO extra en API |
| `createdAt` | `string` (ISO 8601) | |
| `updatedAt` | `string` (ISO 8601) | |

### 3.4 Transacción (fragmentos en respuestas)

| Campo | Tipo |
|-------|------|
| `id` | `number` |
| `type` | `string` | `"DEPOSIT"` \| `"WITHDRAWAL"` |
| `amountMinor` | `number` | Entero ≥ 1 |
| `createdAt` | `string` (ISO 8601) | |

### 3.5 Tokens de autenticación

```json
{
  "accessToken": "string",
  "refreshToken": "string"
}
```

---

## 4. Endpoints

### 4.1 `GET /`

- **Auth:** no.
- **Respuesta:** `200 OK`, cuerpo **texto plano**: `Hello World!`

---

### 4.2 `POST /users/login`

- **Auth:** no.
- **Cuerpo:**

```json
{
  "email": "user@example.com",
  "password": "string"
}
```

- **Validación:** `email` formato email; `password` string.
- **200 OK:** objeto **Tokens** (ver §3.5).
- **401 Unauthorized:** credenciales inválidas (`No valid credentials`).

---

### 4.3 `POST /users/register`

- **Auth:** no.
- **Cabecera:** `Idempotency-Key` (UUID), obligatoria.
- **Cuerpo:**

```json
{
  "email": "user@example.com",
  "password": "string",
  "firstName": "string",
  "lastName": "string"
}
```

- **200 OK:** objeto **Usuario** (§3.1).
- **Errores:** validación `400`; idempotencia `400`/`409` según §2; duplicado de email u otras violaciones de BD pueden producir `409`/`500` según Prisma/Nest.

---

### 4.4 `POST /users/refresh`

- **Auth:** no.
- **Cuerpo:**

```json
{
  "refreshToken": "string"
}
```

- **200 OK:** objeto **Tokens** (nuevo access + refresh rotado).
- **401 Unauthorized:** sesión revocada/expirada, reutilización de refresh detectada, u otros mensajes de sesión inválida.
- **404 Not Found:** refresh no reconocido (`No valid refresh token`).

---

### 4.5 `POST /users/logout`

- **Auth:** Bearer JWT (sesión activa).
- **Cuerpo:** ninguno.
- **204 No Content:** sesión revocada; access y refresh de esa sesión dejan de valer (ver §1.1 y §1.3).
- **401 Unauthorized:** token o sesión inválidos (incluye sesión ya revocada si se repite logout con el mismo access tras el primero).

---

### 4.6 `GET /customers/me`

- **Auth:** Bearer JWT.
- **200 OK:** objeto **Cliente** (§3.2).
- **404 Not Found:** usuario o cliente no encontrado.

---

### 4.7 `PATCH /customers/me`

- **Auth:** Bearer JWT.
- **Cuerpo:** al menos **uno** de los campos opcionales:

```json
{
  "email": "user@example.com",
  "firstName": "string",
  "lastName": "string"
}
```

- **200 OK:** objeto **Cliente** actualizado.
- **400 Bad Request:** ningún campo enviado (`At least one field is required`).
- **404 Not Found:** usuario o cliente no encontrado.

---

### 4.8 `DELETE /customers/me`

- **Auth:** Bearer JWT.
- **204 No Content:** perfil cliente eliminado (por reglas Prisma puede cascadear entidades relacionadas según esquema).

---

### 4.9 `GET /accounts`

- **Auth:** Bearer JWT.
- **200 OK:** array de **Cuenta** (§3.3), ordenado por `id` ascendente.

---

### 4.10 `POST /accounts`

- **Auth:** Bearer JWT.
- **Cabecera:** `Idempotency-Key` (UUID), obligatoria.
- **Cuerpo:**

```json
{
  "currency": "USD"
}
```

- `currency`: string de **exactamente 3 caracteres** (código tipo ISO 4217, ej. `USD`).
- La cuenta se crea con **`balanceMinor: 0`**; para ingresar fondos usar `POST /accounts/deposit`.
- **200 OK:** una **Cuenta** (§3.3), mismo shape que cada elemento de `GET /accounts` o `GET /accounts/:id`.
- **404 Not Found:** usuario o cliente no encontrado.

---

### 4.11 `GET /accounts/:id`

- **Auth:** Bearer JWT.
- **Parámetro:** `id` entero — PK interna de cuenta, **debe pertenecer** al cliente del usuario autenticado.
- **200 OK:** una **Cuenta**.
- **404 Not Found:** cuenta inexistente o no propiedad del cliente.

---

### 4.12 `DELETE /accounts/:id`

- **Auth:** Bearer JWT.
- **Cabecera:** `Idempotency-Key` (UUID), obligatoria.
- **Parámetro:** `id` entero — PK interna.
- **204 No Content:** siempre que la petición complete el flujo idempotente (incluye caso en que no exista fila que borrar; la implementación usa `deleteMany`).

---

### 4.13 `POST /accounts/deposit`

- **Auth:** Bearer JWT.
- **Cabecera:** `Idempotency-Key` (UUID), obligatoria.
- **Cuerpo:**

```json
{
  "accountPublicId": "string",
  "amountMinor": 1
}
```

- `amountMinor`: entero **`>= 1`**.
- **200 OK:**

```json
{
  "accountPublicId": "string",
  "transaction": { "id": 0, "type": "DEPOSIT", "amountMinor": 0, "createdAt": "" }
}
```

- **404 Not Found:** cuenta no encontrada o no propiedad del cliente.

---

### 4.14 `POST /accounts/withdraw`

- **Auth:** Bearer JWT.
- **Cabecera:** `Idempotency-Key` (UUID), obligatoria.
- **Cuerpo:** igual forma que depósito (`accountPublicId`, `amountMinor`).

- **200 OK:**

```json
{
  "accountPublicId": "string",
  "transaction": { "id": 0, "type": "WITHDRAWAL", "amountMinor": 0, "createdAt": "" }
}
```

- **404 Not Found:** cuenta no encontrada o no del cliente.
- **409 Conflict:** fondos insuficientes (`Insufficient funds`) u otros errores financieros mapeados desde BD.

---

### 4.15 `POST /accounts/transfer`

- **Auth:** Bearer JWT.
- **Cabecera:** `Idempotency-Key` (UUID), obligatoria.
- **Cuerpo:**

```json
{
  "fromAccountPublicId": "string",
  "toAccountPublicId": "string",
  "amountMinor": 1
}
```

- **Reglas:**
  - `fromAccountPublicId` y `toAccountPublicId` deben ser **distintos** (`400` si son iguales).
  - La cuenta **origen** debe ser del cliente autenticado.
  - La cuenta **destino** debe existir (cualquier cliente).
  - Ambas cuentas deben tener la **misma** `currency` (`409` si no).

- **200 OK:**

```json
{
  "fromAccountPublicId": "string",
  "toAccountPublicId": "string",
  "currency": "string",
  "withdrawal": { "id": 0, "type": "WITHDRAWAL", "amountMinor": 0, "createdAt": "" },
  "deposit": { "id": 0, "type": "DEPOSIT", "amountMinor": 0, "createdAt": "" }
}
```

- **404 Not Found:** cuenta origen/destino no encontrada según reglas anteriores.
- **409 Conflict:** fondos insuficientes, o discrepancia de moneda.

---

## 5. Errores y validación

- **`ValidationPipe`** (global o por ruta): campos desconocidos pueden provocar **`400`** con mensaje de *whitelist*; errores de tipo/formato suelen devolver `message` como array de strings o string único según Nest.
- Códigos usados con frecuencia en esta API: **`400`**, **`401`**, **`404`**, **`409`**, **`500`**.
- Cuerpo típico Nest:

```json
{
  "statusCode": 400,
  "message": "string | string[]",
  "error": "Bad Request"
}
```

---

## 6. Checklist para el cliente

1. Tras `login` o `refresh`, guardar **`accessToken`** y **`refreshToken`** de forma segura.
2. Enviar **`Authorization: Bearer …`** en rutas protegidas.
3. Renovar access con **`POST /users/refresh`** antes de expirar (15 min) o al recibir `401` por expiración.
4. Al cerrar sesión en el cliente, llamar **`POST /users/logout`** con el Bearer actual y descartar ambos tokens en local.
5. Para rutas idempotentes, generar un **UUID por operación de negocio** (no reutilizar entre operaciones distintas) y reutilizarlo solo en **reintentos** de la misma operación.
6. Montos: siempre enteros en **`amountMinor`** / **`balanceMinor`** según reglas de §3.3 y §3.4.
7. Referencias de cuenta en movimientos: usar **`publicId`**, no el `id` numérico de ruta (salvo en `GET/DELETE /accounts/:id`).

---

## 7. Changelog sugerido

Mantén este apartado al evolucionar el contrato (nuevas rutas, cambios de códigos HTTP o campos).

| Versión | Fecha | Cambios |
|---------|--------|---------|
| 1.0.0 | (fecha de publicación) | Contrato inicial alineado con NestJS + Swagger `1.0.0`. |
| 1.1.0 | — | `POST /accounts` idempotente para crear cuenta (`balanceMinor` inicial 0). |
| 1.2.0 | — | JWT con `sessionId`; guard valida sesión; `POST /users/logout` revoca sesión. |
