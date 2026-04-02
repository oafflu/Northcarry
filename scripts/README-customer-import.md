# Bulk Customer Import from CSV (88k) via SQL Migration

**Important:** Run only the `.sql` files in your SQL editor (Supabase or psql). Do **not** paste this README or any line starting with `#` into the SQL editor—PostgreSQL uses `--` for comments, not `#`.

This flow imports your Shopify-style customer CSV into the database **without losing data**, then into the customer table (profiles + addresses).

## CSV format (Shopify export)

- **Primary data used**: Customer name (First Name, Last Name), Email, Phone, Shipping address (Address1, Address2, City, Province Code, Country Code, Zip).
- Rows **without** a valid email are still loaded into staging (so you don’t lose them); they are skipped when creating customer accounts.

## How we avoid losing data

1. **Staging table** – All CSV rows (including no-email) are inserted into `customer_import_staging`. Nothing is dropped at load time.
2. **Existing customers** – When processing into profiles, existing emails are **updated** (profile + address), not duplicated.
3. **SQL escaping** – The generator escapes quotes and commas so names/addresses with special characters are stored correctly.

## Step 1: Create the staging table

Run the migration in your Supabase SQL editor (or psql):

- **Supabase:** Open **SQL Editor** → New query → open the file `scripts/create_customer_import_staging.sql` and paste **only its contents** (lines starting with `--` and the `CREATE TABLE` / `CREATE INDEX` statements) → Run.
- **psql:** From project root run: `psql $DATABASE_URL -f scripts/create_customer_import_staging.sql`

## Step 2: Generate and run the data SQL

From the **project root**:

```bash
node scripts/generate-customer-import-sql.js "Dox/88k-not-accept-email copy.csv"
```

This creates **45 small files** in `scripts/`:

- `customer_import_staging_data_001.sql` … `customer_import_staging_data_045.sql`
- Each has 2,000 rows (except the last, which has the remainder), so each file is small enough for the **Supabase SQL Editor**.

**In Supabase SQL Editor:** run the parts **in order** (001, then 002, then 003, … 045). For each part: open the file, copy its contents, paste into a new query, and Run.

**Alternatively**, if you use `psql` or another direct DB connection, you can generate one big file and run it once:

```bash
node scripts/generate-customer-import-sql.js "Dox/88k-not-accept-email copy.csv" --single
psql $DATABASE_URL -f scripts/customer_import_staging_data.sql
```

## Step 3: Create customer accounts (profiles + addresses)

Customer accounts in Brevi are **profiles** (with `role = 'customer'`) and **addresses**, and each profile must have an Auth user. You can do this **without the admin frontend** by running a script from the command line.

**Option A – Script (no admin UI)**  
From the project root, with staging table already filled (Step 1 + 2 done):

```bash
node scripts/process-staging-import.js
```

- Reads from `customer_import_staging` where `processed_at` is NULL.
- For each row with a valid email: creates a Supabase Auth user (or finds existing by email), then creates/updates the **profile** and **shipping address**, and sets `processed_at` so the row is not processed again.
- Uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`.

Options:
- `node scripts/process-staging-import.js --limit 100` — process only 100 rows (e.g. for a test run).
- `node scripts/process-staging-import.js --dry-run` — only list what would be processed; no DB changes.

Run the script repeatedly until no unprocessed rows remain (e.g. for 88k rows, run it multiple times or in batches with `--limit`).

**Option B – Admin Import (browser)**  
1. Go to **Admin → Customers** and use **Import Customers**.  
2. Upload the **same CSV** (`88k-not-accept-email copy.csv`).  
3. The import will create/update profiles and addresses by email and skip duplicates.

## Summary

| Step | What runs | Result |
|------|-----------|--------|
| 1 | `create_customer_import_staging.sql` | Table `customer_import_staging` exists |
| 2 | `generate-customer-import-sql.js` + run generated SQL | All CSV rows (including no-email) in staging |
| 3 | Admin Import (same CSV) or process-from-staging script | Profiles + addresses created/updated; no data loss |

Primary fields mapped:

- **Name** → `profiles.first_name`, `profiles.last_name`
- **Email** → `profiles.email`
- **Phone** → `profiles.phone` (and address phone if needed)
- **Shipping** → `addresses.address_line1`, `address_line2`, `city`, `state`, `postal_code`, `country`
