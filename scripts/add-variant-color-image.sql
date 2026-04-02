-- Add color_image_url field to product_variants table
-- This is separate from image_url and is used for variant color selection display

ALTER TABLE product_variants 
ADD COLUMN IF NOT EXISTS color_image_url TEXT;

-- Add comment to explain the difference
COMMENT ON COLUMN product_variants.image_url IS 'Main variant image used in product gallery';
COMMENT ON COLUMN product_variants.color_image_url IS 'Color swatch image used in variant selection (different from main variant images)';

