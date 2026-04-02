# Email Configuration Check

This document helps you verify and troubleshoot your Microsoft 365 email configuration.

## ⚠️ IMPORTANT: MFA is Enabled

If you're being prompted for MFA when logging into Microsoft 365, you **MUST** use an **App-Specific Password** for SMTP, not your regular password. See [MICROSOFT_365_MFA_SMTP_FIX.md](./MICROSOFT_365_MFA_SMTP_FIX.md) for detailed instructions.

## Configuration Sources

The email configuration is loaded in this priority order:

1. **Database Settings** (`admin_settings` table, key: `email_provider`)
   - Accessible via `/admin/settings/email`
   - This is the primary configuration source

2. **Environment Variables** (`.env.local`)
   - `EMAIL_SERVER_HOST`
   - `EMAIL_SERVER_PORT`
   - `EMAIL_SERVER_USER`
   - `EMAIL_SERVER_PASSWORD`
   - `EMAIL_FROM`

3. **Default Values** (fallback)

## Current Configuration Check

### Step 1: Check Database Settings

1. Go to `/admin/settings/email` in your admin panel
2. Verify the following fields are set:
   - ✅ **Provider**: Should be "SMTP (Microsoft 365 / Office 365)"
   - ✅ **SMTP Server Host**: Should be `smtp.office365.com`
   - ✅ **SMTP Port**: Should be `587` (STARTTLS) or `465` (SSL)
   - ✅ **SMTP Username/Email**: Should be `hello@brevibrushes.com`
   - ✅ **SMTP Password**: **MUST BE SET** - This is critical!
   - ✅ **From Email Address**: Should match SMTP user or have "Send As" permission
   - ✅ **From Name**: Display name (e.g., "BREVI")

### Step 2: Check Environment Variables

Check your `.env.local` file (lines 27-31) for:

```env
EMAIL_SERVER_HOST=smtp.office365.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=hello@brevibrushes.com
EMAIL_SERVER_PASSWORD=your-password-or-app-password-here
EMAIL_FROM=hello@brevibrushes.com
```

**Note**: If database settings are configured, environment variables are only used as fallback.

### Step 3: Microsoft 365 Requirements

Even if MFA is disabled, Microsoft 365 may still require:

#### 3.1. SMTP AUTH Enabled
- Go to [Microsoft 365 Admin Center](https://admin.microsoft.com)
- Navigate to **Settings** > **Mail** > **POP and IMAP**
- Ensure **SMTP AUTH** is enabled for your organization or for the specific mailbox

#### 3.2. App-Specific Password (If Required)
**Important**: For Microsoft 365 work/school accounts (like `hello@brevibrushes.com`), app passwords work differently than personal Microsoft accounts.

**For Microsoft 365 Work/School Accounts:**

App passwords are only available if:
- Two-step verification (MFA) is enabled on your account
- Your organization allows app passwords (may be disabled by admin)

**To check/create App Password for Microsoft 365:**
1. Go to https://mysignins.microsoft.com/security-info (or https://account.microsoft.com/security)
2. Sign in with `hello@brevibrushes.com`
3. Look for **"App passwords"** section (only visible if MFA is enabled)
4. If you don't see it, app passwords may be disabled by your organization

**Alternative Solutions for Microsoft 365:**

If app passwords are not available, try these solutions in order:

1. **Use Regular Password** (if MFA is disabled):
   - Simply use your regular Microsoft 365 password
   - Ensure SMTP AUTH is enabled (see 3.1)

2. **Enable SMTP AUTH** (Most Important):
   - Go to [Microsoft 365 Admin Center](https://admin.microsoft.com)
   - Navigate to **Settings** > **Mail** > **POP and IMAP**
   - Enable **SMTP AUTH** for your organization or specific mailbox
   - This is often the main cause of authentication failures

3. **Check with Admin**:
   - If app passwords are required but not available, contact your Microsoft 365 administrator
   - They may need to enable app passwords in the organization settings

4. **Use OAuth2** (Advanced):
   - Requires application registration in Azure AD
   - More secure but more complex to set up

#### 3.3. Account Status
- Verify the account `hello@brevibrushes.com` is not locked
- Check that the account has proper licenses
- Ensure the account is not restricted

#### 3.4. "Send As" Permission
If your **From Email** differs from your **SMTP User Email**, you need to:
- Grant "Send As" permission in Microsoft 365 Admin Center, OR
- Use the same email for both (recommended)

## Troubleshooting Authentication Errors

If you see the error:
```
Microsoft 365 Authentication Failed. Please check:
1. Username and password are correct
2. SMTP AUTH is enabled in Microsoft 365 Admin Center (Settings > Mail > POP and IMAP) - THIS IS CRITICAL!
3. If MFA is disabled, use your regular password (no app password needed)
4. If MFA is enabled, app passwords may be required (check with admin if not available)
5. The account is not locked or restricted
```

### Quick Fix Checklist (In Priority Order):

1. ✅ **SMTP AUTH is enabled** in Microsoft 365 Admin Center (MOST IMPORTANT!)
   - Go to https://admin.microsoft.com
   - Settings → Mail → POP and IMAP
   - Enable SMTP AUTH for your organization or specific mailbox
   - This is the #1 cause of authentication failures

2. ✅ **Password is set** in database settings (`/admin/settings/email`)
   - Use your regular password if MFA is disabled
   - Only use app password if MFA is enabled AND app passwords are available

3. ✅ **Password is correct** 
   - If MFA is disabled: Use your regular Microsoft 365 password
   - If MFA is enabled: Try app password (if available) or contact admin

4. ✅ **Account is active** - Check account status in Microsoft 365 Admin Center

5. ✅ **From email matches SMTP user** - Or "Send As" permission is granted

### Testing the Configuration

1. Go to `/admin/settings/email`
2. Enter a test email address
3. Click **"Test Connection"** button
4. This will verify:
   - SMTP authentication
   - Connection to Microsoft 365
   - Ability to send emails

## Common Issues

### Issue: "Authentication unsuccessful" (Error 535)
**Solution**: 
- Use an App-Specific Password instead of your regular password
- Verify SMTP AUTH is enabled in Microsoft 365 Admin Center

### Issue: "SendAsDenied" error
**Solution**: 
- Set **From Email** to match **SMTP User Email** (`hello@brevibrushes.com`)
- OR grant "Send As" permission in Microsoft 365 Admin Center

### Issue: "Connection timeout"
**Solution**: 
- Check firewall settings
- Verify port 587 is not blocked
- Try port 465 (SSL) instead

### Issue: Configuration not found
**Solution**: 
- Ensure email settings are saved in `/admin/settings/email`
- Check that `email_provider` setting exists in `admin_settings` table

## Running the Diagnostic Script

You can run the diagnostic script to check your configuration:

```bash
npx tsx scripts/check-email-config.ts
```

This will:
- Check environment variables
- Check database settings
- Identify missing configurations
- Provide recommendations

## Next Steps

1. **Verify Configuration**: Use the diagnostic script or manually check all settings
2. **Test Connection**: Use the "Test Connection" button on `/admin/settings/email`
3. **Update Password**: If needed, create an App-Specific Password and update it in the settings
4. **Check Microsoft 365**: Verify SMTP AUTH and account status in Microsoft 365 Admin Center
5. **Test Email**: Send a test email from the order detail page

## Additional Resources

- [Microsoft 365 SMTP Settings](https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365)
- [App Passwords](https://support.microsoft.com/en-us/account-billing/using-app-passwords-with-apps-that-don-t-support-two-step-verification-5896ed9b-4263-e681-128a-a6f2979a794a)
- [SMTP AUTH Configuration](https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission)

