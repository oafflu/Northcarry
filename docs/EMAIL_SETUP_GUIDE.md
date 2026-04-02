# Email Setup Guide for BREVI

This guide covers all aspects of email configuration for the BREVI platform, including sender icons, bulk delivery, DNS records, and best practices.

## 1. Email Sender Icon (Company Logo in Inbox)

### Overview
The email sender icon (also called "sender photo" or "company logo") appears next to emails in recipients' inboxes. This is typically handled by Microsoft 365/Exchange Online.

### Setup in Microsoft 365

1. **Exchange Admin Center:**
   - Go to Microsoft 365 Admin Center → Exchange Admin Center
   - Navigate to **Organization** → **Sharing**
   - Look for **Organization profile** settings

2. **Set Company Logo:**
   - Upload your Brevi logo (recommended: 64x64px or 96x96px PNG with transparent background)
   - The logo should be square and optimized for small display
   - This logo will appear in Outlook and other email clients that support organization photos

3. **Alternative: Set via PowerShell:**
   ```powershell
   # Connect to Exchange Online
   Connect-ExchangeOnline
   
   # Set organization photo
   Set-OrganizationBranding -LogoFile "C:\path\to\brevi-logo.png"
   ```

4. **For Individual Mailboxes:**
   - Users can set their own photo in Outlook/Office 365
   - This appears in the "From" field in recipient inboxes

### Notes:
- The sender icon is primarily controlled by Microsoft 365/Exchange
- It cannot be set directly from the BREVI email marketing system
- The icon appears in Outlook, Gmail, and other email clients that support organization photos
- Make sure your logo is high-quality and recognizable at small sizes

---

## 2. Bulk Email Delivery (22,000+ Recipients)

### Current Implementation
BREVI uses Microsoft 365 SMTP for email delivery. When sending to 22,000+ recipients, you need to implement proper rate limiting and delivery strategies.

### Best Practices:

1. **Rate Limiting:**
   - Microsoft 365 has sending limits (typically 10,000 recipients per day for standard plans)
   - For 22,000+ recipients, you'll need:
     - Microsoft 365 E3/E5 plan (30,000/day limit)
     - Or use a dedicated email service (SendGrid, Mailgun, AWS SES)

2. **Batch Sending:**
   - Send in batches of 500-1,000 emails per batch
   - Add delays between batches (1-2 seconds)
   - Process over multiple days if needed

3. **Warm-up Strategy:**
   - Start with small batches (100-500 emails)
   - Gradually increase volume over weeks
   - This helps build sender reputation

4. **Implementation in BREVI:**
   The system should automatically:
   - Queue emails for sending
   - Process in batches
   - Track delivery status
   - Handle bounces and failures

### Recommended Email Service Providers for Bulk Sending:

1. **SendGrid** (Recommended)
   - 100 emails/day free, then paid plans
   - Excellent deliverability
   - Built-in analytics
   - Easy API integration

2. **Mailgun**
   - 5,000 emails/month free
   - Great for transactional emails
   - Good API documentation

3. **AWS SES**
   - Very cost-effective ($0.10 per 1,000 emails)
   - Requires AWS account
   - Good for high volume

4. **Postmark**
   - Excellent deliverability
   - Focus on transactional emails
   - Higher cost but great reputation

---

## 3. DNS Records for Email Authentication (SPF, DKIM, DMARC)

### Why These Matter:
These DNS records authenticate your emails and significantly reduce the chance of emails going to spam. They prove that emails are actually from your domain.

### SPF (Sender Policy Framework)

**Purpose:** Lists which servers are authorized to send emails for your domain.

**DNS Record (TXT):**
```
Type: TXT
Name: @ (or your domain name)
Value: v=spf1 include:spf.protection.outlook.com -all
```

**For Microsoft 365:**
```
v=spf1 include:spf.protection.outlook.com include:_spf.google.com -all
```

**Explanation:**
- `v=spf1` - SPF version 1
- `include:spf.protection.outlook.com` - Allows Microsoft 365 to send
- `-all` - Reject all other senders

**To Add:**
1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Access DNS management
3. Add a TXT record with the SPF value above
4. Wait 24-48 hours for propagation

---

### DKIM (DomainKeys Identified Mail)

**Purpose:** Cryptographically signs emails to prove they haven't been tampered with.

**For Microsoft 365:**

1. **Enable DKIM in Exchange Admin Center:**
   - Go to Exchange Admin Center → Protection → DKIM
   - Select your domain (brevibrushes.com)
   - Click "Enable"
   - Microsoft will generate DKIM keys

2. **Add DNS Records:**
   Microsoft will provide two CNAME records like:
   ```
   selector1._domainkey.brevibrushes.com → selector1-brevibrushes-com._domainkey.outlook.com
   selector2._domainkey.brevibrushes.com → selector2-brevibrushes-com._domainkey.outlook.com
   ```

3. **Add to DNS:**
   - Type: CNAME
   - Name: selector1._domainkey
   - Value: selector1-brevibrushes-com._domainkey.outlook.com
   - Repeat for selector2

**Verification:**
- Microsoft will verify automatically
- Check status in Exchange Admin Center

---

### DMARC (Domain-based Message Authentication, Reporting & Conformance)

**Purpose:** Tells receiving servers what to do with emails that fail SPF/DKIM checks and provides reporting.

