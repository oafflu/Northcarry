#!/usr/bin/env node
/**
 * Reads a Shopify-style customer CSV and generates SQL INSERT statements
 * for the customer_import_staging table. Run the staging table migration first,
 * then run this script, then execute the generated .sql file.
 *
 * Usage:
 *   node scripts/generate-customer-import-sql.js "<path-to-csv>"
 *     -> Writes customer_import_staging_data_001.sql, _002.sql, ... (small enough for SQL Editor)
 *   node scripts/generate-customer-import-sql.js "<path-to-csv>" --single
 *     -> One big file (use psql; too large for SQL Editor)
 *   node scripts/generate-customer-import-sql.js "<path-to-csv>" --stdout  -> print SQL to stdout
 *
 * Keeps ALL rows (including those without email) so no data is lost.
 */

const fs = require("fs");
const path = require("path");

function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function escapeSql(str) {
  if (str == null || str === "") return null;
  const s = String(str).replace(/\\/g, "\\\\").replace(/'/g, "''");
  return s;
}

function sqlValue(val) {
  if (val == null || val === "") return "NULL";
  return "'" + escapeSql(val) + "'";
}

function main() {
  const csvPath = process.argv[2];
  const outStdout = process.argv.includes("--stdout");
  if (!csvPath) {
    console.error("Usage: node scripts/generate-customer-import-sql.js \"<path-to-csv>\" [--stdout]");
    process.exit(1);
  }
  const absolutePath = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  if (!fs.existsSync(absolutePath)) {
    console.error("File not found:", absolutePath);
    process.exit(1);
  }

  const csvText = fs.readFileSync(absolutePath, "utf-8");
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length < 2) {
    console.error("CSV has no data rows.");
    process.exit(1);
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const getIdx = (name) => {
    const lower = name.toLowerCase();
    const i = headers.findIndex((h) => h.toLowerCase().includes(lower));
    return i >= 0 ? i : -1;
  };

  const customerIdIdx = getIdx("Customer ID");
  const firstNameIdx = getIdx("First Name");
  const lastNameIdx = getIdx("Last Name");
  const emailIdx = getIdx("Email");
  const address1Idx = getIdx("Default Address Address1");
  const address2Idx = getIdx("Default Address Address2");
  const cityIdx = getIdx("Default Address City");
  const stateIdx = getIdx("Default Address Province Code");
  const countryIdx = getIdx("Default Address Country Code");
  const zipIdx = getIdx("Default Address Zip");
  const addressPhoneIdx = getIdx("Default Address Phone");
  const phoneIdx = getIdx("Phone");
  const totalSpentIdx = getIdx("Total Spent");
  const totalOrdersIdx = getIdx("Total Orders");
  const acceptsEmailIdx = getIdx("Accepts Email Marketing");
  const tagsIdx = getIdx("Tags");

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cleanLine = line.startsWith("'") ? line.slice(1) : line;
    const values = parseCSVLine(cleanLine);
    while (values.length < headers.length) values.push("");

    const get = (idx) => (idx >= 0 && values[idx] !== undefined ? values[idx].trim() : "");
    const stripLeadingQuote = (s) => (s && s.startsWith("'") && s.length > 1 ? s.slice(1) : s);
    let zip = get(zipIdx);
    if (zip.startsWith("'")) zip = zip.slice(1);
    const email = get(emailIdx);
    const rawPhone = get(phoneIdx) || get(addressPhoneIdx);
    const phone = stripLeadingQuote(rawPhone);
    const defaultAddressPhone = stripLeadingQuote(get(addressPhoneIdx));
    rows.push({
      source_customer_id: get(customerIdIdx),
      first_name: get(firstNameIdx),
      last_name: get(lastNameIdx),
      email: email === "" ? null : email.toLowerCase(),
      phone: phone || null,
      address_line1: get(address1Idx),
      address_line2: get(address2Idx),
      city: get(cityIdx),
      state: get(stateIdx),
      country_code: get(countryIdx) || "US",
      postal_code: zip,
      default_address_phone: defaultAddressPhone || null,
      total_spent: get(totalSpentIdx),
      total_orders: get(totalOrdersIdx),
      accepts_email_marketing: get(acceptsEmailIdx),
      tags: get(tagsIdx),
    });
  }

  const BATCH = 500;
  const ROWS_PER_FILE = 2000; // Keep each file small enough for Supabase SQL Editor
  const singleFile = process.argv.includes("--single");

  const insertHeader =
    "INSERT INTO customer_import_staging (source_customer_id, first_name, last_name, email, phone, address_line1, address_line2, city, state, country_code, postal_code, default_address_phone, total_spent, total_orders, accepts_email_marketing, tags) VALUES";

  function batchToSql(batch) {
    return batch
      .map(
        (r) =>
          "(" +
          [
            sqlValue(r.source_customer_id),
            sqlValue(r.first_name),
            sqlValue(r.last_name),
            sqlValue(r.email),
            sqlValue(r.phone),
            sqlValue(r.address_line1),
            sqlValue(r.address_line2),
            sqlValue(r.city),
            sqlValue(r.state),
            sqlValue(r.country_code),
            sqlValue(r.postal_code),
            sqlValue(r.default_address_phone),
            sqlValue(r.total_spent),
            sqlValue(r.total_orders),
            sqlValue(r.accepts_email_marketing),
            sqlValue(r.tags),
          ].join(",") +
          ")"
      )
      .join(",\n");
  }

  if (outStdout) {
    const out = [];
    out.push("-- Generated from " + path.basename(absolutePath) + " - " + rows.length + " rows\n");
    for (let b = 0; b < rows.length; b += BATCH) {
      const batch = rows.slice(b, b + BATCH);
      out.push(insertHeader + "\n" + batchToSql(batch) + ";\n");
    }
    process.stdout.write(out.join("\n"));
    return;
  }

  const scriptsDir = path.join(process.cwd(), "scripts");
  if (singleFile) {
    const out = [];
    out.push("-- Generated from " + path.basename(absolutePath) + " - " + rows.length + " rows");
    out.push("-- Run via psql: psql $DATABASE_URL -f scripts/customer_import_staging_data.sql");
    out.push("-- (Too large for Supabase SQL Editor; use --split for editor-sized files.)\n");
    for (let b = 0; b < rows.length; b += BATCH) {
      const batch = rows.slice(b, b + BATCH);
      out.push(insertHeader + "\n" + batchToSql(batch) + ";\n");
    }
    fs.writeFileSync(path.join(scriptsDir, "customer_import_staging_data.sql"), out.join("\n"), "utf-8");
    console.log("Wrote " + rows.length + " rows to scripts/customer_import_staging_data.sql (single file; use psql to run it).");
    return;
  }

  let fileIndex = 1;
  let rowsInFile = 0;
  let fileLines = [];
  const pad = (n) => String(n).padStart(3, "0");

  for (let b = 0; b < rows.length; b += BATCH) {
    if (rowsInFile >= ROWS_PER_FILE && fileLines.length > 0) {
      const outPath = path.join(scriptsDir, "customer_import_staging_data_" + pad(fileIndex) + ".sql");
      const header =
        "-- Part " +
        fileIndex +
        " of customer import (" +
        rowsInFile +
        " rows). Run create_customer_import_staging.sql first, then run part 001, 002, 003... in order.\n";
      fs.writeFileSync(outPath, header + fileLines.join("\n"), "utf-8");
      console.log("Wrote " + outPath + " (" + rowsInFile + " rows)");
      fileIndex++;
      rowsInFile = 0;
      fileLines = [];
    }
    const batch = rows.slice(b, b + BATCH);
    fileLines.push(insertHeader + "\n" + batchToSql(batch) + ";\n");
    rowsInFile += batch.length;
  }
  if (fileLines.length > 0) {
    const outPath = path.join(scriptsDir, "customer_import_staging_data_" + pad(fileIndex) + ".sql");
    const header =
      "-- Part " +
      fileIndex +
      " of customer import (" +
      rowsInFile +
      " rows). Run in Supabase SQL Editor after earlier parts.\n";
    fs.writeFileSync(outPath, header + fileLines.join("\n"), "utf-8");
    console.log("Wrote " + outPath + " (" + rowsInFile + " rows)");
  }
  console.log("Total: " + rows.length + " rows in " + fileIndex + " file(s). Run each part in order in the SQL Editor.");
}

main();
