#!/usr/bin/env node
/**
 * Load customers from customer_import_staging into profiles + addresses
 * (creates Supabase Auth users, then profiles and addresses).
 * No admin frontend needed — run from the command line.
 *
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/process-staging-import.js
 *   node scripts/process-staging-import.js --limit 100   (process only 100 rows)
 *   node scripts/process-staging-import.js --dry-run     (show what would be done)
 */

const path = require("path");
const fs = require("fs");

// Load .env.local from project root
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].replace(/^["']|["']$/g, "").trim();
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set in .env.local or environment.");
  process.exit(1);
}

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function cleanPhone(phone) {
  if (!phone || typeof phone !== "string") return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned.length > 0 ? cleaned : null;
}

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : null;
const dryRun = args.includes("--dry-run");

const FETCH_PAGE_SIZE = 1000; // Supabase default max per request

async function main() {
  console.log("Counting unprocessed rows in customer_import_staging...");
  const countQuery = supabase
    .from("customer_import_staging")
    .select("id", { count: "exact", head: true })
    .is("processed_at", null)
    .not("email", "is", null);
  const { count: totalUnprocessed, error: countError } = await countQuery;
  if (countError) {
    console.error("Failed to count staging rows:", countError.message);
    process.exit(1);
  }
  const totalToProcess = limit ? Math.min(limit, totalUnprocessed || 0) : totalUnprocessed || 0;
  if (totalToProcess === 0) {
    console.log("No unprocessed rows with email found. Done.");
    return;
  }
  console.log(`Found ${totalToProcess} rows to process. Dry run: ${dryRun}`);

  let imported = 0;
  let updated = 0;
  let errors = 0;
  const BATCH_SIZE = 5;
  const start = Date.now();
  let processedSoFar = 0;

  while (processedSoFar < totalToProcess) {
    const fetchSize = Math.min(FETCH_PAGE_SIZE, totalToProcess - processedSoFar);
    const { data: rows, error: fetchError } = await supabase
      .from("customer_import_staging")
      .select("id, source_customer_id, first_name, last_name, email, phone, address_line1, address_line2, city, state, country_code, postal_code, default_address_phone")
      .is("processed_at", null)
      .not("email", "is", null)
      .order("created_at", { ascending: true })
      .limit(fetchSize);

    if (fetchError) {
      console.error("Failed to fetch staging rows:", fetchError.message);
      process.exit(1);
    }
    if (!rows || rows.length === 0) break;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      for (const row of batch) {
        const email = (row.email || "").toLowerCase().trim();
        if (!email || !email.includes("@")) {
          await supabase.from("customer_import_staging").update({ processed_at: new Date().toISOString() }).eq("id", row.id);
          continue;
        }

        if (dryRun) {
          console.log(`[dry-run] Would process: ${email}`);
          continue;
        }

        try {
          const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
          let userId;

          if (existingProfile) {
            userId = existingProfile.id;
            const updateData = {};
            if (row.first_name) updateData.first_name = row.first_name;
            if (row.last_name) updateData.last_name = row.last_name;
            const ph = cleanPhone(row.phone || row.default_address_phone);
            if (ph) updateData.phone = ph;
            if (Object.keys(updateData).length > 0) {
              await supabase.from("profiles").update(updateData).eq("id", userId);
            }
            updated++;
          } else {
            const tempPassword = `Temp${Math.random().toString(36).slice(-12)}!${Date.now()}`;
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
              email,
              password: tempPassword,
              email_confirm: true,
            });
            if (authError || !authData?.user) {
              console.error(`Create user failed for ${email}:`, authError?.message);
              errors++;
              continue;
            }
            userId = authData.user.id;
            const ph = cleanPhone(row.phone || row.default_address_phone);
            const { error: profileError } = await supabase.from("profiles").insert({
              id: userId,
              email,
              first_name: row.first_name || null,
              last_name: row.last_name || null,
              phone: ph,
              role: "customer",
            });
            if (profileError) {
              console.error(`Profile insert failed for ${email}:`, profileError.message);
              try { await supabase.auth.admin.deleteUser(userId); } catch (_) {}
              errors++;
              continue;
            }
            imported++;
          }

          if (userId && (row.address_line1 || row.city)) {
            const addressData = {
              user_id: userId,
              type: "shipping",
              is_default: true,
              address_line1: (row.address_line1 || "").trim() || "",
              address_line2: (row.address_line2 || "").trim() || null,
              city: (row.city || "").trim() || "",
              state: (row.state || "").trim() || "",
              postal_code: (row.postal_code || "").trim() || "",
              country: (row.country_code || "US").trim() || "US",
            };
            const { data: existingAddr } = await supabase
              .from("addresses")
              .select("id")
              .eq("user_id", userId)
              .eq("type", "shipping")
              .eq("is_default", true)
              .limit(1)
              .maybeSingle();
            if (existingAddr) {
              await supabase.from("addresses").update(addressData).eq("id", existingAddr.id);
            } else {
              await supabase.from("addresses").insert(addressData);
            }
          }

          await supabase.from("customer_import_staging").update({ processed_at: new Date().toISOString() }).eq("id", row.id);
        } catch (err) {
          console.error(`Error processing ${email}:`, err.message);
          errors++;
        }
      }
      if ((i + BATCH_SIZE) % 100 < BATCH_SIZE) {
        const currentInPage = Math.min(i + BATCH_SIZE, rows.length);
        console.log(`Progress: ${processedSoFar + currentInPage}/${totalToProcess} — imported ${imported}, updated ${updated}, errors ${errors}`);
      }
    }
    processedSoFar += rows.length;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s. Imported: ${imported}, Updated: ${updated}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
