# Supabase Custom SMTP Setup Guide

This guide will help you configure Supabase to send branded authentication emails (password reset, magic links) using your BREVI email address (hello@brevibrushes.com).

## Overview

With Supabase Custom SMTP configured:
- ✅ Password reset emails sent from hello@brevibrushes.com
- ✅ Magic link emails sent from hello@brevibrushes.com  
- ✅ Email verification emails sent from hello@brevibrushes.com
- ✅ All emails use BREVI branding
- ✅ Proper redirect handling (no localhost issues)

## Step 1: Configure Supabase Site URL

**CRITICAL:** This must be set correctly for redirects to work!

1. Go to **Supabase Dashboard**: https://app.supabase.com
2. Select your project
3. Navigate to: **Settings** → **Auth** → **URL Configuration**
4. Set **Site URL**: `https://brevibrushes.com`
   - ⚠️ **DO NOT use `http://localhost:3000`**
5. Add **Redirect URLs**:
   - `https://brevibrushes.com/reset-password`
   - `https://brevibrushes.com/account`
   - `https://brevibrushes.com/auth/callback`
   - `https://brevibrushes.com/**` (wildcard for all routes)
6. Click **Save**

## Step 2: Configure Custom SMTP

1. In Supabase Dashboard, navigate to: **Settings** → **Auth** → **Email Templates**
2. Scroll down to **SMTP Settings**
3. Toggle **"Enable Custom SMTP"** to ON
4. Fill in the following settings:

### SMTP Configuration

- **SMTP Host**: `smtp.office365.com`
- **SMTP Port**: `587`
- **SMTP User**: `hello@brevibrushes.com`
- **SMTP Password**: Your Microsoft 365 password or app-specific password
  - If MFA is enabled, use an App-Specific Password
  - If MFA is disabled, use your regular password
- **Sender Email**: `hello@brevibrushes.com`
- **Sender Name**: `BREVI`
- **Minimum interval per user**: `60` seconds (1 minute) ⭐ **Recommended**

### Minimum Interval Per User Setting

This setting controls how often a user can receive authentication emails (password reset, magic links, etc.) to prevent spam and abuse.

**Recommended: 60 seconds (1 minute)**

**Why 60 seconds?**
- ✅ Prevents spam/abuse (can't request emails every second)
- ✅ Allows legitimate users to resend if they didn't receive the first email
- ✅ Good balance between security and user experience
- ✅ Prevents email flooding while still being user-friendly

**Alternative Options:**
- **30 seconds**: More permissive, allows faster resends (good for development/testing)
- **120 seconds (2 minutes)**: More conservative, better spam protection
- **300 seconds (5 minutes)**: Very conservative, may frustrate legitimate users

**Important Notes:**
- This is a **per-user** limit (not global)
- Applies to all auth emails (password reset, magic links, email verification)
- Lower values = more permissive but less secure
- Higher values = more secure but potentially frustrating for users

5. Click **Save**

### Important Notes:

- **SMTP AUTH must be enabled** in Microsoft 365 Admin Center
  - Go to: Microsoft 365 Admin Center → Settings → Mail → POP and IMAP
  - Ensure "Authenticated SMTP" is enabled
- **If authentication fails**, check:
  - SMTP AUTH is enabled for the account
  - Password is correct (or app password if MFA is enabled)
  - Account is not locked or restricted

## Step 3: Customize Email Templates

Supabase allows you to customize the email templates with your branding.

1. In **Settings** → **Auth** → **Email Templates**
2. You'll see templates for:
   - **Magic Link** (for account access)
   - **Change Email Address**
   - **Reset Password**
   - **Email Confirmation**

3. **Ready-to-use branded templates are available!**

   📄 **See `SUPABASE_EMAIL_TEMPLATES.md`** for complete, professionally designed email templates with:
   - ✅ BREVI logo included
   - ✅ Consistent branding (BREVI teal color #14b8a6)
   - ✅ Mobile-responsive design
   - ✅ Clear call-to-action buttons
   - ✅ Security warnings where appropriate
   - ✅ Professional footer with contact links

   Simply copy and paste the templates from that file into your Supabase dashboard!

### Quick Setup:

1. Open `SUPABASE_EMAIL_TEMPLATES.md` in this repository
2. For each template type, copy:
   - The **Subject** line → Paste into Supabase Subject field
   - The **Body (HTML)** → Paste into Supabase HTML body field
3. Click **Save** for each template

### Available Template Variables:

- `{{ .ConfirmationURL }}` - The magic link/reset link URL
- `{{ .Token }}` - The token (usually not needed)
- `{{ .TokenHash }}` - The token hash (usually not needed)
- `{{ .SiteURL }}` - Your site URL (https://brevibrushes.com)
- `{{ .Email }}` - User's email address
- `{{ .RedirectTo }}` - Redirect destination

## Step 4: Test the Configuration

### Test Password Reset:

1. Go to `/forgot-password` on your site
2. Enter an email address
3. Check the email inbox
4. Verify:
   - Email comes from "BREVI <hello@brevibrushes.com>"
   - Link redirects to `/reset-password`
   - Password reset works correctly

### Test Magic Link:

1. Place a test order or use an existing account
2. Check order confirmation email
3. Click "Access Your Account" button
4. Verify:
   - Email comes from "BREVI <hello@brevibrushes.com>"
   - Link redirects to `/account` (not home page)
   - User is logged in correctly

## Step 5: Update Code (Already Done)

The code has been updated to:
- ✅ Use Supabase's `resetPasswordForEmail` for password reset
- ✅ Use Supabase's magic link generation for account access
- ✅ Handle redirects correctly in auth callback routes

## Troubleshooting

### Issue: Emails not sending

**Check:**
1. SMTP AUTH is enabled in Microsoft 365
2. Password is correct (or app password if MFA enabled)
3. Account is not locked
4. Check Supabase logs for errors

### Issue: Links redirect to wrong page

**Check:**
1. Site URL is set to `https://brevibrushes.com` (not localhost)
2. Redirect URLs include `/account` and `/reset-password`
3. `NEXT_PUBLIC_SITE_URL` environment variable is set correctly

### Issue: Authentication errors

**Check:**
1. SMTP credentials are correct
2. SMTP AUTH is enabled for the account
3. If MFA is enabled, use app-specific password
4. Account has "Send As" permissions if needed

## What's Still Custom?

The following emails are still sent via our custom SMTP system:
- ✅ Order confirmation emails (with order details)
- ✅ Shipping notification emails
- ✅ Invoice emails
- ✅ Support ticket emails
- ✅ Supplier payment notifications

These remain custom because they require dynamic order/business data that Supabase templates can't easily handle.

## Benefits of This Approach

1. **Simpler Code**: Less custom code to maintain
2. **Better Reliability**: Supabase handles email delivery
3. **Proper Redirects**: Built-in redirect handling works correctly
4. **Consistent Branding**: All auth emails use BREVI branding
5. **Less Maintenance**: No need to maintain custom password reset flow

## Next Steps

After configuring:
1. Test password reset flow
2. Test magic link flow
3. Verify emails are branded correctly
4. Monitor for any issues

If you encounter any issues, check the Supabase logs and email configuration.

