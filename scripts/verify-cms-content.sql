-- Verify CMS Content was seeded correctly
-- Run this to check if all CMS sections have content

SELECT 
  section,
  CASE 
    WHEN content->>'title' IS NOT NULL THEN content->>'title'
    ELSE 'No title'
  END as title,
  CASE 
    WHEN section = 'faq' THEN 
      jsonb_array_length(content->'questions')::text || ' questions'
    WHEN section IN ('privacy', 'terms', 'refund') THEN
      CASE 
        WHEN length(content->>'content') > 0 THEN 'Content present (' || length(content->>'content') || ' chars)'
        ELSE 'No content'
      END
    WHEN section = 'checkout' THEN
      CASE 
        WHEN content->>'title' IS NOT NULL THEN 'Configured'
        ELSE 'Not configured'
      END
    ELSE 'Unknown format'
  END as status,
  updated_at
FROM cms_content
WHERE section IN ('privacy', 'terms', 'refund', 'faq', 'checkout')
ORDER BY section;

-- Check if any sections are missing
SELECT 
  'Missing sections' as check_type,
  array_agg(missing_section) as missing
FROM (
  SELECT unnest(ARRAY['privacy', 'terms', 'refund', 'faq', 'checkout']) as missing_section
  EXCEPT
  SELECT section FROM cms_content WHERE section IN ('privacy', 'terms', 'refund', 'faq', 'checkout')
) missing;

