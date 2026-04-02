-- ============================================
-- Inspect admin_settings Table
-- ============================================
-- This script helps diagnose email provider configuration issues
-- Run this in your Supabase SQL Editor or database client

-- ============================================
-- 1. Show table structure
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'admin_settings'
ORDER BY ordinal_position;

-- ============================================
-- 2. Show all settings (full table content)
-- ============================================
SELECT 
    id,
    setting_key,
    setting_category,
    description,
    created_at,
    updated_at,
    -- Show setting_value (this is JSONB, so it might be large)
    setting_value,
    -- Show a preview of setting_value (first 200 characters)
    LEFT(setting_value::text, 200) as setting_value_preview
FROM admin_settings
ORDER BY setting_category, setting_key;

-- ============================================
-- 3. Show email_provider setting specifically (EXACT DATA)
-- ============================================
SELECT 
    id,
    setting_key,
    setting_category,
    description,
    created_at,
    updated_at,
    -- Full JSONB value (raw)
    setting_value,
    -- Pretty formatted JSON (readable)
    jsonb_pretty(setting_value) as setting_value_formatted
FROM admin_settings
WHERE setting_key = 'email_provider';

-- ============================================
-- 3b. Show EXACT values from email_provider (all fields visible)
-- ============================================
SELECT 
    '=== EXACT EMAIL PROVIDER DATA ===' as section,
    setting_key,
    -- Provider settings
    setting_value->>'provider' as provider,
    setting_value->>'marketing_provider' as marketing_provider,
    -- SMTP settings (EXACT VALUES)
    setting_value->>'server_host' as server_host,
    setting_value->>'server_port' as server_port,
    setting_value->>'server_user' as server_user,
    setting_value->>'server_password' as server_password,  -- SHOWS ACTUAL PASSWORD
    setting_value->>'from_email' as from_email,
    setting_value->>'from_name' as from_name,
    -- SendGrid settings (EXACT VALUES)
    setting_value->>'sendgrid_api_key' as sendgrid_api_key,  -- SHOWS ACTUAL API KEY
    setting_value->>'api_key' as api_key,  -- Alternative field name
    setting_value->>'sendgrid_from_email' as sendgrid_from_email,
    setting_value->>'sendgrid_from_name' as sendgrid_from_name,
    -- Full JSON as text
    setting_value::text as full_json_text
FROM admin_settings
WHERE setting_key = 'email_provider';

-- ============================================
-- 4. Extract specific fields from email_provider JSON (with status)
-- ============================================
SELECT 
    setting_key,
    -- Provider type
    setting_value->>'provider' as provider,
    setting_value->>'marketing_provider' as marketing_provider,
    -- SMTP settings
    setting_value->>'server_host' as smtp_host,
    setting_value->>'server_port' as smtp_port,
    setting_value->>'server_user' as smtp_user,
    -- Password (masked for security)
    CASE 
        WHEN setting_value->>'server_password' IS NOT NULL 
        THEN '***SET*** (' || LENGTH(setting_value->>'server_password') || ' chars)'
        ELSE 'NOT SET'
    END as smtp_password_status,
    setting_value->>'from_email' as smtp_from_email,
    setting_value->>'from_name' as smtp_from_name,
    -- SendGrid settings
    CASE 
        WHEN setting_value->>'sendgrid_api_key' IS NOT NULL 
        THEN '***SET*** (' || LENGTH(setting_value->>'sendgrid_api_key') || ' chars)'
        ELSE 'NOT SET'
    END as sendgrid_api_key_status,
    setting_value->>'sendgrid_from_email' as sendgrid_from_email,
    setting_value->>'sendgrid_from_name' as sendgrid_from_name,
    -- Check if SendGrid is configured
    CASE 
        WHEN (setting_value->>'marketing_provider' = 'sendgrid' OR setting_value->>'provider' = 'sendgrid')
             AND (setting_value->>'sendgrid_api_key' IS NOT NULL OR setting_value->>'api_key' IS NOT NULL)
        THEN 'YES'
        ELSE 'NO'
    END as sendgrid_configured,
    -- Check if SMTP is configured
    CASE 
        WHEN setting_value->>'server_user' IS NOT NULL 
             AND setting_value->>'server_password' IS NOT NULL
        THEN 'YES'
        ELSE 'NO'
    END as smtp_configured
FROM admin_settings
WHERE setting_key = 'email_provider';

-- ============================================
-- 5. Show all email-related settings
-- ============================================
SELECT 
    setting_key,
    setting_category,
    LEFT(setting_value::text, 100) as setting_value_preview,
    created_at,
    updated_at
FROM admin_settings
WHERE setting_key LIKE '%email%'
   OR setting_category = 'email'
ORDER BY setting_key;

-- ============================================
-- 6. Check for duplicate or orphaned settings
-- ============================================
SELECT 
    setting_key,
    COUNT(*) as count,
    array_agg(id::text) as ids,
    array_agg(created_at::text) as created_dates
FROM admin_settings
GROUP BY setting_key
HAVING COUNT(*) > 1;

-- ============================================
-- 7. Show raw JSON structure of email_provider
-- ============================================
-- This shows the exact JSON structure stored
SELECT 
    setting_key,
    jsonb_pretty(setting_value) as full_json_structure
FROM admin_settings
WHERE setting_key = 'email_provider';

-- ============================================
-- 8. Diagnostic: Check for common issues
-- ============================================
SELECT 
    'Email Provider Configuration Diagnostics' as diagnostic,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM admin_settings WHERE setting_key = 'email_provider')
        THEN '❌ email_provider setting does not exist'
        ELSE '✅ email_provider setting exists'
    END as setting_exists,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM admin_settings 
            WHERE setting_key = 'email_provider' 
            AND setting_value->>'server_password' IS NULL
        )
        THEN '⚠️ SMTP password is NOT set'
        ELSE '✅ SMTP password is set'
    END as smtp_password_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM admin_settings 
            WHERE setting_key = 'email_provider' 
            AND (setting_value->>'marketing_provider' = 'sendgrid' OR setting_value->>'provider' = 'sendgrid')
            AND setting_value->>'sendgrid_api_key' IS NULL
            AND setting_value->>'api_key' IS NULL
        )
        THEN '⚠️ SendGrid is selected but API key is NOT set'
        ELSE '✅ SendGrid API key status OK'
    END as sendgrid_api_key_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM admin_settings 
            WHERE setting_key = 'email_provider' 
            AND setting_value::text LIKE '%null%'
        )
        THEN '⚠️ Contains null values (may cause issues)'
        ELSE '✅ No null values detected'
    END as null_values_check;

