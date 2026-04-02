# Fixing Microsoft 365 Email Authentication Error

## Error Message
```
535 5.7.139 Authentication unsuccessful, the user credentials were incorrect
```

## Common Causes & Solutions

### 1. **Multi-Factor Authentication (MFA) Enabled** ⚠️ MOST COMMON

If MFA is enabled on your Microsoft 365 account, you **MUST** use an **App-Specific Password** instead of your regular password.

#### How to Create an App-Specific Password:

1. Go to: https://account.microsoft.com/security
2. Sign in with your Microsoft 365 account (`hello@brevibrushes.com`)
3. Click on **"Advanced security options"**
4. Scroll down to **"App passwords"** section
5. Click **"Create a new app password"**
6. Give it a name like "BREVI SMTP" or "Email Server"
7. Copy the generated password (it will look like: `abcd-efgh-ijkl-mnop`)
8. **Use this app password** in your SMTP configuration (NOT your regular password)

#### Where to Use It:
- In `/admin/settings/email` → SMTP Password field
- Or in `.env.local` → `EMAIL_SERVER_PASSWORD`

### 2. **SMTP AUTH Disabled in Microsoft 365**

Microsoft 365 may have SMTP AUTH disabled by default. You need to enable it:

1. Go to Microsoft 365 Admin Center: https://admin.microsoft.com
2. Navigate to **Settings** → **Mail** → **POP and IMAP**
3. Enable **"Authenticated SMTP"** or **"SMTP AUTH"**
4. Save changes
5. Wait 5-10 minutes for changes to propagate

### 3. **Incorrect Credentials**

Double-check:
- **Username**: Must be the full email address (e.g., `hello@brevibrushes.com`)
- **Password**: Must be correct (or app-specific password if MFA is enabled)
- **No extra spaces** before or after the credentials

### 4. **Account Restrictions**

Check if your account has:
- Security restrictions
- Account lockout
- IP restrictions
- Conditional access policies blocking SMTP

### 5. **Port and Encryption Settings**

For Microsoft 365, use:
- **Port**: `587` (STARTTLS) - **Recommended**
- **Port**: `465` (SSL) - Alternative
- **Host**: `smtp.office365.com`

## Configuration Steps

### Option 1: Via Admin Panel (Recommended)

1. Go to `/admin/settings/email`
2. Ensure **Provider** is set to "SMTP (Microsoft 365 / Office 365)"
3. Fill in:
   - **SMTP Server Host**: `smtp.office365.com`
   - **SMTP Port**: `587`
   - **SMTP Username**: `hello@brevibrushes.com`
   - **SMTP Password**: Your app-specific password (if MFA enabled) or regular password
   - **From Email**: `hello@brevibrushes.com` (should match SMTP username)
4. Click **"Save Settings"**
5. Enter a test email address
6. Click **"Test Connection"** to verify

### Option 2: Via Environment Variables

Add to `.env.local`:

```env
EMAIL_SERVER_HOST=smtp.office365.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=hello@brevibrushes.com
EMAIL_SERVER_PASSWORD=your-app-specific-password-here
EMAIL_FROM=hello@brevibrushes.com
```

## Testing Your Configuration

1. Go to `/admin/settings/email`
2. Enter your email address in the "Test Email Address" field
3. Click **"Test Connection"** button
4. Check your inbox (and spam folder) for the test email

## Troubleshooting

### Still Getting Authentication Error?

1. **Verify App Password**: Make sure you're using the app-specific password, not your regular password
2. **Check MFA Status**: Go to https://account.microsoft.com/security and verify MFA is enabled
3. **Test in Different Email Client**: Try configuring the same credentials in Outlook or another email client to verify they work
4. **Check Microsoft 365 Admin Center**: Ensure SMTP AUTH is enabled for your organization
5. **Wait**: Sometimes changes take 10-15 minutes to propagate

### Error Messages Guide

- **535 5.7.139**: Authentication failed - usually means wrong password or need app password
- **535 5.7.3**: Authentication unsuccessful - check username/password
- **550 5.7.1**: SMTP AUTH disabled - enable it in admin center
- **Connection timeout**: Check firewall/network settings

## Security Best Practices

1. ✅ Use App-Specific Passwords (not regular passwords)
2. ✅ Keep app passwords secure and rotate them periodically
3. ✅ Use port 587 with STARTTLS (more secure than port 25)
4. ✅ Regularly review and remove unused app passwords

## Need More Help?

If you continue to have issues:
1. Check server logs for detailed error messages
2. Verify your Microsoft 365 account status
3. Contact Microsoft 365 support if account-level restrictions are suspected

