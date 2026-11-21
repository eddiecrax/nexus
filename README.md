# Nexus Library Management System

A full-stack **Client-Server Library Management System** built with **Next.js (TypeScript)**, **Node.js + Express.js**, and **PostgreSQL**.

Unlike simple stateless CRUD apps, Nexus models a book loan as a **long-duration, multi-week state machine** (`pending` → `active` → `returned` / `overdue` → `fines`) with strict concurrency control so two patrons can never borrow the same physical copy at the same time.

---

## Tech Stack

| Layer | Technology | Port | Purpose |
|---|---|---|---|
| **Client** | Next.js 16, React 19, TypeScript, Tailwind CSS | `:3000` | Single-page web UI & OPAC |
| **Server** | Node.js, Express.js, `pg`, `jsonwebtoken`, `bcryptjs` | `:4000` | REST API, auth, RBAC, transactions |
| **Database** | PostgreSQL 17 | `:5432` | Relational storage, ACID, MVCC, row locks |

---

## Project Structure

```text
nexus-library-management-system/
├── app/                     # Next.js App Router pages
│   ├── login/page.tsx       # Login page (wired to POST /api/auth/login)
│   └── (dashboard)/         # Dashboard shell & feature pages (books, circulation, fines, etc.)
├── components/              # Reusable UI & feature dialogs
├── lib/
│   ├── api.ts               # Shared fetch wrapper (credentials: "include" for HttpOnly cookies)
│   └── mocks/               # Mock seed data for un-wired dashboard pages
├── server/
│   ├── db/
│   │   ├── schema.sql       # PostgreSQL tables, constraints, and indexes
│   │   └── pool.js          # pg.Pool connection pool & withTransaction() helper
│   ├── middleware/
│   │   └── auth.js          # HttpOnly JWT cookie helpers, requireAuth, requireRole (RBAC)
│   ├── .env.example         # Environment variable template
│   ├── package.json         # Backend dependencies (express, pg, dotenv, cors, cookie-parser, jsonwebtoken, bcryptjs)
│   └── index.js             # Express app, routes, rate limiter, central error handler
├── ARCHITECTURE.md          # Plain-English guide mapping lecture concepts to code
└── README.md
```

---

## Database Schema (`server/db/schema.sql`)

All timestamps use `TIMESTAMPTZ` (UTC) to avoid timezone drift.

- **`users`**: Patrons and staff (`id`, `username`, `email`, `password_hash`, `role`: `'member' | 'librarian' | 'admin'`, `created_at`).
- **`books`**: Abstract book titles/works (`id`, `title`, `author`, `isbn`, `published_year`, `created_at`).
- **`copies`**: Individual physical, barcoded copies (`id`, `book_id`, `barcode`, `status`: `'available' | 'loaned' | 'reserved' | 'lost' | 'damaged'`, `created_at`).
- **`loans`**: Loan state machine (`id`, `copy_id`, `user_id`, `status`: `'pending' | 'active' | 'returned' | 'overdue'`, `issued_at`, `due_at`, `returned_at`). Includes partial unique index `uniq_open_loan_per_copy` so a physical copy can only have one open loan at a time.
- **`fines`**: Auditable overdue penalty records (`id`, `loan_id`, `user_id`, `amount_cents`, `status`: `'outstanding' | 'paid' | 'waived'`, `created_at`, `paid_at`).

---

## Local Setup & Running

### 1. Start PostgreSQL & Create Database
```bash
sudo systemctl start postgresql@17-main
sudo -u postgres createdb nexus_lms
psql "postgres://postgres:postgres@localhost:5432/nexus_lms" -f server/db/schema.sql
```

### 2. Configure & Start the Express Backend (`:4000`)
```bash
cd server
cp .env.example .env
# Edit server/.env and set DATABASE_URL, CLIENT_ORIGIN=http://localhost:3000, and a random JWT_SECRET
npm install
npm start
```
Verify the backend is healthy:
```bash
curl http://localhost:4000/health
# {"status":"ok","db":"connected"}
```

### 3. Start the Next.js Frontend (`:3000`)
From the repository root:
```bash
npm install
npm run dev
```
*(If Turbopack cannot load native SWC bindings on your machine, run `npx next dev --webpack` instead.)*

Open `http://localhost:3000/login` in your browser.

---

## REST API Reference (`http://localhost:4000`)

All errors return a consistent JSON shape: `{ "error": { "code": "...", "message": "..." } }`.

### Health
- `GET /health` — Verifies Express and PostgreSQL connectivity (`SELECT 1`).

### Authentication (`HttpOnly` JWT Cookie)
- `POST /api/auth/register` — Creates a `'member'` account (`bcrypt` cost 10), sets `nexus_token` cookie.
- `POST /api/auth/login` — Rate-limited (10 attempts / 15 min per IP), verifies `bcrypt` hash, sets `nexus_token` cookie.
- `POST /api/auth/logout` — Clears `nexus_token` cookie.
- `GET /api/auth/me` — *(Auth required)* Returns the currently logged-in user.

### Books & Physical Copies
- `GET /api/books` — Lists books with live `total_copies` and `available_copies` (MVCC non-blocking read).
- `GET /api/books/:id/copies` — *(Auth required)* Lists physical copies and statuses for a book.
- `POST /api/books` — *(Staff only: `librarian` / `admin`)* Atomically creates a book and `copyCount` physical copies.

### Loans (ACID Transactions + `SELECT ... FOR UPDATE`)
- `GET /api/loans` — *(Auth required)* Members see their own loans; staff see all loans.
- `POST /api/loans/checkout` — *(Auth required)* Locks copy row with `FOR UPDATE`, creates active loan, marks copy `'loaned'`. Returns `409 COPY_UNAVAILABLE` if already loaned.
- `POST /api/loans/:id/return` — *(Auth required, owner or staff)* Marks loan `'returned'`, frees copy to `'available'`, and automatically creates a `fines` record if returned past `due_at`.

### Fines
- `GET /api/fines` — *(Auth required)* Members see their own fines; staff see all fines.
- `POST /api/fines/:id/pay` — *(Staff only: `librarian` / `admin`)* Marks an outstanding fine `'paid'` with `paid_at = NOW()`.

---

## Architecture Concepts

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for a plain-English walkthrough of how **3-Tier Client-Server**, **Middleware**, **Concurrency (`pg.Pool`, `withTransaction`, `SELECT ... FOR UPDATE`, MVCC)**, **Sockets**, and **RPC/RMI** are implemented in this codebase.

---

## Current Scope Notes

- **Live end-to-end:** PostgreSQL + Express API + `/login` (`app/login/page.tsx` via `lib/api.ts`).
- **Still mocked in UI:** Dashboard pages (`books`, `circulation`, `fines`, `members`, `authors`, `publishers`, `membership-plans`) still use `lib/mocks/` + `localStorage`, and `copies` / `reservations` pages are placeholders.

---

## Project Information

- **Group:** Nexus
- **Author:** Namanya Mervyn
