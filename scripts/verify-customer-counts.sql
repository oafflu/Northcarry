-- ============================================
-- CUSTOMER COUNT VERIFICATION SCRIPT
-- This script verifies customer counts matching the segment calculation logic
-- Run this in Supabase SQL Editor to export results
-- ============================================

-- 1. Total customers matching is_customer criteria
-- (Same filter as calculateSegmentSubscriberCount for is_customer condition)
SELECT 
  'Total Customers (is_customer = true)' AS metric,
  COUNT(*) AS count
FROM profiles
WHERE role = 'customer'
  AND email IS NOT NULL
  AND email LIKE '%@%';

-- 2. Customers with valid emails (detailed breakdown)
SELECT 
  'Customer Details' AS report_type,
  id,
  email,
  first_name,
  last_name,
  created_at,
  role
FROM profiles
WHERE role = 'customer'
  AND email IS NOT NULL
  AND email LIKE '%@%'
ORDER BY created_at DESC;

-- 3. Customers by order count (matching getCustomersByTotalOrders logic)
WITH customer_order_counts AS (
  SELECT 
    p.id AS customer_id,
    p.email,
    COUNT(DISTINCT o.id) AS order_count
  FROM profiles p
  LEFT JOIN orders o ON (
    (o.user_id = p.id OR LOWER(o.customer_email) = LOWER(p.email))
    AND o.payment_status = 'paid'
  )
  WHERE p.role = 'customer'
    AND p.email IS NOT NULL
    AND p.email LIKE '%@%'
  GROUP BY p.id, p.email
),
categorized AS (
  SELECT 
    'Customers by Order Count' AS metric,
    CASE 
      WHEN order_count = 0 THEN '0 orders'
      WHEN order_count = 1 THEN '1 order'
      WHEN order_count BETWEEN 2 AND 5 THEN '2-5 orders'
      WHEN order_count BETWEEN 6 AND 10 THEN '6-10 orders'
      WHEN order_count > 10 THEN '11+ orders'
    END AS order_category,
    COUNT(*) AS customer_count
  FROM customer_order_counts
  GROUP BY 
    CASE 
      WHEN order_count = 0 THEN '0 orders'
      WHEN order_count = 1 THEN '1 order'
      WHEN order_count BETWEEN 2 AND 5 THEN '2-5 orders'
      WHEN order_count BETWEEN 6 AND 10 THEN '6-10 orders'
      WHEN order_count > 10 THEN '11+ orders'
    END
)
SELECT 
  metric,
  order_category,
  customer_count
FROM categorized
ORDER BY 
  CASE order_category
    WHEN '0 orders' THEN 1
    WHEN '1 order' THEN 2
    WHEN '2-5 orders' THEN 3
    WHEN '6-10 orders' THEN 4
    WHEN '11+ orders' THEN 5
  END;

-- 4. Exact count: Customers with 0 orders
WITH customer_order_counts AS (
  SELECT 
    p.id AS customer_id,
    p.email,
    COUNT(DISTINCT o.id) AS order_count
  FROM profiles p
  LEFT JOIN orders o ON (
    (o.user_id = p.id OR LOWER(o.customer_email) = LOWER(p.email))
    AND o.payment_status = 'paid'
  )
  WHERE p.role = 'customer'
    AND p.email IS NOT NULL
    AND p.email LIKE '%@%'
  GROUP BY p.id, p.email
)
SELECT 
  'Customers with 0 orders' AS metric,
  COUNT(*) AS count
FROM customer_order_counts
WHERE order_count = 0;

-- 5. Exact count: Customers with orders > 0
WITH customer_order_counts AS (
  SELECT 
    p.id AS customer_id,
    p.email,
    COUNT(DISTINCT o.id) AS order_count
  FROM profiles p
  LEFT JOIN orders o ON (
    (o.user_id = p.id OR LOWER(o.customer_email) = LOWER(p.email))
    AND o.payment_status = 'paid'
  )
  WHERE p.role = 'customer'
    AND p.email IS NOT NULL
    AND p.email LIKE '%@%'
  GROUP BY p.id, p.email
)
SELECT 
  'Customers with orders > 0' AS metric,
  COUNT(*) AS count
FROM customer_order_counts
WHERE order_count > 0;

-- 6. Detailed customer list with order counts (for export)
WITH customer_order_counts AS (
  SELECT 
    p.id AS customer_id,
    p.email,
    p.first_name,
    p.last_name,
    p.created_at,
    COUNT(DISTINCT o.id) AS paid_order_count,
    COALESCE(SUM(
      CASE 
        WHEN o.payment_status = 'paid' THEN 
          CAST(COALESCE(o.total, '0') AS NUMERIC)
        ELSE 0
      END
    ), 0) AS total_spent
  FROM profiles p
  LEFT JOIN orders o ON (
    o.user_id = p.id OR LOWER(o.customer_email) = LOWER(p.email)
  )
  WHERE p.role = 'customer'
    AND p.email IS NOT NULL
    AND p.email LIKE '%@%'
  GROUP BY p.id, p.email, p.first_name, p.last_name, p.created_at
)
SELECT 
  customer_id,
  email,
  first_name,
  last_name,
  created_at,
  paid_order_count,
  ROUND(total_spent::numeric, 2) AS total_spent
FROM customer_order_counts
ORDER BY paid_order_count DESC, total_spent DESC;

-- 7. Summary statistics
SELECT 
  'Summary Statistics' AS report_type,
  (SELECT COUNT(*) FROM profiles WHERE role = 'customer' AND email IS NOT NULL AND email LIKE '%@%') AS total_customers,
  (SELECT COUNT(DISTINCT user_id) FROM orders WHERE payment_status = 'paid' AND user_id IS NOT NULL) AS customers_with_paid_orders_by_user_id,
  (SELECT COUNT(DISTINCT LOWER(customer_email)) FROM orders WHERE payment_status = 'paid' AND customer_email IS NOT NULL) AS unique_customer_emails_in_orders,
  (SELECT COUNT(*) FROM orders WHERE payment_status = 'paid') AS total_paid_orders;

-- 8. Customers with orders but no matching profile (potential data issues)
SELECT 
  'Orders without matching customer profile' AS metric,
  COUNT(DISTINCT o.customer_email) AS count
FROM orders o
WHERE o.payment_status = 'paid'
  AND o.customer_email IS NOT NULL
  AND o.customer_email LIKE '%@%'
  AND NOT EXISTS (
    SELECT 1 FROM profiles p 
    WHERE LOWER(p.email) = LOWER(o.customer_email)
      AND p.role = 'customer'
  );

-- 9. Order matching verification (check for customers with orders via email but not user_id)
SELECT 
  'Order Matching Analysis' AS report_type,
  COUNT(DISTINCT p.id) AS customers_with_orders_by_user_id,
  COUNT(DISTINCT CASE WHEN o.customer_email IS NOT NULL THEN p.id END) AS customers_with_orders_by_email,
  COUNT(DISTINCT o.id) AS total_paid_orders
FROM profiles p
INNER JOIN orders o ON (
  o.user_id = p.id OR LOWER(o.customer_email) = LOWER(p.email)
)
WHERE p.role = 'customer'
  AND p.email IS NOT NULL
  AND p.email LIKE '%@%'
  AND o.payment_status = 'paid';
