# Bulk Import Customers Script

## Overview
This document describes how to bulk import customers from CSV files in the `/Dox/customer imports` folder.

## Solution

Since the import API has been fixed to properly save addresses, you can now:

1. **Use the existing import page** at `/admin/customers` to upload each CSV file individually
2. The import API now properly:
   - Checks for existing addresses before inserting
   - Updates existing addresses if found
   - Inserts new addresses if not found
   - Handles duplicate detection by email address

## Files to Import

The following files are in the customer imports folder:
- `88k-not-accept-email copy 2.csv`
- `shopify-2nd-import-not-accept-email.csv`
- `shopify-4rd-import-not-accept-email.csv`
- `shopify-5rd-import-not-accept-email.csv`

## Import Process

1. Navigate to `/admin/customers`
2. Click "Import Customers" button
3. Upload each CSV file one at a time
4. The system will:
   - Check for existing customers by email (case-insensitive)
   - Update existing customers or create new ones
   - Save addresses properly (this was fixed)
   - Skip duplicates automatically

## Address Fix

The import API has been updated to:
- Check if an address exists for the user before inserting
- Update existing addresses instead of failing silently
- Properly link addresses to imported customers

## Verification

After importing, check customer detail pages to verify:
- Addresses are showing correctly
- Phone numbers are displayed
- All customer data is complete

