# Database Migrations

## Fix customer_notes Schema

### Problem
The `customer_notes` table in production may be missing some columns that are expected by the Prisma schema:
- `created_by` (mapped from `adminId`)
- `content` (mapped from `content`)
- `is_pinned` (mapped from `isPinned`)
- `created_at` (mapped from `createdAt`)
- `updated_at` (mapped from `updatedAt`)

### Solution
Run the migration to add missing columns safely.

### How to Run

#### Option 1: Using Prisma Migrate (Recommended)
```bash
# Make sure DATABASE_URL is set in .env.local
npx prisma migrate deploy
```

This will apply all pending migrations including `20260127013910_fix_customer_notes_schema`.

#### Option 2: Using MySQL Client
```bash
mysql -u username -p database_name < prisma/migrations/20260127013910_fix_customer_notes_schema/migration.sql
```

#### Option 3: Using Database Admin Tool
1. Open your database admin tool (phpMyAdmin, MySQL Workbench, etc.)
2. Select your database
3. Open and run the SQL script: `prisma/migrations/20260127013910_fix_customer_notes_schema/migration.sql`

#### Option 4: For Vercel/Production
The migration will be automatically applied when you deploy if you have:
- `DATABASE_URL` set in Vercel environment variables
- Run `npx prisma migrate deploy` in your build process or as a post-deploy hook

### Safety
The migration script is **safe to run multiple times**. It checks if each column/index exists before creating it, so it won't cause errors if columns already exist.

### Verification
After running the migration, verify the schema:
```sql
DESCRIBE customer_notes;
```

Expected columns:
- `id` (INT, PRIMARY KEY)
- `user_id` (INT)
- `created_by` (INT, NULLABLE)
- `content` (TEXT)
- `is_pinned` (BOOLEAN, DEFAULT FALSE)
- `created_at` (DATETIME, DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (DATETIME, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)

### Migration Structure
```
prisma/migrations/
├── 20260127013910_fix_customer_notes_schema/
│   └── migration.sql
├── migration_lock.toml
└── README.md
```