**DNS Record (TXT):**
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@brevibrushes.com; ruf=mailto:dmarc@brevibrushes.com; pct=100
```

**Policy Options:**
- `p=none` - Monitor only (start here)
- `p=quarantine` - Send to spam if fails
- `p=reject` - Reject emails that fail (strictest)

**Recommended Starting Policy:**
```
v=DMARC1; p=none; rua=mailto:dmarc@brevibrushes.com; ruf=mailto:dmarc@brevibrushes.com; sp=none; aspf=r;
```

**Gradual Rollout:**
1. Start with `p=none` (monitor for 1-2 weeks)
2. Review DMARC reports
3. Move to `p=quarantine` (1-2 weeks)
4. Finally move to `p=reject` if all looks good

**To Add:**
1. Create email: dmarc@brevibrushes.com
2. Add TXT record with name `_dmarc`
3. Use the value above
4. Wait for propagation

---

## 4. Complete DNS Setup Checklist

### For brevibrushes.com:

1. **SPF Record:**
   ```
   Type: TXT
   Name: @
   Value: v=spf1 include:spf.protection.outlook.com -all
   ```

2. **DKIM Records (from Microsoft 365):**
   ```
   Type: CNAME
   Name: selector1._domainkey
   Value: [provided by Microsoft]
   
   Type: CNAME
   Name: selector2._domainkey
   Value: [provided by Microsoft]
   ```

3. **DMARC Record:**
   ```
   Type: TXT
   Name: _dmarc
   Value: v=DMARC1; p=none; rua=mailto:dmarc@brevibrushes.com; ruf=mailto:dmarc@brevibrushes.com
   ```

4. **MX Records (if using Microsoft 365):**
   ```
   Type: MX
   Priority: 0
   Value: brevibrushes-com.mail.protection.outlook.com
   ```

---

## 5. Testing Your DNS Records

### Online Tools:
1. **MXToolbox:** https://mxtoolbox.com/spf.aspx
2. **DMARC Analyzer:** https://www.dmarcanalyzer.com/
3. **Google Admin Toolbox:** https://toolbox.googleapps.com/apps/checkmx/

### Test Commands:
```bash
# Check SPF
nslookup -type=TXT brevibrushes.com

# Check DMARC
nslookup -type=TXT _dmarc.brevibrushes.com

# Check DKIM
nslookup -type=CNAME selector1._domainkey.brevibrushes.com
```

---

## 6. Additional Best Practices

### To Avoid Spam:

1. **Use Consistent From Address:**
   - Always use noreply@brevibrushes.com or marketing@brevibrushes.com
   - Don't change frequently

2. **Include Unsubscribe Link:**
   - Required by law (CAN-SPAM, GDPR)
   - Make it easy to find
   - Honor unsubscribe requests immediately

3. **Avoid Spam Trigger Words:**
   - "Free", "Act Now", "Limited Time", excessive exclamation marks
   - Use professional language

4. **Maintain Clean List:**
   - Remove bounced emails
   - Remove unsubscribed users
   - Don't send to inactive addresses

5. **Monitor Reputation:**
   - Check sender score: https://www.senderscore.org/
   - Monitor bounce rates
   - Track spam complaints

6. **Content Best Practices:**
   - Balance text and images
   - Include alt text for images
   - Test emails before sending
   - Use proper HTML structure

---

## 7. Implementation in BREVI

### Dual Email Provider Setup:

BREVI supports using **both Microsoft 365 and SendGrid** simultaneously:

- **Microsoft 365 (SMTP):** Used for system emails
  - Order confirmations
  - Shipping notifications
  - Initial welcome emails (from registration)
  - Support tickets
  - Password resets
  - Admin/Supplier account creation emails
  - All transactional emails

- **SendGrid:** Used for marketing emails
  - Email campaigns
  - Email automations (welcome series, abandoned cart, post-purchase, win-back, etc.)
  - Newsletters
  - Promotional emails
  - Marketing communications
  - All automated marketing workflows

### Configuration:

1. **System Email Provider (Microsoft 365):**
   - Go to `/admin/settings/email`
   - Configure SMTP settings (host, port, username, password)
   - This is used for all system/transactional emails

2. **Marketing Email Provider (SendGrid):**
   - Go to `/admin/settings/email`
   - Scroll to "Marketing Email Provider" section
   - Select "SendGrid"
   - Enter your SendGrid API key
   - Configure from email and name for marketing emails

### Benefits of This Setup:

- **Better Deliverability:** SendGrid is optimized for bulk marketing emails and automations
- **Higher Limits:** SendGrid can handle 22,000+ recipients easily
- **Better Analytics:** SendGrid provides detailed campaign and automation analytics
- **Separation of Concerns:** System emails stay reliable, marketing emails and automations get better deliverability
- **Cost Effective:** Use Microsoft 365 for system emails (already paid for), SendGrid for marketing
- **Automation Support:** SendGrid handles automated workflows (welcome series, abandoned cart, etc.) better than SMTP

### Current Status:
- ✅ SMTP configuration in `/admin/settings/email`
- ✅ Email sending via Microsoft 365 for system emails
- ✅ SendGrid integration for marketing emails
- ✅ Dual provider support (system vs marketing)
- ⚠️ DNS records need to be configured at domain level
- ⚠️ Batch sending with rate limiting implemented for campaigns

### Next Steps:
1. Configure SPF, DKIM, DMARC records at domain registrar
2. Enable DKIM in Microsoft 365 Exchange Admin Center
3. Set up SendGrid account and get API key
4. Configure SendGrid in `/admin/settings/email`
5. Verify sender domain in SendGrid
6. Set up monitoring for bounce rates and spam complaints

---

## Support

For issues with:
- **Microsoft 365 Setup:** Contact Microsoft Support
- **DNS Configuration:** Contact your domain registrar
- **BREVI Email System:** Check `/admin/settings/email` or contact development team

