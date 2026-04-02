# Email Configuration Guide

## Microsoft 365 SMTP Setup

The system is configured to use Microsoft 365 (Office 365) SMTP for sending emails.

### Environment Variables

Add these to your `.env.local` file:

```env
# Email Configuration (Microsoft 365 SMTP)
EMAIL_SERVER_HOST=smtp.office365.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=hello@brevibrushes.com
EMAIL_SERVER_PASSWORD=<REDACTED_SMTP_PASSWORD>
EMAIL_FROM=noreply@brevibrushes.com
```

### Admin Settings Configuration

You can also configure email settings through the admin panel at `/admin/settings/email`:

1. **Provider**: Select "SMTP (Microsoft 365 / Office 365)"
2. **SMTP Server Host**: `smtp.office365.com`
3. **SMTP Port**: `587` (STARTTLS - Recommended)
4. **SMTP Username**: `hello@brevibrushes.com`
5. **SMTP Password**: Your Microsoft 365 password or app-specific password
6. **From Email**: `noreply@brevibrushes.com`
7. **From Name**: `BREVI`

### Microsoft 365 SMTP Settings

- **Server**: `smtp.office365.com`
- **Port**: `587` (STARTTLS) or `465` (SSL)
- **Encryption**: STARTTLS (port 587) or SSL (port 465)
- **Authentication**: Required
- **Username**: Your Microsoft 365 email address
- **Password**: Your Microsoft 365 password or app-specific password

### App-Specific Password (Recommended)

For better security, use an app-specific password instead of your main Microsoft 365 password:

1. Go to Microsoft Account Security: https://account.microsoft.com/security
2. Sign in with your Microsoft 365 account
3. Go to "Advanced security options"
4. Under "App passwords", create a new app password
5. Use this app password in the SMTP configuration

### Testing Email Configuration

After configuring, test the email system by:

1. Going to `/admin/settings/email`
2. Saving your settings
3. The system will use these settings for:
   - Welcome emails
   - Order confirmations
   - Shipping notifications
   - Password reset emails
   - Marketing campaigns

### Email Templates

The following email templates are available and can be enabled/disabled in admin settings:

- **Welcome Email**: Sent to new customers upon registration
- **Order Confirmation**: Sent when an order is placed
- **Shipping Notification**: Sent when an order ships

### Troubleshooting

**Common Issues:**

1. **Authentication Failed**
   - Verify your email and password are correct
   - Try using an app-specific password
   - Check if 2FA is enabled (requires app password)

2. **Connection Timeout**
   - Verify `smtp.office365.com` is accessible
   - Check firewall settings
   - Try port 465 with SSL

3. **Emails Not Sending**
   - Check spam folder
   - Verify "From" email address is valid
   - Check Microsoft 365 account for any restrictions

### Security Notes

- Never commit `.env.local` to version control
- Use app-specific passwords instead of main account passwords
- Regularly rotate passwords
- Monitor email sending for suspicious activity

