-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom types and enums
CREATE TYPE validation_status AS ENUM ('in_progress', 'completed', 'cancelled', 'on_hold');
CREATE TYPE address_category AS ENUM ('practice', 'mailing', 'billing', 'other');
CREATE TYPE call_attempt_status AS ENUM ('successful', 'no_answer', 'busy', 'disconnected', 'invalid');

-- Create audit function for tracking changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Users table with enhanced audit fields
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Create trigger for users updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_uuid ON users(uuid);
CREATE INDEX idx_users_active ON users(is_active);

-- Providers table with enhanced fields and full-text search
CREATE TABLE providers (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    npi VARCHAR(10) UNIQUE NOT NULL,
    gnpi VARCHAR(20),
    provider_name VARCHAR(500) NOT NULL,
    specialty VARCHAR(200),
    provider_group VARCHAR(500),
    license_numbers TEXT[],
    credentials VARCHAR(100)[],
    search_vector tsvector,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    CONSTRAINT valid_npi CHECK (npi ~ '^\d{10}$')
);

-- Create trigger for providers updated_at
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create full-text search trigger for providers
CREATE OR REPLACE FUNCTION update_provider_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', 
        COALESCE(NEW.provider_name, '') || ' ' ||
        COALESCE(NEW.specialty, '') || ' ' ||
        COALESCE(NEW.provider_group, '') || ' ' ||
        COALESCE(NEW.npi, '')
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_providers_search_vector 
    BEFORE INSERT OR UPDATE ON providers
    FOR EACH ROW EXECUTE FUNCTION update_provider_search_vector();

-- Create indexes for providers
CREATE INDEX idx_providers_npi ON providers(npi);
CREATE INDEX idx_providers_uuid ON providers(uuid);
CREATE INDEX idx_providers_search_vector ON providers USING gin(search_vector);
CREATE INDEX idx_providers_specialty ON providers(specialty);
CREATE INDEX idx_providers_active ON providers(is_active);
CREATE INDEX idx_providers_metadata ON providers USING gin(metadata);

-- Provider addresses with enhanced validation tracking
CREATE TABLE provider_addresses (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    address_category address_category NOT NULL DEFAULT 'practice',
    address1 VARCHAR(500) NOT NULL,
    address2 VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(2),
    zip VARCHAR(10),
    country VARCHAR(2) DEFAULT 'US',
    
    -- Validation fields
    is_correct BOOLEAN,
    corrected_address1 VARCHAR(500),
    corrected_address2 VARCHAR(500),
    corrected_city VARCHAR(100),
    corrected_state VARCHAR(2),
    corrected_zip VARCHAR(10),
    
    -- Validation metadata
    validation_notes TEXT,
    validation_metadata JSONB DEFAULT '{}'::jsonb,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Audit fields
    validated_by INTEGER REFERENCES users(id),
    validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    -- Legacy compatibility
    link_id VARCHAR(50),
    
    CONSTRAINT valid_state CHECK (state ~ '^[A-Z]{2}$'),
    CONSTRAINT valid_zip CHECK (zip ~ '^\d{5}(-\d{4})?$')
);

-- Create trigger for provider_addresses updated_at
CREATE TRIGGER update_provider_addresses_updated_at BEFORE UPDATE ON provider_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for provider_addresses
CREATE INDEX idx_provider_addresses_provider_id ON provider_addresses(provider_id);
CREATE INDEX idx_provider_addresses_uuid ON provider_addresses(uuid);
CREATE INDEX idx_provider_addresses_link_id ON provider_addresses(link_id);
CREATE INDEX idx_provider_addresses_category ON provider_addresses(address_category);
CREATE INDEX idx_provider_addresses_state ON provider_addresses(state);
CREATE INDEX idx_provider_addresses_validation ON provider_addresses(is_correct, validated_at);
CREATE INDEX idx_provider_addresses_metadata ON provider_addresses USING gin(validation_metadata);

