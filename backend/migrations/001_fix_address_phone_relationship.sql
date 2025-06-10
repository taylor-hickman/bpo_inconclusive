-- Create a new table to properly link addresses and phones together
CREATE TABLE IF NOT EXISTS provider_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    address_id INTEGER NOT NULL,
    phone_id INTEGER NOT NULL,
    location_type TEXT DEFAULT 'Primary', -- Primary, Secondary, etc.
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES providers(id),
    FOREIGN KEY (address_id) REFERENCES provider_addresses(id),
    FOREIGN KEY (phone_id) REFERENCES provider_phones(id),
    UNIQUE(provider_id, address_id, phone_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_provider_locations_provider_id ON provider_locations(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_locations_address_id ON provider_locations(address_id);
CREATE INDEX IF NOT EXISTS idx_provider_locations_phone_id ON provider_locations(phone_id);

-- Migrate existing data to the new structure
-- This assumes that addresses and phones with the same row number should be linked
INSERT OR IGNORE INTO provider_locations (provider_id, address_id, phone_id, location_type)
WITH numbered_addresses AS (
    SELECT 
        id as address_id,
        provider_id,
        address_category,
        ROW_NUMBER() OVER (PARTITION BY provider_id ORDER BY created_at) as row_num
    FROM provider_addresses
),
numbered_phones AS (
    SELECT 
        id as phone_id,
        provider_id,
        ROW_NUMBER() OVER (PARTITION BY provider_id ORDER BY created_at) as row_num
    FROM provider_phones
)
SELECT 
    na.provider_id,
    na.address_id,
    COALESCE(np.phone_id, 0) as phone_id,
    na.address_category as location_type
FROM numbered_addresses na
LEFT JOIN numbered_phones np ON na.provider_id = np.provider_id AND na.row_num = np.row_num
WHERE na.address_id IS NOT NULL;