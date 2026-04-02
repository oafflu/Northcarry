# Supabase Email Configuration Guide

## Problem

By default, Supabase sends authentication emails (password reset, magic links, etc.) using their own email service with:
- **Sender**: "Supabase Auth" <noreply@mail.app.supabase.io>
- **Redirect URLs**: Uses the site URL configured in Supabase dashboard (may be localhost in development)

## Solution

We've implemented a custom email system that:
1. ✅ Uses your branded email (BREVI) with your SMTP configuration
2. ✅ Normalizes all URLs to use production domain
3. ✅ Provides consistent branding across all emails

## Configuration Steps

### 1. Configure Supabase Site URL ⚠️ CRITICAL

**This is the most important step!** Supabase uses the Site URL to generate magic links and password reset links. If this is set to localhost, all links will contain localhost even if you pass redirectTo.

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Select your project**
3. **Navigate to**: **Settings** → **Auth** → **URL Configuration**
4. **Set Site URL**: `https://brevibrushes.com` (your production URL)
   - ⚠️ **DO NOT use `http://localhost:3000` here!**
   - This must be your production URL
5. **Add Redirect URLs**:
   - `https://brevibrushes.com/reset-password`
   - `https://brevibrushes.com/account`
   - `https://brevibrushes.com/**` (wildcard for all routes)
6. **Save changes**
7. **Wait 1-2 minutes** for changes to propagate

### 2. Configure Supabase Custom SMTP (Optional but Recommended)

To completely replace Supabase's email service with your own:

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Navigate to**: **Settings** → **Auth** → **Email Templates**
3. **Enable Custom SMTP**:
   - Toggle "Enable Custom SMTP"
   - **SMTP Host**: `smtp.office365.com`
   - **SMTP Port**: `587`
   - **SMTP User**: `hello@brevibrushes.com`
   - **SMTP Password**: Your Microsoft 365 password or app-specific password
   - **Sender Email**: `hello@brevibrushes.com`
   - **Sender Name**: `BREVI`

**Note**: Even with custom SMTP, we recommend using our custom email functions for better control and branding.

### 3. Environment Variables

Ensure these are set in your production environment (Vercel, etc.):

```env
NEXT_PUBLIC_SITE_URL=https://brevibrushes.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Verify URL Normalization

The `normalizeUrl()` function in `lib/email.ts` automatically replaces any localhost URLs with the production URL. This ensures:
- Magic links use production URLs
- Password reset links use production URLs
- All email links use production URLs

## Current Implementation

### Password Reset Emails

✅ **Custom Implementation**: Uses `resetPasswordAction()` in `app/actions/auth.ts`
- Generates reset link using Supabase admin API
- Sends branded email via our SMTP
- Normalizes URLs to production domain
- Uses "BREVI" as sender name

### Magic Links (Account Access)

✅ **Custom Implementation**: Magic links in order confirmation emails are normalized
- `sendOrderConfirmationWithMagicLink()` normalizes URLs
- `sendOrderConfirmationForExistingAccount()` normalizes URLs
- All "Access Your Account" buttons use production URLs

## Testing

1. **Test Password Reset**:
   - Go to `/forgot-password`
   - Enter an email address
   - Check that email comes from "BREVI" (not "Supabase Auth")
   - Verify reset link uses production URL

2. **Test Order Confirmation**:
   - Place a test order
   - Check order confirmation email
   - Verify "Access Your Account" button uses production URL

## Troubleshooting

### Issue: Emails still coming from "Supabase Auth"

**Solution**: 
- Ensure you're using `resetPasswordAction()` (not Supabase's built-in function)
- Check that `/forgot-password` page is using the custom action
- Verify Supabase Custom SMTP is configured (optional)

### Issue: Links still use localhost

**Solution**:
1. Check `NEXT_PUBLIC_SITE_URL` is set correctly in production
2. Verify Supabase Site URL is set to production domain
3. The `normalizeUrl()` function should catch and fix any localhost URLs

### Issue: Magic links not working

**Solution**:
- Ensure Supabase redirect URLs include your production domain
- Check that the link is being normalized correctly
- Verify the link hasn't expired (magic links expire in 24 hours)

## Additional Notes

- **Password Reset Links**: Expire in 1 hour (configurable in Supabase)
- **Magic Links**: Expire in 24 hours (configurable in Supabase)
- **Email Branding**: All emails use BREVI branding and your SMTP configuration
- **URL Normalization**: Automatic - no manual intervention needed

