-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS validation_stats;

-- Drop functions
DROP FUNCTION IF EXISTS refresh_validation_stats();
DROP FUNCTION IF EXISTS search_providers(TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS auto_lock_validation_session();
DROP FUNCTION IF EXISTS update_provider_search_vector();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in reverse order (respecting foreign key dependencies)
DROP TABLE IF EXISTS flagged_phones;
DROP TABLE IF EXISTS validation_sessions_2024;
DROP TABLE IF EXISTS validation_sessions_2025;
DROP TABLE IF EXISTS validation_sessions_2026;
DROP TABLE IF EXISTS validation_sessions;
DROP TABLE IF EXISTS provider_phones;
DROP TABLE IF EXISTS provider_addresses;
DROP TABLE IF EXISTS providers;
DROP TABLE IF EXISTS users;

-- Drop custom types
DROP TYPE IF EXISTS call_attempt_status;
DROP TYPE IF EXISTS address_category;
DROP TYPE IF EXISTS validation_status;

-- Drop extensions (only if you're sure no other schemas use them)
-- DROP EXTENSION IF EXISTS "pg_trgm";
-- DROP EXTENSION IF EXISTS "uuid-ossp";