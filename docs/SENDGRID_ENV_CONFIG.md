# SendGrid Environment Variable Configuration

## Overview

SendGrid configuration can be set in two ways:
1. **Database Settings** (Primary) - via `/admin/settings/email` page
2. **Environment Variables** (Fallback) - via `.env.local` file

## Environment Variables

Add these to your `.env.local` file:

```env
# SendGrid API Key (for marketing emails)
SENDGRID_API_KEY=SG.your-sendgrid-api-key-here

# Alternative variable name (also supported):
EMAIL_SENDGRID_API_KEY=SG.your-sendgrid-api-key-here
```

## Priority Order

The system checks for SendGrid API key in this order:

1. **Database Settings** (`admin_settings` table)
   - `sendgrid_api_key` field
   - Configured via `/admin/settings/email` page
   - **This takes priority over environment variables**

2. **Environment Variables** (fallback)
   - `SENDGRID_API_KEY`
   - `EMAIL_SENDGRID_API_KEY`
   - Used only if database settings are not configured

## How to Get Your SendGrid API Key

1. Go to SendGrid Dashboard: https://app.sendgrid.com
2. Navigate to: **Settings** → **API Keys**
3. Click **"Create API Key"**
4. Choose **"Full Access"** or **"Restricted Access"** with "Mail Send" permission
5. Copy the API key (starts with `SG.`)
6. **Important**: You can only see the key once - copy it immediately!

## Configuration Methods

### Method 1: Database Settings (Recommended)

1. Go to `/admin/settings/email` in your admin panel
2. Under "Marketing Email Provider (SendGrid)" section:
   - Set "Marketing Email Provider" to "SendGrid"
   - Enter your SendGrid API Key
   - Enter "From Email Address" (must be verified in SendGrid)
   - Enter "From Name"
3. Click "Save Settings"

**Advantages:**
- Can be changed without redeploying
- Stored securely in database
- Can be updated via admin panel

### Method 2: Environment Variables

1. Add to `.env.local`:
   ```env
   SENDGRID_API_KEY=SG.your-api-key-here
   ```

2. Restart your development server or redeploy

**Advantages:**
- Version controlled (if using `env.example`)
- Can be different per environment (dev/staging/prod)
- Works well with CI/CD pipelines

## Current Configuration Check

To see which configuration is being used:

1. Visit: `/api/admin/email-config/debug`
2. Check the response:
   - `hasSendgridApiKeyField`: true if set in database
   - `hasEnvKey`: true if set in environment variables
   - `hasSendGridApiKey`: true if API key is available from any source
   - `actuallyUseSendGrid`: true if SendGrid will be used

## Important Notes

1. **Database settings take priority** - If you set SendGrid API key in `/admin/settings/email`, it will override environment variables

2. **Sender Email Verification** - The "From Email Address" must be verified in SendGrid:
   - Go to: https://app.sendgrid.com/settings/sender_auth
   - Verify the email address you're using
   - This is required even if API key is set

3. **API Key Permissions** - The API key must have "Mail Send" permission:
   - "Full Access" works
   - "Restricted Access" with "Mail Send" permission works
   - Without "Mail Send" permission, emails will fail

4. **Security** - Never commit `.env.local` to version control:
   - Add `.env.local` to `.gitignore`
   - Use `env.example` for documentation
   - Use environment variables in production (Vercel, etc.)

## Troubleshooting

### SendGrid not working even with API key set

1. Check API key is correct:
   - Should start with `SG.`
   - Should be the full key (not truncated)

2. Check API key permissions:
   - Must have "Mail Send" permission
   - Regenerate if needed

3. Check sender email verification:
   - Email must be verified in SendGrid
   - Must match exactly (case-sensitive)

4. Check which configuration is active:
   - Visit `/api/admin/email-config/debug`
   - See which source is providing the API key

### Environment variable not being used

- Database settings take priority
- If API key is set in `/admin/settings/email`, environment variables are ignored
- Remove from database settings to use environment variables

