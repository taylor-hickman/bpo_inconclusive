-- Check if we have providers with NULL is_correct values
SELECT COUNT(DISTINCT p.id) as providers_needing_validation
FROM providers p
LEFT JOIN provider_addresses pa ON p.id = pa.provider_id
LEFT JOIN provider_phones pp ON p.id = pp.provider_id
WHERE pa.is_correct IS NULL OR pp.is_correct IS NULL;

-- Check validation sessions
SELECT COUNT(*) as active_sessions FROM validation_sessions WHERE status = 'in_progress';

-- Sample provider data
SELECT p.id, p.npi, p.provider_name, 
       COUNT(DISTINCT pa.id) as address_count,
       COUNT(DISTINCT pp.id) as phone_count
FROM providers p
LEFT JOIN provider_addresses pa ON p.id = pa.provider_id
LEFT JOIN provider_phones pp ON p.id = pp.provider_id
GROUP BY p.id, p.npi, p.provider_name
LIMIT 5;