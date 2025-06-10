# Backend Architecture Summary

## Overview

The backend is a Go-based API server that provides healthcare provider validation functionality with user authentication and session management. It uses SQLite for data persistence and follows a clean architecture pattern with separate layers for handlers, services, and data models.

## Architecture Components

### Command Line Tools (`cmd/`)

| Tool | Purpose |
|------|---------|
| `api` | Main API server running on port 8080 |
| `loader` | CSV data importer for provider information |
| `loader_v2` | Enhanced version of the data loader |
| `migrate` | Database migration tool for schema updates |
| `check` | Database statistics and health checker |
| `reset` | Resets validation data to initial state |
| `clear_sessions` | Cleans up stale validation sessions |
| `list_users` | Lists all registered users |
| `debug` | Debug utilities |
| `test_api` | API endpoint testing |
| `test_db` | Database connection testing |
| `test_validation` | Validation logic testing |

### API Endpoints

#### Authentication Endpoints
- `POST /api/auth/register` - Register new user account
- `POST /api/auth/login` - Login and receive JWT token
- `GET /api/auth/me` - Get current authenticated user info

#### Provider Validation Endpoints (Protected)
- `GET /api/providers/next` - Get next unvalidated provider assigned to user
  - Returns `ProviderValidationData` with three data structures:
    - `address_phone_records`: Array of linked address-phone pairs (uses `link_id` for grouping)
    - `addresses`: Array of all distinct addresses
    - `phones`: Array of all distinct phones
  - Note: Frontend should use `address_phone_records` for proper address-phone relationships
- `GET /api/providers/stats` - Get validation statistics
- `PUT /api/sessions/{sessionId}/validate` - Submit validation updates
- `POST /api/sessions/{sessionId}/call-attempt` - Record phone call attempt
- `POST /api/sessions/{sessionId}/complete` - Mark validation session as complete

### Database Schema

#### Core Tables

1. **users**
   - `id` (INTEGER PRIMARY KEY)
   - `email` (TEXT UNIQUE)
   - `password` (TEXT) - Bcrypt hashed
   - `created_at` (DATETIME)
   - `updated_at` (DATETIME)

2. **providers**
   - `id` (INTEGER PRIMARY KEY)
   - `npi` (TEXT) - National Provider Identifier
   - `gnpi` (TEXT) - Group NPI
   - `name` (TEXT)
   - `specialty` (TEXT)
   - `group_name` (TEXT)

3. **provider_addresses**
   - `id` (INTEGER PRIMARY KEY)
   - `provider_id` (INTEGER FOREIGN KEY)
   - `address_type` (TEXT)
   - `address1`, `address2` (TEXT)
   - `city`, `state`, `zip` (TEXT)
   - `is_primary` (BOOLEAN)
   - `validation_status` (TEXT) - pending/validated
   - `is_correct` (BOOLEAN)
   - `corrected_address1`, `corrected_address2` (TEXT)
   - `corrected_city`, `corrected_state`, `corrected_zip` (TEXT)
   - `link_id` (TEXT) - Links related addresses/phones from same CSV row

4. **provider_phones**
   - `id` (INTEGER PRIMARY KEY)
   - `provider_id` (INTEGER FOREIGN KEY)
   - `phone_number` (TEXT)
   - `phone_type` (TEXT)
   - `is_primary` (BOOLEAN)
   - `validation_status` (TEXT) - pending/validated
   - `is_correct` (BOOLEAN)
   - `corrected_phone` (TEXT)
   - `link_id` (TEXT) - Links to related addresses from same CSV row

5. **validation_sessions**
   - `id` (TEXT PRIMARY KEY) - UUID
   - `user_id` (INTEGER FOREIGN KEY)
   - `provider_id` (INTEGER FOREIGN KEY)
   - `started_at` (DATETIME)
   - `completed_at` (DATETIME)
   - `status` (TEXT) - active/completed/abandoned

6. **flagged_phones**
   - `id` (INTEGER PRIMARY KEY)
   - `phone_number` (TEXT UNIQUE)
   - `reason` (TEXT)
   - `flagged_at` (DATETIME)

### Key Features

#### Provider Assignment Logic
- Automatically assigns unvalidated providers to users
- Uses round-robin distribution for fair workload
- Prevents duplicate assignments through session locking
- Prioritizes providers with pending validation status

#### Validation Workflow
1. User requests next provider (`/api/providers/next`)
2. System creates validation session and locks provider
3. User validates addresses and phones:
   - Mark as correct OR
   - Provide corrected information
4. User can record up to 2 call attempts (business days only)
5. User completes session, releasing the lock

#### Call Attempt Rules
- Maximum 2 attempts allowed
- Must be on different business days (Mon-Fri)
- Weekends and holidays not counted
- Enforced through backend validation

#### Authentication System
- JWT tokens with HS256 signing
- Token expiration: 24 hours
- Bcrypt password hashing (cost factor: 10)
- Middleware protection on provider endpoints
- Token passed via Authorization header: `Bearer <token>`

### Internal Package Structure

#### `internal/auth`
- JWT token generation and validation
- Password hashing and verification
- Authentication middleware

#### `internal/database`
- Database connection management
- Migration support
- Connection pooling

#### `internal/handlers`
- HTTP request handlers
- Request/response models
- Error handling
- CORS configuration

#### `internal/models`
- Domain models (Provider, User, etc.)
- Null-safe types for optional fields
- Validation logic

#### `internal/providers`
- Provider service layer
- Business logic for validation
- Session management
- Statistics calculation

### Data Import Process

#### CSV Structure
The source CSV contains provider data with multiple rows per provider:
- Each row represents one address-phone combination
- Same provider (NPI) can have multiple addresses and phones
- Columns: npi, gnpi, group_name, primary_spec_desc, firstname, lastname, address_category, address1, address2, city, state, zipcode, phone, address_status, phone_status

#### Loader v1 vs v2
**Loader v1** (`cmd/loader`):
- Does NOT set `link_id`
- Treats addresses and phones as independent entities
- Avoids duplicate phone insertions

**Loader v2** (`cmd/loader_v2`):
- Sets `link_id` using format `{provider_id}-{idx}-{rowCount}`
- Maintains address-phone relationships from CSV
- Allows duplicate phones with different `link_id`s
- Skips phone insert if address insert fails

### Statistics Tracking

The system tracks:
- Total providers pending validation
- Providers validated today
- Active validation sessions
- Average session duration
- User productivity metrics

### Error Handling

- Consistent JSON error responses
- HTTP status codes follow REST conventions
- Detailed error messages for debugging
- Transaction rollback on failures

### Security Considerations

- SQL injection prevention through parameterized queries
- Password complexity requirements
- Session timeout management
- CORS configured for frontend domain
- No sensitive data in logs

### Performance Optimizations

- Database indexes on frequently queried fields
- Efficient pagination for large datasets
- Connection pooling for concurrent requests
- Minimal N+1 query problems
- Transaction batching for bulk updates