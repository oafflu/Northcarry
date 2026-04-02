# BREVI Email Templates

This directory contains converted email templates for the BREVI email marketing system.

## Templates

### 1. `brevi-email-template.html`
- **Type:** Product Launch Email
- **Description:** Template for announcing new product launches
- **Variables Used:**
  - `{{firstName|default:'there'}}` - Customer first name
  - `{{unsubscribe_link}}` - Unsubscribe link

### 2. `brevi-clearance-sale-template.html`
- **Type:** Clearance Sale Email
- **Description:** Template for clearance sale announcements
- **Variables Used:**
  - `{{unsubscribe_link}}` - Unsubscribe link

### 3. `grand-finale-discount.html`
- **Type:** Grand Finale Discount Email
- **Description:** Template for final discount offers (e.g., "Week of Discounts" finale)
- **Variables Used:**
  - `{{firstName|default:'there'}}` - Customer first name
  - `{{unsubscribe_link}}` - Unsubscribe link

### 4. `black-friday-vip-early-access.html`
- **Type:** Black Friday VIP Early Access Email
- **Description:** Template for VIP early access to Black Friday sales with discount codes
- **Variables Used:**
  - `{{firstName|default:'there'}}` - Customer first name
  - `{{unsubscribe_link}}` - Unsubscribe link

### 5. `easter-sale-50-off.html`
- **Type:** Easter Sale Email
- **Description:** Template for Easter sale promotions with 50% discount
- **Variables Used:**
  - `{{firstName|default:'Hey'}}` - Customer first name
  - `{{unsubscribe_link}}` - Unsubscribe link

### 6. `store-closing-clearance-sale.html`
- **Type:** Store Closing Clearance Sale Email
- **Description:** Template for store closing announcements with 50% off clearance sale
- **Variables Used:**
  - `{{unsubscribe_link}}` - Unsubscribe link
  - `{{organizationName}}` - Organization name
  - `{{organizationAddress}}` - Organization address

### 7. `final-call-65-off.html`
- **Type:** Final Call Urgency Email
- **Description:** Template for final call promotions with countdown timer and 65% off discount
- **Variables Used:**
  - `{{firstName|default:'there'}}` - Customer first name
  - `{{email}}` - Customer email (for countdown timer)
  - `{{unsubscribe_link}}` - Unsubscribe link
  - `{{organizationName}}` - Organization name
  - `{{organizationAddress}}` - Organization address

### 8. `welcome-back-65-off.html`
- **Type:** Welcome Back Email
- **Description:** Template for re-engaging customers with welcome back offer and 65% off discount
- **Variables Used:**
  - `{{firstName|default:'there'}}` - Customer first name
  - `{{unsubscribe_link}}` - Unsubscribe link
  - `{{organizationName}}` - Organization name
  - `{{organizationAddress}}` - Organization address

## Variable Format

BREVI email templates use the following variable format:

- **First Name:** `{{firstName|default:'there'}}`
- **Unsubscribe Link:** `{{unsubscribe_link}}`
- **Organization Name:** Hardcoded as "Brevi Brushes" (can be replaced with `{{organizationName}}` if needed)

## Usage

These templates can be imported into the BREVI email marketing system via:
- `/admin/email-marketing/templates/import`

## Template Structure

All templates follow a consistent structure:
1. **Header Section** - Free shipping banner and logo
2. **Main Content Section** - Primary message and call-to-action
3. **Product Gallery Section** - Product images and links
4. **Footer Section** - Social media links, privacy/terms, unsubscribe

## Notes

- All templates have been converted from Klaviyo format
- Klaviyo tracking pixels and branding have been removed
- URLs have been updated to use `brevibrushes.com`
- Templates are optimized for email client compatibility

