# Review System Setup Guide

## Overview

A comprehensive review management system has been created for the BREVI admin panel, including:
- Full admin interface for managing reviews
- Email automation to request reviews 25 days after purchase
- Advanced filtering and moderation features
- Bulk actions for efficient review management

## Database Setup

### 1. Add Review Management Columns

Run the following SQL script in your Supabase SQL Editor:

**File**: `scripts/add-review-management-columns.sql`

This adds:
- `is_hidden` column to reviews table (for hiding reviews from website)
- `helpful_count` column (for tracking helpful votes)

### 2. Create Review Requests Table

Run the following SQL script to create the review requests tracking table:

**File**: `scripts/create-review-requests-table.sql`

This creates the `review_requests` table to track which customers have been sent review request emails.

## Email Automation Setup

### 1. Create Review Request Automation Template

The review request automation template has been added to the automation templates creation script. To create it:

1. Go to `/admin/email-marketing/automations`
2. Click "Create Templates" (or call the API endpoint `/api/admin/automations/create-templates`)
3. The "Review Request" automation will be created automatically

### 2. Activate the Automation

1. Go to `/admin/email-marketing/automations`
2. Find the "Review Request" automation
3. Click to activate it

### 3. Configure Cron Job

The review request cron job is already configured in `vercel.json`:

```json
{
  "path": "/api/cron/review-requests",
  "schedule": "0 9 * * *"
}
```

This runs daily at 9 AM UTC.

**For Vercel deployment:**
- The cron job is automatically set up
- Make sure `CRON_SECRET` environment variable is set in Vercel

**For manual testing:**
- Call `GET /api/cron/review-requests` with `Authorization: Bearer {CRON_SECRET}` header

## Features

### Admin Reviews Page (`/admin/reviews`)

#### Statistics Dashboard
- Total reviews count
- Approved reviews count
- Pending reviews count
- Hidden reviews count
- Average rating

#### Filtering & Search
- Filter by rating (1-5 stars)
- Filter by status (Approved, Pending, Hidden)
- Search by review title or comment
- Sort by: Most Recent, Oldest, Highest Rating, Lowest Rating, Most Helpful

#### Review Management
- **Approve**: Approve pending reviews
- **Hide**: Hide reviews from website (but keep in database)
- **Show**: Unhide reviews
- **Delete**: Permanently delete reviews and their images
- **Add Manually**: Create reviews on behalf of customers

#### Bulk Actions
- Select multiple reviews
- Bulk approve
- Bulk hide
- Bulk delete

#### Advanced Features
- View review images in modal
- See verified purchase badges
- Track helpful votes
- View customer information
- View associated product

## Email Automation

### Review Request Flow

1. **Trigger**: 25 days after order completion
2. **Automation**: Sends email with review link
3. **Tracking**: Records in `review_requests` table to prevent duplicates
4. **Smart Logic**: 
   - Skips if customer already reviewed products from that order
   - Skips if review request already sent for that order

### Email Template Variables

The review request email supports these variables:
- `{{firstName}}` - Customer's first name
- `{{name}}` - Customer's full name
- `{{reviewLink}}` - Direct link to product review page
- `{{productName}}` - Name of the first product in the order
- `{{orderNumber}}` - Order number

## API Endpoints

### Review Management Actions

Located in `app/actions/admin-reviews.ts`:

- `getReviews(filters?)` - Get all reviews with filtering
- `getReviewStats()` - Get review statistics
- `approveReview(reviewId)` - Approve a review
- `hideReview(reviewId)` - Hide a review
- `showReview(reviewId)` - Show a hidden review
- `deleteReview(reviewId)` - Delete a review
- `addReviewManually(data)` - Manually add a review
- `bulkApproveReviews(reviewIds[])` - Bulk approve
- `bulkHideReviews(reviewIds[])` - Bulk hide
- `bulkDeleteReviews(reviewIds[])` - Bulk delete

### Cron Job

**Endpoint**: `/api/cron/review-requests`

**Method**: GET or POST

**Authentication**: Bearer token with `CRON_SECRET`

**Function**: 
- Finds orders completed 25 days ago
- Checks if review request already sent
- Checks if customer already reviewed
- Sends review request email via automation
- Records in `review_requests` table

## Permissions

- **Admin**: Full access to reviews management
- **Other roles**: No access (reviews management is admin-only)

## Usage

### For Admins

1. **View All Reviews**: Go to `/admin/reviews`
2. **Filter Reviews**: Use the filter dropdowns and search bar
3. **Moderate Reviews**: 
   - Click approve button to approve pending reviews
   - Click hide button to hide inappropriate reviews
   - Click delete button to remove spam reviews
4. **Add Reviews Manually**:
   - Click "Add Review" button
   - Fill in customer and product information
   - Submit to create review
5. **Bulk Actions**:
   - Select multiple reviews using checkboxes
   - Use bulk action buttons to approve, hide, or delete multiple reviews at once

### Email Automation

The system automatically:
1. Checks daily for orders completed 25 days ago
2. Sends review request emails to customers
3. Tracks which customers have been contacted
4. Prevents duplicate emails

## Notes

- Hidden reviews are not shown on the website but remain in the database
- Deleted reviews are permanently removed along with their images
- Review requests are tracked to prevent spam
- The system checks if customers already reviewed before sending requests
- Manual reviews can be added for any product and customer

