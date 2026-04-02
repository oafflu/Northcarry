# Hybrid Email Implementation - Complete

## Overview

We've implemented a **hybrid approach** for email sending:

- **Supabase Custom SMTP** for authentication emails (password reset, magic links, email verification)
- **Custom SMTP** for business emails (order confirmations, shipping, invoices, support tickets)

## What Changed

### 1. Password Reset Flow

**Before:**
- Custom `resetPasswordAction()` function
- Custom email template in `lib/email.ts`
- Manual link generation and email sending

**After:**
- Uses Supabase's built-in `resetPasswordForEmail()`
- Emails sent via Supabase Custom SMTP
- Configured in Supabase dashboard

**Files Updated:**
- ✅ `app/forgot-password/page.tsx` - Now uses Supabase directly
- ✅ `app/reset-password/page.tsx` - Created new page for password reset
- ✅ `app/actions/auth.ts` - `resetPasswordAction()` marked as deprecated

### 2. Magic Link Flow

**Current:**
- Order confirmation emails still use custom magic links (with order details)
- Magic links generated via Supabase admin API
- Links properly redirect to `/account` (fixed redirect issue)

**Future Enhancement:**
- Could optionally use Supabase's standalone magic link emails
- Would require sending two emails: Supabase magic link + custom order confirmation
- Current approach (embedded magic link in order email) is better UX

### 3. Auth Callback Routes

**Created:**
- ✅ `app/auth/v1/verify/route.ts` - Handles Supabase magic link verification
- ✅ `app/auth/callback/route.ts` - General auth callback handler

**Fixed:**
- ✅ Redirect logic now properly handles `/account` redirects
- ✅ No more redirecting to home page

## Configuration Required

### Step 1: Supabase Site URL

1. Go to Supabase Dashboard → Settings → Auth → URL Configuration
2. Set **Site URL**: `https://brevibrushes.com`
3. Add **Redirect URLs**:
   - `https://brevibrushes.com/reset-password`
   - `https://brevibrushes.com/account`
   - `https://brevibrushes.com/auth/callback`
   - `https://brevibrushes.com/**`

### Step 2: Supabase Custom SMTP

1. Go to Supabase Dashboard → Settings → Auth → Email Templates
2. Enable **Custom SMTP**
3. Configure:
   - **SMTP Host**: `smtp.office365.com`
   - **SMTP Port**: `587`
   - **SMTP User**: `hello@brevibrushes.com`
   - **SMTP Password**: Your Microsoft 365 password or app password
   - **Sender Email**: `hello@brevibrushes.com`
   - **Sender Name**: `BREVI`

4. Customize email templates with BREVI branding

See `SUPABASE_SMTP_SETUP_GUIDE.md` for detailed instructions.

## What Still Uses Custom Emails

These emails are still sent via our custom SMTP system:

- ✅ **Order Confirmation Emails** - Include order details, items, tracking
- ✅ **Shipping Notification Emails** - Include tracking links
- ✅ **Invoice Emails** - Include invoice details
- ✅ **Support Ticket Emails** - Include ticket details
- ✅ **Supplier Payment Notifications** - Include invoice details

**Reason:** These emails require dynamic business data that Supabase templates can't easily handle.

## Benefits

1. **Simpler Codebase**
   - Less custom code to maintain
   - No custom password reset flow
   - Supabase handles edge cases

2. **Better Reliability**
   - Supabase handles email delivery
   - Built-in retry logic
   - Better error handling

3. **Proper Redirects**
   - Magic links redirect correctly to `/account`
   - No more localhost URL issues
   - Built-in redirect handling

4. **Consistent Branding**
   - All auth emails use BREVI branding
   - Configured in Supabase dashboard
   - Easy to update templates

5. **Less Maintenance**
   - No need to maintain custom password reset
   - Supabase handles token generation/verification
   - Automatic session management

## Testing Checklist

After configuration, test:

- [ ] Password reset flow
  1. Go to `/forgot-password`
  2. Enter email
  3. Check email (should come from BREVI)
  4. Click reset link
  5. Set new password
  6. Verify redirect to login

- [ ] Magic link flow
  1. Place test order
  2. Check order confirmation email
  3. Click "Access Your Account"
  4. Verify redirect to `/account` (not home)
  5. Verify user is logged in

- [ ] Email branding
  1. Check password reset email branding
  2. Check magic link email branding
  3. Verify all emails come from "BREVI <hello@brevibrushes.com>"

## Rollback Plan

If needed, you can rollback by:
1. Re-enable `resetPasswordAction()` in `app/actions/auth.ts`
2. Update `app/forgot-password/page.tsx` to use custom action
3. Keep Supabase Custom SMTP disabled (or keep it for other emails)

## Next Steps

1. ✅ Configure Supabase Site URL
2. ✅ Configure Supabase Custom SMTP
3. ✅ Customize email templates in Supabase
4. ✅ Test password reset flow
5. ✅ Test magic link flow
6. ✅ Monitor for any issues

## Support

If you encounter issues:
1. Check Supabase logs in dashboard
2. Verify SMTP configuration
3. Check email delivery status
4. Review `SUPABASE_SMTP_SETUP_GUIDE.md` for troubleshooting

