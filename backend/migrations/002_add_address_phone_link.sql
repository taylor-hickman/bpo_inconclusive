-- Add a link_id column to track which addresses and phones were loaded together from the same CSV row
ALTER TABLE provider_addresses ADD COLUMN link_id TEXT;
ALTER TABLE provider_phones ADD COLUMN link_id TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_provider_addresses_link_id ON provider_addresses(link_id);
CREATE INDEX IF NOT EXISTS idx_provider_phones_link_id ON provider_phones(link_id);

-- For existing data, we'll link addresses and phones based on their order of creation
-- This is a best-effort approach since we don't have the original pairing information
UPDATE provider_addresses 
SET link_id = printf('%d-%d', provider_id, (
    SELECT COUNT(*) + 1 
    FROM provider_addresses pa2 
    WHERE pa2.provider_id = provider_addresses.provider_id 
    AND pa2.id < provider_addresses.id
))
WHERE link_id IS NULL;

UPDATE provider_phones 
SET link_id = printf('%d-%d', provider_id, (
    SELECT COUNT(*) + 1 
    FROM provider_phones pp2 
    WHERE pp2.provider_id = provider_phones.provider_id 
    AND pp2.id < provider_phones.id
))
WHERE link_id IS NULL;