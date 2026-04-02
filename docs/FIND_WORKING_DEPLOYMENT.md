# Finding the Working Deployment (Nov 28, 2024)

## Context
- Campaign sent to 22k+ customers on November 28, 2024
- All emails (system + SendGrid) were working perfectly at that time
- Need to identify the deployment/commit that was working

## Steps to Find the Working Deployment

### 1. Check Vercel Deployment History
1. Go to: https://vercel.com/your-project/deployments
2. Filter by date: November 27-29, 2024
3. Look for deployments around the time the campaign was sent
4. Check deployment logs for successful email sends

### 2. Check Git Commit History
```bash
# View commits around Nov 28
git log --oneline --since="2024-11-27" --until="2024-11-29"

# View commits with email-related changes
git log --oneline --grep="email\|campaign\|sendgrid" -i --since="2024-11-25"

# View all recent commits
git log --oneline --all --decorate | head -30
```

### 3. Check Deployment Logs
In Vercel dashboard:
- Look for deployments with successful email campaign sends
- Check build logs for any email-related errors
- Look for commits that mention "campaign" or "22k"

### 4. Identify Key Commits
Look for commits that:
- Fixed email configuration
- Added SendGrid support
- Fixed bulk email sending
- Were deployed right before Nov 28

## What to Look For

### Working Deployment Characteristics:
- ✅ SendGrid API key properly configured
- ✅ Microsoft 365 SMTP working
- ✅ Bulk email sending functional
- ✅ No email-related errors in logs

### Commits to Check:
- Email configuration changes
- SendGrid integration
- Bulk email sending fixes
- Campaign sending implementation

## After Finding the Working Deployment

1. **Note the commit hash** (e.g., `abc1234`)
2. **Check what changed** after that commit:
   ```bash
   git log abc1234..HEAD --oneline
   ```
3. **Review the diff** to see what broke:
   ```bash
   git diff abc1234 HEAD -- lib/email-marketing.ts
   git diff abc1234 HEAD -- lib/email.ts
   ```

## Environment Variables Question

**Should you add email config back to Vercel?**

**Answer: YES, as a backup** (but not required)

### Recommended Setup:
1. **Primary**: Database settings (via `/admin/settings/email`)
   - Editable without redeploy
   - Cached for performance (now implemented)

2. **Backup**: Environment variables in Vercel
   - Only used if database settings are missing
   - Good safety net
   - Doesn't hurt to have them

### What to Add to Vercel:
```env
# Optional backup (only used if database doesn't have values)
EMAIL_SERVER_HOST=smtp.office365.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=hello@brevibrushes.com
EMAIL_SERVER_PASSWORD=your-password
EMAIL_FROM=hello@brevibrushes.com
SENDGRID_API_KEY=SG.your-key-here
```

**Note**: With the caching fix, database settings are now efficient, so env vars are truly optional. But having them as backup is a good practice.

