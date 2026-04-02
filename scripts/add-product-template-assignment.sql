-- Add template assignment to products
-- This allows each product to use a different page template

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES cms_page_templates(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_template_id ON products(template_id);

-- Add comment
COMMENT ON COLUMN products.template_id IS 'References cms_page_templates.id - allows each product to use a custom page template';

