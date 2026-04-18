# Litebank API — Functional Overview

This document describes what the Litebank API will do. It is a **practice fintech-style API** (NestJS) focused on **solid REST design**, **token-based auth**, and **correct persistence** of users, sessions, accounts, and money movement.

**Status:** no HTTP routes are implemented yet; this file is the agreed product and technical baseline. Update it when behavior or contracts change.

---

## 1. Stack and persistence

| Layer | Choice |
|--------|--------|
| **Runtime / HTTP** | NestJS |
| **ORM** | [Prisma](https://www.prisma.io/) |
| **Database** | PostgreSQL |

All durable entities that support auth, users, accounts, balances, and transaction history are modeled in Prisma and stored in PostgreSQL.

---

## 2. Authentication — full token model

Auth is **fully token-based**:

| Token | Role | Storage / transport |
|--------|------|---------------------|
| **Access token** | Short-lived credential for API calls | **JWT**; sent by clients as `Authorization: Bearer <access_token>` |
| **Refresh token** | Long-lived credential used only to obtain new access tokens | **Opaque** (random, high-entropy string); **persisted in the database** and tied to a session record |

### 2.1 Session model (refresh side)

- Each refresh token (or session row) is stored in PostgreSQL with fields you will define in Prisma (for example: user reference, token hash, created at, expires at, revoked at, user agent / IP optional).
- **Never** store the raw refresh token in logs; store only a **hash** if you want defense-in-depth against DB leaks.
- **Rotation (recommended):** issuing a new refresh token on refresh and invalidating the previous one reduces replay risk.

### 2.2 Functional behaviors (auth module)

| Capability | Description |
|------------|-------------|
| **Register / sign-up** | Create user with hashed password; optionally return tokens or require login. |
| **Login** | Validate credentials; create session row; return **JWT access** + **opaque refresh**. |
| **Refresh** | Accept refresh token; validate against DB (not revoked, not expired); return new **JWT access** (and optionally rotated refresh). |
| **Logout** | Revoke current session / refresh token in DB so it cannot be reused. |
| **Bearer verification** | Every protected route validates the **JWT** (signature, issuer, audience, expiry), loads identity (e.g. `userId`), and enforces authorization rules. |

### 2.3 Password recovery

| Capability | Description |
|------------|-------------|
| **Request reset** | User submits identifier (e.g. email); API creates a **single-use, time-limited** reset token stored in DB (hashed); response must not confirm whether the email exists (enumeration-safe messaging). |
| **Complete reset** | User submits reset token + new password; validate token; update password hash; invalidate reset token and optionally **revoke all refresh sessions** for that user. |

---

## 3. Authorization model (high level)

- **Authenticated** routes require a valid **Bearer JWT**.
- **User CRUD** and **account CRUD** must enforce **ownership** (or explicit roles if you add admins later): a principal may only read/write their own users/accounts unless you document exceptions.
- **Money movement** is only allowed between accounts the caller is allowed to act on (typically same user).

---

## 4. Users — CRUD

Persisted in PostgreSQL via Prisma.

| Operation | Intent |
|-----------|--------|
| **Create** | Register new user (may overlap with auth “sign-up” depending on how you split modules). |
| **Read** | Fetch user by id (self or policy you define). |
| **Update** | Update allowed profile fields (email, name, etc.) with validation. |
| **Delete** | Prefer **soft delete** or “deactivate” in a financial domain; hard delete only if you define cascade rules for accounts/transactions. |

**Note:** List/search of “all users” is usually **admin-only** or omitted for a retail API; if you only support self-service, document CRUD as “CRUD for the authenticated user’s profile.”

---

## 5. Accounts — CRUD

Accounts belong to a user (foreign key in Prisma).

| Operation | Intent |
|-----------|--------|
| **Create** | Open a new account (type/currency as you model it). |
| **Read** | Get account details by id, scoped to owner. |
| **Update** | Update metadata (e.g. label); not for changing balance directly. |
| **Delete** | Close or archive account; only if balance and pending transactions policy allows. |

---

## 6. Money, balances, and transactions

### 6.1 Balances

| Capability | Description |
|------------|-------------|
| **Show balance** | Return current balance per account from the **source of truth** you choose (e.g. derived from ledger postings or a balance column updated in the same transaction as transfers). |

Use a single monetary representation strategy in Prisma/Postgres (e.g. **integer minor units** or **Decimal** type) and document rounding rules.

### 6.2 Transfers between accounts

| Capability | Description |
|------------|-------------|
| **Transfer** | Move amount from account A to account B in an **atomic** database transaction: validate ownership, sufficient funds, currency match, non-negative amounts; create transaction/ledger rows; update balances consistently. |
| **Idempotency (recommended)** | For transfers, support an idempotency key so retries do not double-post. |

### 6.3 History

| Capability | Description |
|------------|-------------|
| **Transaction history** | List past movements (transfers, fees if any) with filters (account, date range), pagination, stable ordering. |

---

## 7. Cross-cutting API behavior (still in scope)

These support the features above; implement as middleware/guards/filters.

| Area | Functionality |
|------|-----------------|
| **Bearer JWT verification** | Global or per-route guard; uniform `401` / `403` responses. |
| **Validation** | DTO + class-validator (or equivalent) for all inputs. |
| **Errors** | Consistent error body (code, message, optional field errors). |
| **Pagination** | For user lists (if any), accounts list, transaction history. |

---

## 8. Suggested implementation order

1. Prisma schema + PostgreSQL: `User`, password reset tokens, `Session` / `RefreshToken`, `Account`, `Transaction` (or ledger lines).
2. Auth: register, login, refresh, logout; JWT signing config; refresh persistence.
3. Bearer guard wired to users/accounts/transactions.
4. User CRUD (scoped).
5. Account CRUD (scoped).
6. Transfer + balance read + history listing.
7. Password recovery flows.

---

## 9. Explicitly out of scope (for now)

Anything not listed in your baseline (e.g. cards, webhooks, MFA, admin consoles) stays out until you add it here.

---

## 10. Open decisions (fill as you implement)

- JWT claims: `sub` = user id; access TTL; refresh TTL; signing algorithm (e.g. RS256 vs HS256).
- Whether **user CRUD** includes multi-user admin or only **self** profile.
- Ledger shape: single `Transaction` row vs double-entry `LedgerEntry` pairs.
- Currency: single currency vs multi-currency accounts.

Record answers here so the API and Prisma schema stay aligned.
