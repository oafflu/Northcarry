# Supabase Email Templates - BREVI Branded

These are ready-to-use email templates for Supabase Custom SMTP. Copy and paste these into your Supabase Dashboard → Settings → Auth → Email Templates.

## Logo URL

Use this logo URL in all templates:
```
https://bzdgjeeqyfsppicfqfxq.supabase.co/storage/v1/object/public/cms-media/1764046954730-Brevi_Brush_Logo_-_1080_x_1080.png
```

---

## 1. Magic Link Template

**Subject:** `Access Your BREVI Account`

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 3px solid #14b8a6;">
              <img src="https://bzdgjeeqyfsppicfqfxq.supabase.co/storage/v1/object/public/cms-media/1764046954730-Brevi_Brush_Logo_-_1080_x_1080.png" alt="BREVI" style="max-width: 120px; height: auto;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="color: #14b8a6; margin: 0 0 20px 0; font-size: 28px; font-weight: bold;">Welcome to BREVI!</h1>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
                Hi there,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
                Click the button below to securely access your BREVI account. This link will allow you to log in without a password.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" style="background-color: #14b8a6; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Access Your Account</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0 0; font-size: 14px; color: #666;">
                This secure link will expire in 24 hours. If you didn't request this, you can safely ignore this email.
              </p>
              
              <!-- Alternative Link -->
              <p style="margin: 30px 0 0 0; font-size: 12px; color: #999; word-break: break-all;">
                Having trouble with the button? Copy and paste this URL into your browser:<br>
                <span style="color: #14b8a6;">{{ .ConfirmationURL }}</span>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                Best regards,<br>
                <strong style="color: #14b8a6;">The BREVI™ Team</strong>
              </p>
              <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">
                This is an automated email. Please do not reply to this message.
              </p>
              <p style="margin: 15px 0 0 0; font-size: 12px;">
                <a href="{{ .SiteURL }}" style="color: #14b8a6; text-decoration: none;">Visit BREVI</a> | 
                <a href="{{ .SiteURL }}/contact" style="color: #14b8a6; text-decoration: none;">Contact Support</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 2. Reset Password Template

**Subject:** `Reset Your BREVI Password`

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 3px solid #14b8a6;">
              <img src="https://bzdgjeeqyfsppicfqfxq.supabase.co/storage/v1/object/public/cms-media/1764046954730-Brevi_Brush_Logo_-_1080_x_1080.png" alt="BREVI" style="max-width: 120px; height: auto;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="color: #14b8a6; margin: 0 0 20px 0; font-size: 28px; font-weight: bold;">Reset Your Password</h1>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
                Hi there,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
                We received a request to reset your password for your BREVI account. Click the button below to create a new password.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" style="background-color: #14b8a6; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                  <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour for security reasons. If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
                </p>
              </div>
              
              <!-- Alternative Link -->
              <p style="margin: 30px 0 0 0; font-size: 12px; color: #999; word-break: break-all;">
                Having trouble with the button? Copy and paste this URL into your browser:<br>
                <span style="color: #14b8a6;">{{ .ConfirmationURL }}</span>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                Best regards,<br>
                <strong style="color: #14b8a6;">The BREVI™ Team</strong>
              </p>
              <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">
                This is an automated email. Please do not reply to this message.
              </p>
              <p style="margin: 15px 0 0 0; font-size: 12px;">
                <a href="{{ .SiteURL }}" style="color: #14b8a6; text-decoration: none;">Visit BREVI</a> | 
                <a href="{{ .SiteURL }}/contact" style="color: #14b8a6; text-decoration: none;">Contact Support</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 3. Email Confirmation Template

**Subject:** `Confirm Your Email Address - BREVI`

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 3px solid #14b8a6;">
              <img src="https://bzdgjeeqyfsppicfqfxq.supabase.co/storage/v1/object/public/cms-media/1764046954730-Brevi_Brush_Logo_-_1080_x_1080.png" alt="BREVI" style="max-width: 120px; height: auto;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="color: #14b8a6; margin: 0 0 20px 0; font-size: 28px; font-weight: bold;">Confirm Your Email Address</h1>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
                Hi there,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
                Thank you for signing up with BREVI! To complete your registration, please confirm your email address by clicking the button below.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" style="background-color: #14b8a6; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Confirm Email Address</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0 0; font-size: 14px; color: #666;">
                This confirmation link will expire in 24 hours. If you didn't create an account with BREVI, you can safely ignore this email.
              </p>
              
              <!-- Alternative Link -->
              <p style="margin: 30px 0 0 0; font-size: 12px; color: #999; word-break: break-all;">
                Having trouble with the button? Copy and paste this URL into your browser:<br>
                <span style="color: #14b8a6;">{{ .ConfirmationURL }}</span>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                Best regards,<br>
                <strong style="color: #14b8a6;">The BREVI™ Team</strong>
              </p>
              <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">
                This is an automated email. Please do not reply to this message.
              </p>
              <p style="margin: 15px 0 0 0; font-size: 12px;">
                <a href="{{ .SiteURL }}" style="color: #14b8a6; text-decoration: none;">Visit BREVI</a> | 
                <a href="{{ .SiteURL }}/contact" style="color: #14b8a6; text-decoration: none;">Contact Support</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 4. Change Email Address Template