-- Provider phones with enhanced validation and flagging
CREATE TABLE provider_phones (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    phone_type VARCHAR(20) DEFAULT 'office',
    extension VARCHAR(10),
    
    -- Validation fields
    is_correct BOOLEAN,
    corrected_phone VARCHAR(20),
    
    -- Phone validation metadata
    validation_notes TEXT,
    validation_metadata JSONB DEFAULT '{}'::jsonb,
    call_attempts JSONB DEFAULT '[]'::jsonb,
    is_flagged BOOLEAN DEFAULT false,
    flag_reason TEXT,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Audit fields
    validated_by INTEGER REFERENCES users(id),
    validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    -- Legacy compatibility
    link_id VARCHAR(50),
    
    CONSTRAINT valid_phone CHECK (phone ~ '^\+?[\d\s\-\(\)\.]+$')
);

-- Create trigger for provider_phones updated_at
CREATE TRIGGER update_provider_phones_updated_at BEFORE UPDATE ON provider_phones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for provider_phones
CREATE INDEX idx_provider_phones_provider_id ON provider_phones(provider_id);
CREATE INDEX idx_provider_phones_uuid ON provider_phones(uuid);
CREATE INDEX idx_provider_phones_phone ON provider_phones(phone);
CREATE INDEX idx_provider_phones_link_id ON provider_phones(link_id);
CREATE INDEX idx_provider_phones_flagged ON provider_phones(is_flagged);
CREATE INDEX idx_provider_phones_validation ON provider_phones(is_correct, validated_at);
CREATE INDEX idx_provider_phones_metadata ON provider_phones USING gin(validation_metadata);
CREATE INDEX idx_provider_phones_call_attempts ON provider_phones USING gin(call_attempts);

