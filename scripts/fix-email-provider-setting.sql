-- ============================================
-- Fix Email Provider Setting (if needed)
-- ============================================
-- WARNING: Only run this if you've identified an issue with the email_provider setting
-- Review the output from inspect-admin-settings.sql first

-- ============================================
-- Option 1: View current email_provider setting
-- ============================================
SELECT 
    id,
    setting_key,
    jsonb_pretty(setting_value) as current_value
FROM admin_settings
WHERE setting_key = 'email_provider';

-- ============================================
-- Option 2: Delete and recreate (if corrupted)
-- ============================================
-- UNCOMMENT ONLY IF YOU NEED TO RESET THE SETTING
-- This will delete the current email_provider setting
-- You'll need to reconfigure it in /admin/settings/email

/*
DELETE FROM admin_settings
WHERE setting_key = 'email_provider';
*/

-- ============================================
-- Option 3: Update specific fields (if needed)
-- ============================================
-- Example: Fix marketing_provider if it's wrong
-- UNCOMMENT AND MODIFY AS NEEDED

/*
UPDATE admin_settings
SET setting_value = jsonb_set(
    setting_value,
    '{marketing_provider}',
    '"sendgrid"'
)
WHERE setting_key = 'email_provider'
AND (setting_value->>'marketing_provider' IS NULL 
     OR setting_value->>'marketing_provider' != 'sendgrid');
*/

-- ============================================
-- Option 4: Fix null values
-- ============================================
-- Remove null values from JSONB (they can cause issues)

/*
UPDATE admin_settings
SET setting_value = setting_value - 'null'
WHERE setting_key = 'email_provider'
AND setting_value ? 'null';
*/

-- ============================================
-- Option 5: Merge with environment variables (advanced)
-- ============================================
-- This is just a template - modify based on your needs
-- Note: You can't access environment variables directly in SQL
-- This would need to be done in application code

/*
-- Example structure for a complete email_provider setting:
UPDATE admin_settings
SET setting_value = '{
    "provider": "smtp",
    "marketing_provider": "sendgrid",
    "server_host": "smtp.office365.com",
    "server_port": "587",
    "server_user": "hello@brevibrushes.com",
    "server_password": "YOUR_PASSWORD_HERE",
    "from_email": "hello@brevibrushes.com",
    "from_name": "BREVI",
    "sendgrid_api_key": "YOUR_API_KEY_HERE",
    "sendgrid_from_email": "hello@brevibrushes.com",
    "sendgrid_from_name": "BREVI"
}'::jsonb
WHERE setting_key = 'email_provider';
*/

-- ============================================
-- Verification: Check after fix
-- ============================================
SELECT 
    setting_key,
    setting_value->>'provider' as provider,
    setting_value->>'marketing_provider' as marketing_provider,
    CASE 
        WHEN setting_value->>'server_password' IS NOT NULL 
        THEN 'SET (' || LENGTH(setting_value->>'server_password') || ' chars)'
        ELSE 'NOT SET'
    END as smtp_password,
    CASE 
        WHEN setting_value->>'sendgrid_api_key' IS NOT NULL 
        THEN 'SET (' || LENGTH(setting_value->>'sendgrid_api_key') || ' chars)'
        ELSE 'NOT SET'
    END as sendgrid_api_key
FROM admin_settings
WHERE setting_key = 'email_provider';

