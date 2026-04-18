# Hospital Management System

A Next.js hospital management app for patients, medicines, and billing.

## Tech Stack

- **Framework** — Next.js 16 (App Router)
- **Database** — PostgreSQL (Docker or Neon)
- **ORM** — Prisma 7
- **Styling** — Tailwind CSS v4

---

## Quick Start (Docker — offline / local)

### 1. Copy environment file
```bash
cp env.example .env
```

> For Docker the default values in `env.example` work out of the box.  
> Change `DASHBOARD_PIN` to any 4-digit number you want.

### 2. Start the database
```bash
docker compose up -d
```

### 3. Run migrations
```bash
npx prisma migrate dev --name init
```

### 4. Start the dev server
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Rebuild Docker app image (after code changes)
```bash
docker compose up -d --build
```

---

## Database Commands

| Command | Description |
|---|---|
| `npx prisma migrate dev --name <name>` | Create & apply a new migration |
| `npx prisma migrate deploy` | Apply pending migrations (production) |
| `npx prisma studio` | Open visual DB browser at port 5555 |
| `pnpm db:seed` | Seed with 1 000 patients + 60 medicines + bills |

---

## Seed the Database

To populate the database with realistic test data (1 000 patients, 60 medicines, ~1 200 bills):

```bash
pnpm db:seed
```

> **Warning:** The seed script **clears all existing data** before inserting.
>
> What gets seeded:
> - 🏥 **60 medicines** across all categories (Antibiotic, Antihistamine, Steroid, etc.) with realistic buying/selling prices and stock
> - 👤 **1 000 patients** with Indian names, diagnoses, phone numbers, and visit dates spread over the last 90 days
> - 🧾 **~1 200–1 500 bills** (1–2 per patient) each containing a consultation, optional services (Endoscopy, Radiology, etc.), and 1–4 medicine items — with cash/online payment split

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/hospital?schema=public` |
| `DASHBOARD_PIN` | 4-digit PIN to lock the analytics dashboard | `0000` |

---

## Project Structure

```
app/
  api/           → REST API routes (patients, medicines, bills, dashboard)
  bills/         → Bill management UI
  dashboard/     → PIN-locked analytics dashboard
  medicines/     → Medicine inventory UI
  patients/      → Patient registry UI
prisma/
  schema.prisma  → Database schema
  migrations/    → Migration history
  seed.ts        → Test data seeder
```



## 💾 Database Backup & Restore

Since the application uses a Dockerized PostgreSQL database, you can safely create and restore backups directly through the active container without needing any local PostgreSQL installations.

### 1. Create a Backup
This generates a compressed database dump and extracts it to a local `backups/` folder.

```bash
# 1. Generate the backup file inside the container
docker exec -t hospital-management-db-1 pg_dump -U postgres -d hospital -F c -f /tmp/hospital.dump

# 2. Extract it to your local system (create the folder if necessary)
mkdir -p backups
docker cp hospital-management-db-1:/tmp/hospital.dump backups/hospital.dump
```

### 2. Restore from a Backup
> **⚠️ Warning:** The restore command uses the `-c` flag which drops existing database tables before restoring. Current data will be fully overwritten.

```bash
# 1. Copy the local backup file into the running container
docker cp backups/hospital.dump hospital-management-db-1:/tmp/hospital.dump

# 2. Execute the restore process
docker exec -t hospital-management-db-1 pg_restore -U postgres -d hospital -c /tmp/hospital.dump
```