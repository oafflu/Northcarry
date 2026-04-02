-- ============================================
-- QUICK CUSTOMER COUNT SUMMARY
-- Run this for a quick overview of customer counts
-- ============================================

-- Total customers (matching is_customer = true criteria)
SELECT 
  'Total Customers' AS metric,
  COUNT(*) AS count
FROM profiles
WHERE role = 'customer'
  AND email IS NOT NULL
  AND email LIKE '%@%';

-- Customers with 0 paid orders
SELECT 
  'Customers with 0 Paid Orders' AS metric,
  COUNT(*) AS count
FROM profiles p
WHERE p.role = 'customer'
  AND p.email IS NOT NULL
  AND p.email LIKE '%@%'
  AND NOT EXISTS (
    SELECT 1 
    FROM orders o 
    WHERE (o.user_id = p.id OR LOWER(o.customer_email) = LOWER(p.email))
      AND o.payment_status = 'paid'
  );

-- Customers with 1+ paid orders
SELECT 
  'Customers with 1+ Paid Orders' AS metric,
  COUNT(DISTINCT p.id) AS count
FROM profiles p
INNER JOIN orders o ON (
  (o.user_id = p.id OR LOWER(o.customer_email) = LOWER(p.email))
  AND o.payment_status = 'paid'
)
WHERE p.role = 'customer'
  AND p.email IS NOT NULL
  AND p.email LIKE '%@%';

-- Verification: Sum should equal total
SELECT 
  'Verification' AS metric,
  (SELECT COUNT(*) FROM profiles WHERE role = 'customer' AND email IS NOT NULL AND email LIKE '%@%') AS total_customers,
  (SELECT COUNT(*) FROM profiles p WHERE p.role = 'customer' AND p.email IS NOT NULL AND p.email LIKE '%@%' AND NOT EXISTS (SELECT 1 FROM orders o WHERE (o.user_id = p.id OR LOWER(o.customer_email) = LOWER(p.email)) AND o.payment_status = 'paid')) AS customers_with_0_orders,
  (SELECT COUNT(DISTINCT p.id) FROM profiles p INNER JOIN orders o ON ((o.user_id = p.id OR LOWER(o.customer_email) = LOWER(p.email)) AND o.payment_status = 'paid') WHERE p.role = 'customer' AND p.email IS NOT NULL AND p.email LIKE '%@%') AS customers_with_1plus_orders,
  (SELECT COUNT(*) FROM profiles WHERE role = 'customer' AND email IS NOT NULL AND email LIKE '%@%') - 
  (SELECT COUNT(*) FROM profiles p WHERE p.role = 'customer' AND p.email IS NOT NULL AND p.email LIKE '%@%' AND NOT EXISTS (SELECT 1 FROM orders o WHERE (o.user_id = p.id OR LOWER(o.customer_email) = LOWER(p.email)) AND o.payment_status = 'paid')) -
  (SELECT COUNT(DISTINCT p.id) FROM profiles p INNER JOIN orders o ON ((o.user_id = p.id OR LOWER(o.customer_email) = LOWER(p.email)) AND o.payment_status = 'paid') WHERE p.role = 'customer' AND p.email IS NOT NULL AND p.email LIKE '%@%') AS difference;