**Subject:** `Confirm Your New Email Address - BREVI`

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 3px solid #14b8a6;">
              <img src="https://bzdgjeeqyfsppicfqfxq.supabase.co/storage/v1/object/public/cms-media/1764046954730-Brevi_Brush_Logo_-_1080_x_1080.png" alt="BREVI" style="max-width: 120px; height: auto;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="color: #14b8a6; margin: 0 0 20px 0; font-size: 28px; font-weight: bold;">Confirm Your New Email Address</h1>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
                Hi there,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
                You've requested to change your email address for your BREVI account. To complete this change, please confirm your new email address by clicking the button below.
              </p>
              
              <div style="background-color: #e3f2fd; border-left: 4px solid #14b8a6; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #1976d2;">
                  <strong>New Email:</strong> {{ .Email }}
                </p>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" style="background-color: #14b8a6; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Confirm New Email</a>
                  </td>
                </tr>
              </table>
              
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                  <strong>⚠️ Important:</strong> If you didn't request this email change, please contact our support team immediately. Your email address will not be changed until you confirm it.
                </p>
              </div>
              
              <!-- Alternative Link -->
              <p style="margin: 30px 0 0 0; font-size: 12px; color: #999; word-break: break-all;">
                Having trouble with the button? Copy and paste this URL into your browser:<br>
                <span style="color: #14b8a6;">{{ .ConfirmationURL }}</span>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                Best regards,<br>
                <strong style="color: #14b8a6;">The BREVI™ Team</strong>
              </p>
              <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">
                This is an automated email. Please do not reply to this message.
              </p>
              <p style="margin: 15px 0 0 0; font-size: 12px;">
                <a href="{{ .SiteURL }}" style="color: #14b8a6; text-decoration: none;">Visit BREVI</a> | 
                <a href="{{ .SiteURL }}/contact" style="color: #14b8a6; text-decoration: none;">Contact Support</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## How to Use These Templates

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Navigate to**: Settings → Auth → Email Templates
3. **For each template**:
   - Click on the template name (Magic Link, Reset Password, etc.)
   - Copy the **Subject** line and paste it into the Subject field
   - Copy the **Body (HTML)** and paste it into the HTML body field
   - Click **Save**

## Template Features

✅ **BREVI Logo** - Prominently displayed at the top  
✅ **Consistent Branding** - Uses BREVI teal color (#14b8a6)  
✅ **Mobile Responsive** - Works on all email clients  
✅ **Clear CTAs** - Prominent action buttons  
✅ **Security Warnings** - Where appropriate (password reset, email change)  
✅ **Alternative Links** - Fallback text links if buttons don't work  
✅ **Professional Footer** - Contact links and branding  

## Template Variables Used

- `{{ .ConfirmationURL }}` - The confirmation/reset link
- `{{ .Email }}` - User's email address (in Change Email template)
- `{{ .SiteURL }}` - Your site URL (https://brevibrushes.com)

## Testing

After adding these templates:

1. **Test Magic Link**: Place a test order or request account access
2. **Test Password Reset**: Go to `/forgot-password` and request reset
3. **Test Email Confirmation**: Create a new account
4. **Test Email Change**: Change email in account settings

Verify that:
- ✅ Logo displays correctly
- ✅ Branding colors are correct
- ✅ Buttons are clickable
- ✅ Links work correctly
- ✅ Email looks professional

## Customization

You can customize:
- **Colors**: Change `#14b8a6` to a different brand color
- **Logo Size**: Adjust `max-width: 120px` in the logo img tag
- **Spacing**: Adjust padding values
- **Text**: Modify any text content

All templates use the same design system for consistency.

