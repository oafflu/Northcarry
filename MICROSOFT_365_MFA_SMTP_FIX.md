# Fixing Microsoft 365 SMTP Authentication with MFA Enabled

## The Problem

If you're being prompted for MFA (Multi-Factor Authentication) when logging into Microsoft 365, you **cannot** use your regular password for SMTP authentication. You need to use an **App-Specific Password** instead.

**Important**: Even if "Per-user MFA" shows as "disabled" in the admin center, MFA can still be enforced by:
- **Security Defaults** (organization-wide)
- **Conditional Access Policies** (organization-wide)
- **User's personal security settings**

If you're getting MFA prompts, MFA is effectively enabled and you need an app password for SMTP.

## Solution 1: Use App-Specific Password (Recommended)

This is the recommended approach - keep MFA enabled for security, but use an app password for SMTP.

### Step 1: Create an App-Specific Password

1. **Go to Microsoft 365 Security Settings**:
   - Visit: https://mysignins.microsoft.com/security-info
   - Or: https://account.microsoft.com/security
   - Sign in with `hello@brevibrushes.com`

2. **Navigate to App Passwords**:
   - Look for **"App passwords"** or **"Security info"** section
   - If you don't see it, try:
     - Click on **"Security"** tab
     - Look for **"Advanced security options"**
     - Scroll down to find **"App passwords"**

3. **Create New App Password**:
   - Click **"Create a new app password"** or **"Add app password"**
   - Give it a name like "BREVI SMTP" or "Email Server"
   - Click **"Generate"** or **"Create"**

4. **Copy the Generated Password**:
   - The password will look like: `abcd-efgh-ijkl-mnop` (16 characters, may have dashes)
   - **Copy it immediately** - you won't be able to see it again!
   - This is your app-specific password

### Step 2: Use App Password in BREVI

1. Go to `/admin/settings/email` in your BREVI admin panel
2. In the **"SMTP Password"** field, paste the app-specific password (NOT your regular password)
3. Click **"Save Settings"**
4. Test the connection

## Solution 2: Disable MFA Enforcement (If Per-User MFA is Already Disabled)

If "Per-user MFA" shows as "disabled" but you're still getting MFA prompts, MFA is being enforced by organization policies. You need to check:

### Check Security Defaults:

1. **Go to Azure Active Directory**:
   - Visit: https://portal.azure.com
   - Navigate to **Azure Active Directory** → **Properties**
   - Look for **"Security defaults"**
   - If it says **"Enabled"**, this is enforcing MFA organization-wide

2. **Disable Security Defaults** (if you have admin rights):
   - Go to **Azure Active Directory** → **Properties**
   - Click **"Manage Security defaults"**
   - Set to **"Disabled"**
   - **Note**: This affects all users in your organization

### Check Conditional Access Policies:

1. **Go to Azure Portal**:
   - Visit: https://portal.azure.com
   - Navigate to **Azure Active Directory** → **Security** → **Conditional Access**

2. **Review Policies**:
   - Look for policies that require MFA
   - Check if any policies apply to `hello@brevibrushes.com` or "All users"
   - You may need to exclude the account or modify the policy

### Check User's Personal Security Settings:

Even if organization MFA is disabled, the user might have enabled it personally:

1. **Go to Security Settings**:
   - Visit: https://mysignins.microsoft.com/security-info
   - Sign in with `hello@brevibrushes.com`

2. **Check Two-Step Verification**:
   - Look for **"Two-step verification"** or **"Additional security verification"**
   - If enabled, click **"Turn off"**

### Important Note:

**If you're still getting MFA prompts after checking all of the above, you MUST use an App-Specific Password for SMTP.** This is the most reliable solution and maintains security.

### Alternative: Disable via Security Settings

1. **Go to Security Settings**:
   - Visit: https://mysignins.microsoft.com/security-info
   - Sign in with `hello@brevibrushes.com`

2. **Disable Two-Step Verification**:
   - Look for **"Two-step verification"** or **"Additional security verification"**
   - Click **"Turn off"** or **"Disable"**
   - Follow the prompts to confirm

### Note for Organization Admins:

If you're an organization admin and want to disable MFA for all users or change MFA policies:

1. **Go to Microsoft 365 Admin Center**
2. **Navigate to**: **Settings** → **Security & privacy** → **Multi-factor authentication**
3. **Manage MFA settings** for your organization

## Why App Passwords Are Better

- ✅ Keeps your account secure with MFA
- ✅ Allows legacy applications (like SMTP) to work
- ✅ Can be revoked individually if compromised
- ✅ Doesn't affect your regular login security

## Troubleshooting

### "I don't see App Passwords option"

This can happen if:
- Your organization has disabled app passwords
- You need to enable MFA first (app passwords only work with MFA)
- You're looking in the wrong section

**Solution**: Contact your Microsoft 365 administrator to enable app passwords for your organization.

### "App passwords are disabled by admin"

If your organization has disabled app passwords, you have two options:
1. Ask your admin to enable app passwords
2. Disable MFA for your account (if allowed by policy)

### "I created an app password but it still doesn't work"

1. Make sure you're using the app password (not your regular password)
2. Copy the entire password including dashes
3. Check for any trailing spaces
4. Try creating a new app password
5. Verify SMTP AUTH is enabled in Microsoft 365 Admin Center

## Quick Checklist

- [ ] MFA is enabled on the account (confirmed - you see authenticator app prompt)
- [ ] Created an app-specific password from security settings
- [ ] Copied the app password (16 characters, may have dashes)
- [ ] Pasted app password in `/admin/settings/email` → SMTP Password field
- [ ] Saved settings
- [ ] Tested connection

## After Setting Up

Once you've configured the app password:
1. Your regular login will still require MFA (secure)
2. SMTP will use the app password (works with legacy auth)
3. You can revoke the app password anytime from security settings

