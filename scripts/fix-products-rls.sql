-- Fix RLS policies for products, product_variants, and product_images

-- Enable RLS if not already enabled
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Products RLS Policies
-- Anyone can view active products
DROP POLICY IF EXISTS "Anyone can view active products" ON products;
CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT
  USING (status = 'active');

-- Admins can manage all products
DROP POLICY IF EXISTS "Admins can manage products" ON products;
CREATE POLICY "Admins can manage products" ON products
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Product Variants RLS Policies
-- Anyone can view variants of active products
DROP POLICY IF EXISTS "Anyone can view variants of active products" ON product_variants;
CREATE POLICY "Anyone can view variants of active products" ON product_variants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variants.product_id
      AND products.status = 'active'
    )
  );

-- Admins can manage all variants
DROP POLICY IF EXISTS "Admins can manage variants" ON product_variants;
CREATE POLICY "Admins can manage variants" ON product_variants
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Product Images RLS Policies
-- Anyone can view images of active products
DROP POLICY IF EXISTS "Anyone can view images of active products" ON product_images;
CREATE POLICY "Anyone can view images of active products" ON product_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.status = 'active'
    )
  );

-- Admins can manage all product images
DROP POLICY IF EXISTS "Admins can manage product images" ON product_images;
CREATE POLICY "Admins can manage product images" ON product_images
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

