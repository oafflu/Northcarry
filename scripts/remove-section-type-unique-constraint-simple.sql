-- Remove the UNIQUE constraint on (template_id, section_type) to allow multiple instances of the same section type
-- This allows admins to reuse sections like "Image + Text" multiple times in a template

-- Try to drop the constraint with common name patterns
-- If the constraint doesn't exist, these will fail silently (which is fine)

-- Method 1: Try the standard PostgreSQL naming convention
ALTER TABLE cms_template_sections 
DROP CONSTRAINT IF EXISTS cms_template_sections_template_id_section_type_key;

-- Method 2: If the above doesn't work, try finding it dynamically
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'cms_template_sections'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 2;
    
    -- Drop the constraint if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE cms_template_sections DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
END $$;

