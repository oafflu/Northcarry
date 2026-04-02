# Reviews RLS Policies Setup

## Issue
The `reviews` table has no RLS (Row Level Security) policies, which prevents all queries from working. This is why reviews aren't showing on the homepage even though 282 reviews are approved.

## Solution
Run the SQL script to create the necessary RLS policies:

```sql
-- Run this script in your Supabase SQL editor
-- File: scripts/create-reviews-rls-policies.sql
```

## What the script does:

1. **Enables RLS** on `reviews` and `review_images` tables
2. **Creates policies** that allow:
   - **Public access**: Anyone (including anonymous users) can view approved, non-hidden reviews
   - **User access**: Users can create and update their own reviews
   - **Admin access**: Admins can view and manage all reviews (including hidden/unapproved)

## After running the script:

1. The homepage will be able to fetch and display approved reviews
2. Product pages will show reviews correctly
3. Users can submit reviews
4. Admins can manage all reviews through the admin panel

## To run the script:

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `scripts/create-reviews-rls-policies.sql`
4. Run the script
5. Refresh your homepage - reviews should now appear!

