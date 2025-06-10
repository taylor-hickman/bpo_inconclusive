-- Check if link_id is populated
SELECT 
    COUNT(*) as total_addresses,
    COUNT(link_id) as addresses_with_link_id
FROM provider_addresses;

-- Check for duplicate addresses for same provider
SELECT 
    pa.provider_id,
    p.npi,
    p.provider_name,
    pa.address1,
    pa.city,
    pa.state,
    COUNT(*) as duplicate_count
FROM provider_addresses pa
JOIN providers p ON pa.provider_id = p.id
GROUP BY pa.provider_id, p.npi, p.provider_name, pa.address1, pa.city, pa.state
HAVING COUNT(*) > 1
LIMIT 10;

-- Check for duplicate phones
SELECT 
    pp.phone,
    COUNT(DISTINCT pp.provider_id) as provider_count,
    COUNT(*) as total_occurrences
FROM provider_phones pp
GROUP BY pp.phone
HAVING COUNT(*) > 1
LIMIT 10;

-- Check a specific provider with many addresses
SELECT 
    p.npi,
    p.provider_name,
    pa.address1,
    pa.city,
    pa.state,
    pa.link_id,
    pp.phone,
    pp.link_id as phone_link_id
FROM providers p
LEFT JOIN provider_addresses pa ON p.id = pa.provider_id
LEFT JOIN provider_phones pp ON p.id = pp.provider_id
WHERE p.npi = '1700847738'
LIMIT 20;