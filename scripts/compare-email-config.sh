#!/bin/bash
# Compare email configuration between working commit and current

WORKING_COMMIT="0d8db59"  # "campaign send fix" - likely the working one
CURRENT_COMMIT="HEAD"

echo "=== Comparing Email Configuration ==="
echo "Working Commit: $WORKING_COMMIT (campaign send fix)"
echo "Current Commit: $CURRENT_COMMIT"
echo ""

echo "=== Files Changed in Email System ==="
git diff $WORKING_COMMIT $CURRENT_COMMIT --name-only | grep -E "(email|sendgrid|smtp)" | head -20

echo ""
echo "=== Changes in lib/email-marketing.ts ==="
git diff $WORKING_COMMIT $CURRENT_COMMIT -- lib/email-marketing.ts | head -100

echo ""
echo "=== Changes in lib/email.ts ==="
git diff $WORKING_COMMIT $CURRENT_COMMIT -- lib/email.ts | head -100

echo ""
echo "=== Changes in app/actions/email-campaigns.ts ==="
git diff $WORKING_COMMIT $CURRENT_COMMIT -- app/actions/email-campaigns.ts | head -100

