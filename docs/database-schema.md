# Esquema de base de datos (diagrama ER)

Este archivo es solo documentación: puedes editarlo cuando cambie el modelo. La fuente de verdad del esquema es [`prisma/schema.prisma`](../prisma/schema.prisma).

```mermaid
erDiagram
  users {
    int id PK
    uuid public_id UK
    string email UK
    string password_hash
    datetime created_at
  }

  customers {
    int id PK
    string email
    string first_name
    string last_name
    int user_id FK_UK
  }

  accounts {
    int id PK
    int customer_id FK
    int balance_minor
    string currency
    datetime created_at
    datetime updated_at
  }

  transactions {
    int id PK
    int customer_id FK
    int account_id FK
    enum type
    int amount_minor
    datetime created_at
  }

  sessions {
    int id PK
    int user_id FK
    datetime created_at
    datetime expires_at
    datetime revoked_at
    string device_label
    string ip_address
    string user_agent
  }

  refresh_tokens {
    int id PK
    int session_id FK
    string token_hash
    datetime created_at
    datetime expires_at
    int rotated_from_token_id FK
    datetime rotated_at
  }

  users ||--|| customers
  customers ||--o{ accounts
  customers ||--o{ transactions
  accounts ||--o{ transactions
  users ||--o{ sessions
  sessions ||--o{ refresh_tokens
  refresh_tokens }o--o| refresh_tokens
```

## Relaciones

- **users ↔ customers**: 1:1 (`customers.user_id` único, FK a `users.id`, `ON DELETE CASCADE`).
- **customers → accounts**: 1:N (`accounts.customer_id` → `customers.id`, `ON DELETE CASCADE`).
- **accounts.balance_minor**: entero en minor units (`100 = 1.00`) y con restricción DB `>= 0`.
- **customers → transactions**: 1:N (`transactions.customer_id` → `customers.id`, `ON DELETE CASCADE`).
- **accounts → transactions**: 1:N (`transactions.account_id` → `accounts.id`, `ON DELETE CASCADE`).
- **transactions**: guarda movimientos tipo `DEPOSIT` o `WITHDRAWAL` con `amount_minor > 0`.
- **trigger en DB**: al insertar en `transactions`, un trigger actualiza `accounts.balance_minor` sumando (`DEPOSIT`) o restando (`WITHDRAWAL`).
- **fondos insuficientes**: en `WITHDRAWAL`, el trigger falla con error explícito si la cuenta no tiene saldo suficiente.
- **users → sessions**: 1:N (`sessions.user_id` → `users.id`, `ON DELETE CASCADE`).
- **sessions → refresh_tokens**: 1:N (`refresh_tokens.session_id` → `sessions.id`, `ON DELETE CASCADE`).
- **refresh_tokens → refresh_tokens**: auto-relación de rotación (`rotated_from_token_id` opcional, `ON DELETE SET NULL`).
