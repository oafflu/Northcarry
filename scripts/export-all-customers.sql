-- ============================================
-- EXPORT ALL CUSTOMERS WITH DETAILS
-- Run this in Supabase SQL Editor and export results as CSV
-- ============================================

WITH customer_stats AS (
  SELECT 
    p.id AS customer_id,
    p.email,
    p.first_name,
    p.last_name,
    p.phone,
    p.created_at,
    p.updated_at,
    -- Count paid orders
    COUNT(DISTINCT CASE WHEN o.payment_status = 'paid' THEN o.id END) AS paid_order_count,
    -- Count all orders
    COUNT(DISTINCT o.id) AS total_order_count,
    -- Calculate total spent (from paid orders only)
    COALESCE(SUM(
      CASE 
        WHEN o.payment_status = 'paid' THEN 
          CAST(COALESCE(o.total, '0') AS NUMERIC)
        ELSE 0
      END
    ), 0) AS total_spent,
    -- Get latest order date
    MAX(o.created_at) AS last_order_date,
    -- Check if has subscription
    CASE WHEN EXISTS (
      SELECT 1 FROM customer_subscriptions cs 
      WHERE cs.user_id = p.id AND cs.status = 'active'
    ) THEN true ELSE false END AS has_active_subscription
  FROM profiles p
  LEFT JOIN orders o ON (
    o.user_id = p.id OR LOWER(o.customer_email) = LOWER(p.email)
  )
  WHERE p.role = 'customer'
    AND p.email IS NOT NULL
    AND p.email LIKE '%@%'
  GROUP BY p.id, p.email, p.first_name, p.last_name, p.phone, p.created_at, p.updated_at
)
SELECT 
  customer_id,
  email,
  first_name,
  last_name,
  phone,
  created_at AS account_created_at,
  updated_at AS account_updated_at,
  paid_order_count,
  total_order_count,
  ROUND(total_spent::numeric, 2) AS total_spent,
  last_order_date,
  has_active_subscription,
  CASE 
    WHEN paid_order_count = 0 THEN 'No Orders'
    WHEN paid_order_count = 1 THEN '1 Order'
    WHEN paid_order_count BETWEEN 2 AND 5 THEN '2-5 Orders'
    WHEN paid_order_count BETWEEN 6 AND 10 THEN '6-10 Orders'
    ELSE '11+ Orders'
  END AS order_category
FROM customer_stats
ORDER BY 
  paid_order_count DESC,
  total_spent DESC,
  created_at DESC;