-- Validation sessions with enhanced tracking and partitioning
CREATE TABLE validation_sessions (
    id SERIAL,
    uuid UUID DEFAULT uuid_generate_v4() NOT NULL,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    
    -- Session tracking
    status validation_status DEFAULT 'in_progress',
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    
    -- Call attempts with detailed tracking
    call_attempts JSONB DEFAULT '[]'::jsonb,
    call_attempt_1 TIMESTAMPTZ,
    call_attempt_2 TIMESTAMPTZ,
    
    -- Session lifecycle
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    locked_by INTEGER REFERENCES users(id),
    
    -- Validation results
    validation_results JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    -- Composite primary key including partition key
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for validation_sessions (current year and next year)
CREATE TABLE validation_sessions_2024 PARTITION OF validation_sessions
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE validation_sessions_2025 PARTITION OF validation_sessions
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE validation_sessions_2026 PARTITION OF validation_sessions
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Add unique constraint on uuid for each partition
ALTER TABLE validation_sessions_2024 ADD CONSTRAINT validation_sessions_2024_uuid_key UNIQUE (uuid);
ALTER TABLE validation_sessions_2025 ADD CONSTRAINT validation_sessions_2025_uuid_key UNIQUE (uuid);
ALTER TABLE validation_sessions_2026 ADD CONSTRAINT validation_sessions_2026_uuid_key UNIQUE (uuid);

-- Create trigger for validation_sessions updated_at
CREATE TRIGGER update_validation_sessions_updated_at BEFORE UPDATE ON validation_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for validation_sessions
CREATE INDEX idx_validation_sessions_provider_id ON validation_sessions(provider_id);
CREATE INDEX idx_validation_sessions_user_id ON validation_sessions(user_id);
CREATE INDEX idx_validation_sessions_uuid ON validation_sessions(uuid);
CREATE INDEX idx_validation_sessions_status ON validation_sessions(status);
CREATE INDEX idx_validation_sessions_locked ON validation_sessions(locked_at, locked_by);
CREATE INDEX idx_validation_sessions_created_at ON validation_sessions(created_at);
CREATE INDEX idx_validation_sessions_results ON validation_sessions USING gin(validation_results);
CREATE INDEX idx_validation_sessions_call_attempts ON validation_sessions USING gin(call_attempts);

-- Flagged phones table with enhanced tracking
CREATE TABLE flagged_phones (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    flag_type VARCHAR(50) DEFAULT 'invalid',
    flag_reason TEXT,
    flagged_count INTEGER DEFAULT 1,
    severity INTEGER DEFAULT 1 CHECK (severity >= 1 AND severity <= 5),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit fields
    flagged_by INTEGER NOT NULL REFERENCES users(id),
    resolved_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_phone_format CHECK (phone ~ '^\+?[\d\s\-\(\)\.]+$')
);

-- Create trigger for flagged_phones updated_at
CREATE TRIGGER update_flagged_phones_updated_at BEFORE UPDATE ON flagged_phones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for flagged_phones
CREATE INDEX idx_flagged_phones_phone ON flagged_phones(phone);
CREATE INDEX idx_flagged_phones_uuid ON flagged_phones(uuid);
CREATE INDEX idx_flagged_phones_active ON flagged_phones(is_active);
CREATE INDEX idx_flagged_phones_severity ON flagged_phones(severity);
CREATE INDEX idx_flagged_phones_metadata ON flagged_phones USING gin(metadata);

-- Create materialized view for validation statistics
CREATE MATERIALIZED VIEW validation_stats AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(vs.id) as total_validations,
    COUNT(CASE WHEN vs.status = 'completed' THEN 1 END) as completed_validations,
    COUNT(CASE WHEN vs.status = 'in_progress' THEN 1 END) as in_progress_validations,
    AVG(vs.quality_score) as avg_quality_score,
    AVG(EXTRACT(EPOCH FROM (vs.completed_at - vs.started_at))/60) as avg_completion_time_minutes,
    COUNT(DISTINCT vs.provider_id) as unique_providers_validated,
    MAX(vs.created_at) as last_validation_date
FROM users u
LEFT JOIN validation_sessions vs ON u.id = vs.user_id
GROUP BY u.id, u.email;

-- Create unique index for materialized view
CREATE UNIQUE INDEX idx_validation_stats_user_id ON validation_stats(user_id);

-- Create function to refresh validation stats
CREATE OR REPLACE FUNCTION refresh_validation_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY validation_stats;
END;
$$ LANGUAGE plpgsql;

-- Create function for automatic session locking
CREATE OR REPLACE FUNCTION auto_lock_validation_session()
RETURNS TRIGGER AS $$
BEGIN
    -- Automatically set locked_by when session is created or updated
    IF NEW.status = 'in_progress' AND NEW.locked_by IS NULL THEN
        NEW.locked_by = NEW.user_id;
        NEW.locked_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- Auto-complete validation if all required fields are validated
    IF NEW.status = 'in_progress' AND 
       EXISTS (
           SELECT 1 FROM provider_addresses pa 
           WHERE pa.provider_id = NEW.provider_id 
           AND pa.is_correct IS NOT NULL
       ) AND
       EXISTS (
           SELECT 1 FROM provider_phones pp 
           WHERE pp.provider_id = NEW.provider_id 
           AND pp.is_correct IS NOT NULL
       ) THEN
        NEW.status = 'completed';
        NEW.completed_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic session locking
CREATE TRIGGER auto_lock_validation_session_trigger
    BEFORE INSERT OR UPDATE ON validation_sessions
    FOR EACH ROW EXECUTE FUNCTION auto_lock_validation_session();

-- Create function for provider search
CREATE OR REPLACE FUNCTION search_providers(
    search_term TEXT,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id INTEGER,
    uuid UUID,
    npi VARCHAR,
    provider_name VARCHAR,
    specialty VARCHAR,
    provider_group VARCHAR,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.uuid,
        p.npi,
        p.provider_name,
        p.specialty,
        p.provider_group,
        ts_rank_cd(p.search_vector, plainto_tsquery('english', search_term)) as rank
    FROM providers p
    WHERE p.search_vector @@ plainto_tsquery('english', search_term)
       OR p.npi ILIKE '%' || search_term || '%'
       OR p.provider_name ILIKE '%' || search_term || '%'
    ORDER BY rank DESC, p.provider_name
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;