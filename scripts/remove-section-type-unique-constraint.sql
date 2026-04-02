-- Remove the UNIQUE constraint on (template_id, section_type) to allow multiple instances of the same section type
-- This allows admins to reuse sections like "Image + Text" multiple times in a template

-- Try to drop the constraint with the standard PostgreSQL naming convention first
ALTER TABLE cms_template_sections 
DROP CONSTRAINT IF EXISTS cms_template_sections_template_id_section_type_key;

-- If the above doesn't work, find and drop it dynamically
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find any unique constraint on this table (there should only be one on template_id + section_type)
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'cms_template_sections'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 2;
    
    -- Drop the constraint if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE cms_template_sections DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore errors - constraint might already be dropped
        NULL;
END $$;
