package providers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/user/auth-app/internal/database"
	"github.com/user/auth-app/internal/models"
)

var (
	ErrNoProvidersAvailable = errors.New("no providers available for validation")
	ErrSessionLocked        = errors.New("session is locked by another user")
	ErrInvalidCallAttempt   = errors.New("invalid call attempt")
)

// GetNextProvider gets the next provider for validation using PostgreSQL-optimized queries
func GetNextProvider(userID int) (*models.ProviderValidationData, error) {
	ctx := context.Background()
	log.Printf("GetNextProvider called for userID: %d", userID)

	var result *models.ProviderValidationData
	err := database.WithTx(ctx, func(tx pgx.Tx) error {
		// Check if user has an active session first
		var session models.ValidationSession
		err := tx.QueryRow(ctx, `
			SELECT id, uuid, provider_id, user_id, status, priority,
			       call_attempts, call_attempt_1, call_attempt_2,
			       started_at, completed_at, locked_at, locked_by,
			       validation_results, notes, quality_score,
			       created_at, updated_at, created_by, updated_by
			FROM validation_sessions
			WHERE user_id = $1 AND status = 'in_progress'
			ORDER BY created_at DESC
			LIMIT 1
		`, userID).Scan(
			&session.ID, &session.UUID, &session.ProviderID, &session.UserID,
			&session.Status, &session.Priority, &session.CallAttempts,
			&session.CallAttempt1, &session.CallAttempt2,
			&session.StartedAt, &session.CompletedAt, &session.LockedAt, &session.LockedBy,
			&session.ValidationResults, &session.Notes, &session.QualityScore,
			&session.CreatedAt, &session.UpdatedAt, &session.CreatedBy, &session.UpdatedBy,
		)

		var provider models.Provider
		if err == pgx.ErrNoRows {
			// No active session, find a new provider using PostgreSQL SKIP LOCKED
			err = tx.QueryRow(ctx, `
				WITH available_providers AS (
					SELECT DISTINCT p.id, p.uuid, p.npi, p.gnpi, p.provider_name, 
					       p.specialty, p.provider_group, p.license_numbers,
					       p.credentials, p.metadata, p.is_active,
					       p.created_at, p.updated_at, p.created_by, p.updated_by
					FROM providers p
					JOIN provider_addresses pa ON p.id = pa.provider_id
					JOIN provider_phones pp ON p.id = pp.provider_id
					LEFT JOIN validation_sessions vs ON p.id = vs.provider_id 
						AND vs.status = 'in_progress'
					WHERE p.is_active = true
					  AND vs.id IS NULL
					  AND (pa.is_correct IS NULL OR pp.is_correct IS NULL)
				)
				SELECT id, uuid, npi, gnpi, provider_name, specialty, provider_group,
				       license_numbers, credentials, metadata, is_active,
				       created_at, updated_at, created_by, updated_by
				FROM available_providers
				ORDER BY RANDOM()
				LIMIT 1
				FOR UPDATE SKIP LOCKED
			`).Scan(
				&provider.ID, &provider.UUID, &provider.NPI, &provider.GNPI,
				&provider.ProviderName, &provider.Specialty, &provider.ProviderGroup,
				&provider.LicenseNumbers, &provider.Credentials, &provider.Metadata,
				&provider.IsActive, &provider.CreatedAt, &provider.UpdatedAt,
				&provider.CreatedBy, &provider.UpdatedBy,
			)

			if err != nil {
				if err == pgx.ErrNoRows {
					return ErrNoProvidersAvailable
				}
				return err
			}

			// Create a new validation session with PostgreSQL-specific features
			err = tx.QueryRow(ctx, `
				INSERT INTO validation_sessions 
				(uuid, provider_id, user_id, status, priority, call_attempts, 
				 started_at, locked_at, locked_by, validation_results, created_by)
				VALUES ($1, $2, $3, 'in_progress', 5, '[]'::jsonb, 
				        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3, '{}'::jsonb, $3)
				RETURNING id, uuid, started_at, locked_at, created_at
			`, uuid.New(), provider.ID, userID).Scan(
				&session.ID, &session.UUID, &session.StartedAt, 
				&session.LockedAt, &session.CreatedAt,
			)
			if err != nil {
				return err
			}

			// Fill in other session fields
			session.ProviderID = provider.ID
			session.UserID = userID
			session.Status = "in_progress"
			session.Priority = 5
			session.LockedBy = models.NullInt64{NullInt64: sql.NullInt64{Int64: int64(userID), Valid: true}}
			session.CallAttempts = []models.CallAttemptRecord{}
			session.ValidationResults = make(map[string]interface{})
			session.CreatedBy = models.NullInt64{NullInt64: sql.NullInt64{Int64: int64(userID), Valid: true}}
			session.UpdatedAt = session.CreatedAt
		} else if err != nil {
			return err
		} else {
			// Load the provider from the existing session
			err = tx.QueryRow(ctx, `
				SELECT id, uuid, npi, gnpi, provider_name, specialty, provider_group,
				       license_numbers, credentials, metadata, is_active,
				       created_at, updated_at, created_by, updated_by
				FROM providers
				WHERE id = $1
			`, session.ProviderID).Scan(
				&provider.ID, &provider.UUID, &provider.NPI, &provider.GNPI,
				&provider.ProviderName, &provider.Specialty, &provider.ProviderGroup,
				&provider.LicenseNumbers, &provider.Credentials, &provider.Metadata,
				&provider.IsActive, &provider.CreatedAt, &provider.UpdatedAt,
				&provider.CreatedBy, &provider.UpdatedBy,
			)
			if err != nil {
				return err
			}
		}

		// Get all addresses and phones with enhanced PostgreSQL features
		addresses, err := getProviderAddresses(ctx, tx, provider.ID)
		if err != nil {
			return err
		}

		phones, err := getProviderPhones(ctx, tx, provider.ID)
		if err != nil {
			return err
		}

		// Create address-phone records for backward compatibility
		addressPhoneRecords := createAddressPhoneRecords(addresses, phones)

		result = &models.ProviderValidationData{
			Provider:            provider,
			AddressPhoneRecords: addressPhoneRecords,
			Addresses:           addresses,
			Phones:              phones,
			ValidationSession:   &session,
		}

		return nil
	})
	
	if err != nil {
		return nil, err
	}
	
	return result, nil
}

// getProviderAddresses retrieves all addresses for a provider
func getProviderAddresses(ctx context.Context, tx pgx.Tx, providerID int) ([]models.ProviderAddress, error) {
	rows, err := tx.Query(ctx, `
		SELECT id, uuid, provider_id, address_category, address1, address2,
		       city, state, zip, country, is_correct, corrected_address1,
		       corrected_address2, corrected_city, corrected_state, corrected_zip,
		       validation_notes, validation_metadata, confidence_score,
		       validated_by, validated_at, created_at, updated_at,
		       created_by, updated_by, link_id
		FROM provider_addresses
		WHERE provider_id = $1
		ORDER BY address_category, created_at
	`, providerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var addresses []models.ProviderAddress
	for rows.Next() {
		var addr models.ProviderAddress
		err := rows.Scan(
			&addr.ID, &addr.UUID, &addr.ProviderID, &addr.AddressCategory,
			&addr.Address1, &addr.Address2, &addr.City, &addr.State, &addr.Zip,
			&addr.Country, &addr.IsCorrect, &addr.CorrectedAddress1,
			&addr.CorrectedAddress2, &addr.CorrectedCity, &addr.CorrectedState,
			&addr.CorrectedZip, &addr.ValidationNotes, &addr.ValidationMetadata,
			&addr.ConfidenceScore, &addr.ValidatedBy, &addr.ValidatedAt,
			&addr.CreatedAt, &addr.UpdatedAt, &addr.CreatedBy, &addr.UpdatedBy,
			&addr.LinkID,
		)
		if err != nil {
			return nil, err
		}
		addresses = append(addresses, addr)
	}

	return addresses, rows.Err()
}

// getProviderPhones retrieves all phones for a provider
func getProviderPhones(ctx context.Context, tx pgx.Tx, providerID int) ([]models.ProviderPhone, error) {
	rows, err := tx.Query(ctx, `
		SELECT id, uuid, provider_id, phone, phone_type, extension,
		       is_correct, corrected_phone, validation_notes, validation_metadata,
		       call_attempts, is_flagged, flag_reason, confidence_score,
		       validated_by, validated_at, created_at, updated_at,
		       created_by, updated_by, link_id
		FROM provider_phones
		WHERE provider_id = $1
		ORDER BY created_at
	`, providerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var phones []models.ProviderPhone
	for rows.Next() {
		var phone models.ProviderPhone
		var callAttemptsJSON []byte
		
		err := rows.Scan(
			&phone.ID, &phone.UUID, &phone.ProviderID, &phone.Phone,
			&phone.PhoneType, &phone.Extension, &phone.IsCorrect, &phone.CorrectedPhone,
			&phone.ValidationNotes, &phone.ValidationMetadata, &callAttemptsJSON,
			&phone.IsFlagged, &phone.FlagReason, &phone.ConfidenceScore,
			&phone.ValidatedBy, &phone.ValidatedAt, &phone.CreatedAt, &phone.UpdatedAt,
			&phone.CreatedBy, &phone.UpdatedBy, &phone.LinkID,
		)
		if err != nil {
			return nil, err
		}

		// Parse call attempts JSON
		if len(callAttemptsJSON) > 0 {
			err = json.Unmarshal(callAttemptsJSON, &phone.CallAttempts)
			if err != nil {
				log.Printf("Error parsing call attempts for phone %d: %v", phone.ID, err)
				phone.CallAttempts = []models.CallAttemptRecord{}
			}
		}

		phones = append(phones, phone)
	}

	return phones, rows.Err()
}

// createAddressPhoneRecords creates legacy address-phone records for backward compatibility
func createAddressPhoneRecords(addresses []models.ProviderAddress, phones []models.ProviderPhone) []models.AddressPhoneRecord {
	var records []models.AddressPhoneRecord
	
	// Create a map of link_id to phones for efficient lookup
	phonesByLink := make(map[string]models.ProviderPhone)
	for _, phone := range phones {
		if phone.LinkID.Valid {
			phonesByLink[phone.LinkID.String] = phone
		}
	}

	for _, addr := range addresses {
		record := models.AddressPhoneRecord{
			Address: addr,
		}

		// Try to find a matching phone by link_id
		if addr.LinkID.Valid {
			if phone, exists := phonesByLink[addr.LinkID.String]; exists {
				record.Phone = phone
			}
		}

		// If no phone found, use empty phone for the record
		if record.Phone.ID == 0 && len(phones) > 0 {
			record.Phone = phones[0] // Use first phone as fallback
		}

		record.ID = fmt.Sprintf("%d-%d", addr.ID, record.Phone.ID)
		records = append(records, record)
	}

	return records
}

// UpdateValidation updates validation data using PostgreSQL transactions and JSONB
func UpdateValidation(sessionID int, userID int, update models.ValidationUpdate) error {
	ctx := context.Background()

	return database.WithTx(ctx, func(tx pgx.Tx) error {
		// Verify session ownership with row-level locking
		var sessionUserID int
		var providerID int
		err := tx.QueryRow(ctx, `
			SELECT user_id, provider_id FROM validation_sessions 
			WHERE id = $1 AND status = 'in_progress'
			FOR UPDATE
		`, sessionID).Scan(&sessionUserID, &providerID)
		if err != nil {
			if err == pgx.ErrNoRows {
				return errors.New("session not found or already completed")
			}
			return err
		}
		if sessionUserID != userID {
			return ErrSessionLocked
		}

		// Update addresses with enhanced audit trail
		for _, addrVal := range update.AddressValidations {
			validationMetadata := map[string]interface{}{
				"validated_at": time.Now(),
				"validation_type": "manual",
				"user_id": userID,
			}

			if addrVal.IsCorrect {
				_, err = tx.Exec(ctx, `
					UPDATE provider_addresses 
					SET is_correct = $1, 
					    validation_metadata = validation_metadata || $2::jsonb,
					    validated_by = $3, 
					    validated_at = CURRENT_TIMESTAMP,
					    updated_by = $3,
					    updated_at = CURRENT_TIMESTAMP
					WHERE id = $4
				`, true, validationMetadata, userID, addrVal.AddressID)
			} else {
				validationMetadata["corrections_made"] = true
				_, err = tx.Exec(ctx, `
					UPDATE provider_addresses 
					SET is_correct = $1,
					    corrected_address1 = $2, corrected_address2 = $3,
					    corrected_city = $4, corrected_state = $5, corrected_zip = $6,
					    validation_metadata = validation_metadata || $7::jsonb,
					    validated_by = $8, validated_at = CURRENT_TIMESTAMP,
					    updated_by = $8, updated_at = CURRENT_TIMESTAMP
					WHERE id = $9
				`, false, 
					nullStringValue(addrVal.CorrectedAddress1),
					nullStringValue(addrVal.CorrectedAddress2),
					nullStringValue(addrVal.CorrectedCity),
					nullStringValue(addrVal.CorrectedState),
					nullStringValue(addrVal.CorrectedZip),
					validationMetadata, userID, addrVal.AddressID)
			}
			if err != nil {
				return err
			}
		}

		// Update phones with enhanced tracking
		for _, phoneVal := range update.PhoneValidations {
			validationMetadata := map[string]interface{}{
				"validated_at": time.Now(),
				"validation_type": "manual",
				"user_id": userID,
			}

			if phoneVal.IsCorrect {
				_, err = tx.Exec(ctx, `
					UPDATE provider_phones 
					SET is_correct = $1,
					    validation_metadata = validation_metadata || $2::jsonb,
					    validated_by = $3, validated_at = CURRENT_TIMESTAMP,
					    updated_by = $3, updated_at = CURRENT_TIMESTAMP
					WHERE id = $4
				`, true, validationMetadata, userID, phoneVal.PhoneID)
			} else {
				validationMetadata["corrections_made"] = true
				_, err = tx.Exec(ctx, `
					UPDATE provider_phones 
					SET is_correct = $1, corrected_phone = $2,
					    validation_metadata = validation_metadata || $3::jsonb,
					    validated_by = $4, validated_at = CURRENT_TIMESTAMP,
					    updated_by = $4, updated_at = CURRENT_TIMESTAMP
					WHERE id = $5
				`, false, nullStringValue(phoneVal.CorrectedPhone),
					validationMetadata, userID, phoneVal.PhoneID)
			}
			if err != nil {
				return err
			}
		}

		// Add new addresses with UUID and audit trail
		for _, newAddr := range update.NewAddresses {
			_, err = tx.Exec(ctx, `
				INSERT INTO provider_addresses 
				(uuid, provider_id, address_category, address1, address2, city, state, zip,
				 is_correct, validated_by, validated_at, created_by, updated_by)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, CURRENT_TIMESTAMP, $9, $9)
			`, uuid.New(), providerID, newAddr.AddressCategory, newAddr.Address1,
				nullStringValue(newAddr.Address2), newAddr.City, newAddr.State, 
				newAddr.Zip, userID)
			if err != nil {
				return err
			}
		}

		// Update session with validation progress
		_, err = tx.Exec(ctx, `
			UPDATE validation_sessions 
			SET validation_results = validation_results || $1::jsonb,
			    updated_by = $2, updated_at = CURRENT_TIMESTAMP
			WHERE id = $3
		`, map[string]interface{}{
			"last_update": time.Now(),
			"addresses_updated": len(update.AddressValidations),
			"phones_updated": len(update.PhoneValidations),
			"new_addresses_added": len(update.NewAddresses),
		}, userID, sessionID)

		return err
	})
}

// RecordCallAttempt records a call attempt with enhanced tracking
func RecordCallAttempt(sessionID int, userID int, attemptNumber int) error {
	if attemptNumber != 1 && attemptNumber != 2 {
		return ErrInvalidCallAttempt
	}

	ctx := context.Background()

	return database.WithTx(ctx, func(tx pgx.Tx) error {
		// Get current session data with locking
		var sessionUserID int
		var callAttemptsJSON []byte
		var attempt1 models.NullTime
		
		err := tx.QueryRow(ctx, `
			SELECT user_id, call_attempts, call_attempt_1 
			FROM validation_sessions 
			WHERE id = $1 AND status = 'in_progress'
			FOR UPDATE
		`, sessionID).Scan(&sessionUserID, &callAttemptsJSON, &attempt1)
		if err != nil {
			return err
		}
		if sessionUserID != userID {
			return ErrSessionLocked
		}

		// Parse existing call attempts
		var callAttempts []models.CallAttemptRecord
		if len(callAttemptsJSON) > 0 {
			err = json.Unmarshal(callAttemptsJSON, &callAttempts)
			if err != nil {
				callAttempts = []models.CallAttemptRecord{}
			}
		}

		// Business day validation for attempt 2
		if attemptNumber == 2 && attempt1.Valid {
			if !isNextBusinessDay(attempt1.Time, time.Now()) {
				return errors.New("call attempt 2 must be at least 1 business day after attempt 1")
			}
		}

		// Create new call attempt record
		newAttempt := models.CallAttemptRecord{
			AttemptNumber: attemptNumber,
			AttemptedAt:   time.Now(),
			Status:        "attempted", // Default status
			Notes:         fmt.Sprintf("Call attempt %d recorded", attemptNumber),
		}
		
		// Add to attempts array (replace if same attempt number exists)
		found := false
		for i, attempt := range callAttempts {
			if attempt.AttemptNumber == attemptNumber {
				callAttempts[i] = newAttempt
				found = true
				break
			}
		}
		if !found {
			callAttempts = append(callAttempts, newAttempt)
		}

		// Update both the JSONB array and legacy timestamp fields
		callAttemptsUpdated, _ := json.Marshal(callAttempts)
		
		if attemptNumber == 1 {
			_, err = tx.Exec(ctx, `
				UPDATE validation_sessions 
				SET call_attempts = $1::jsonb,
				    call_attempt_1 = CURRENT_TIMESTAMP,
				    updated_by = $2, updated_at = CURRENT_TIMESTAMP
				WHERE id = $3
			`, callAttemptsUpdated, userID, sessionID)
		} else {
			_, err = tx.Exec(ctx, `
				UPDATE validation_sessions 
				SET call_attempts = $1::jsonb,
				    call_attempt_2 = CURRENT_TIMESTAMP,
				    updated_by = $2, updated_at = CURRENT_TIMESTAMP
				WHERE id = $3
			`, callAttemptsUpdated, userID, sessionID)
		}

		return err
	})
}

// CompleteValidation completes a validation session with quality scoring
func CompleteValidation(sessionID int, userID int) error {
	ctx := context.Background()

	return database.WithTx(ctx, func(tx pgx.Tx) error {
		// Verify session and get validation stats
		var sessionUserID, providerID int
		var startedAt time.Time
		
		err := tx.QueryRow(ctx, `
			SELECT user_id, provider_id, started_at 
			FROM validation_sessions 
			WHERE id = $1 AND status = 'in_progress'
			FOR UPDATE
		`, sessionID).Scan(&sessionUserID, &providerID, &startedAt)
		if err != nil {
			return err
		}
		if sessionUserID != userID {
			return ErrSessionLocked
		}

		// Check validation completeness using PostgreSQL aggregates
		var stats struct {
			TotalAddresses int
			ValidatedAddresses int
			TotalPhones int
			ValidatedPhones int
		}
		
		err = tx.QueryRow(ctx, `
			SELECT 
				(SELECT COUNT(*) FROM provider_addresses WHERE provider_id = $1) as total_addresses,
				(SELECT COUNT(*) FROM provider_addresses WHERE provider_id = $1 AND is_correct IS NOT NULL) as validated_addresses,
				(SELECT COUNT(*) FROM provider_phones WHERE provider_id = $1) as total_phones,
				(SELECT COUNT(*) FROM provider_phones WHERE provider_id = $1 AND is_correct IS NOT NULL) as validated_phones
		`, providerID).Scan(&stats.TotalAddresses, &stats.ValidatedAddresses, &stats.TotalPhones, &stats.ValidatedPhones)
		if err != nil {
			return err
		}

		unvalidatedCount := (stats.TotalAddresses - stats.ValidatedAddresses) + (stats.TotalPhones - stats.ValidatedPhones)
		if unvalidatedCount > 0 {
			return errors.New("all addresses and phones must be validated before completing")
		}

		// Calculate quality score
		completionTime := time.Since(startedAt)
		qualityScore := calculateQualityScore(stats.TotalAddresses + stats.TotalPhones, completionTime)

		// Complete the session with enhanced results
		completionResults := map[string]interface{}{
			"completion_time_minutes": completionTime.Minutes(),
			"total_items_validated": stats.ValidatedAddresses + stats.ValidatedPhones,
			"addresses_validated": stats.ValidatedAddresses,
			"phones_validated": stats.ValidatedPhones,
			"completed_by": userID,
			"completion_timestamp": time.Now(),
		}

		_, err = tx.Exec(ctx, `
			UPDATE validation_sessions 
			SET status = 'completed', 
			    completed_at = CURRENT_TIMESTAMP,
			    quality_score = $1,
			    validation_results = validation_results || $2::jsonb,
			    updated_by = $3, updated_at = CURRENT_TIMESTAMP
			WHERE id = $4
		`, qualityScore, completionResults, userID, sessionID)

		// Refresh materialized view for stats
		if err == nil {
			_, err = tx.Exec(ctx, "SELECT refresh_validation_stats()")
		}

		return err
	})
}

// calculateQualityScore calculates a quality score based on completion metrics
func calculateQualityScore(itemsValidated int, completionTime time.Duration) float64 {
	if itemsValidated == 0 {
		return 0.0
	}
	
	// Base score
	score := 1.0
	
	// Adjust based on time efficiency (target: 2 minutes per item)
	targetMinutes := float64(itemsValidated) * 2.0
	actualMinutes := completionTime.Minutes()
	
	if actualMinutes <= targetMinutes {
		// Bonus for being fast
		score = 1.0 + (targetMinutes - actualMinutes) / targetMinutes * 0.2
	} else {
		// Penalty for being slow
		score = targetMinutes / actualMinutes
	}
	
	// Ensure score is between 0 and 1
	if score > 1.0 {
		score = 1.0
	}
	if score < 0.0 {
		score = 0.0
	}
	
	return score
}

// Helper function for null string values
func nullStringValue(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// SearchProviders performs full-text search using PostgreSQL
func SearchProviders(searchTerm string, limit, offset int) ([]models.ProviderSearchResult, error) {
	ctx := context.Background()
	
	rows, err := database.Query(ctx, `
		SELECT id, uuid, npi, provider_name, 
		       COALESCE(specialty, '') as specialty, 
		       COALESCE(provider_group, '') as provider_group,
		       ts_rank_cd(search_vector, plainto_tsquery('english', $1)) as rank
		FROM providers
		WHERE search_vector @@ plainto_tsquery('english', $1)
		   OR npi ILIKE '%' || $1 || '%'
		   OR provider_name ILIKE '%' || $1 || '%'
		   AND is_active = true
		ORDER BY rank DESC, provider_name
		LIMIT $2 OFFSET $3
	`, searchTerm, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.ProviderSearchResult
	for rows.Next() {
		var result models.ProviderSearchResult
		err := rows.Scan(
			&result.ID, &result.UUID, &result.NPI,
			&result.ProviderName, &result.Specialty, &result.ProviderGroup,
			&result.Rank,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, result)
	}

	return results, rows.Err()
}

// GetValidationStats gets enhanced validation statistics
func GetValidationStats(userID int) (*models.ValidationStats, error) {
	ctx := context.Background()
	
	var stats models.ValidationStats
	err := database.QueryRow(ctx, `
		SELECT user_id, email, total_validations, completed_validations,
		       in_progress_validations, avg_quality_score, 
		       avg_completion_time_minutes, unique_providers_validated,
		       last_validation_date
		FROM validation_stats
		WHERE user_id = $1
	`, userID).Scan(
		&stats.UserID, &stats.Email, &stats.TotalValidations,
		&stats.CompletedValidations, &stats.InProgressValidations,
		&stats.AvgQualityScore, &stats.AvgCompletionTimeMinutes,
		&stats.UniqueProvidersValidated, &stats.LastValidationDate,
	)
	
	if err != nil {
		if err == pgx.ErrNoRows {
			// Return empty stats for new user
			stats.UserID = userID
			return &stats, nil
		}
		return nil, err
	}

	return &stats, nil
}

// Business day calculation (same as before)
func isNextBusinessDay(t1, t2 time.Time) bool {
	days := 0
	current := t1.AddDate(0, 0, 1)
	
	for current.Before(t2) || current.Equal(t2) {
		if current.Weekday() != time.Saturday && current.Weekday() != time.Sunday {
			days++
		}
		if days >= 1 {
			return true
		}
		current = current.AddDate(0, 0, 1)
	}
	
	return false
}

// GetValidationPreview gets preview of validation session status
func GetValidationPreview(sessionID int, userID int) (*ValidationPreview, error) {
	ctx := context.Background()
	
	var result *ValidationPreview
	err := database.WithTx(ctx, func(tx pgx.Tx) error {
		// Verify session ownership
		var sessionUserID, providerID int
		err := tx.QueryRow(ctx, `
			SELECT user_id, provider_id FROM validation_sessions 
			WHERE id = $1 AND status = 'in_progress'
		`, sessionID).Scan(&sessionUserID, &providerID)
		if err != nil {
			if err == pgx.ErrNoRows {
				return errors.New("session not found or already completed")
			}
			return err
		}
		if sessionUserID != userID {
			return ErrSessionLocked
		}

		preview := &ValidationPreview{
			UnvalidatedAddresses: []models.ProviderAddress{},
			UnvalidatedPhones:    []models.ProviderPhone{},
		}

		// Get unvalidated addresses
		addressRows, err := tx.Query(ctx, `
			SELECT id, uuid, provider_id, address_category, address1, address2,
			       city, state, zip, country, created_at, updated_at
			FROM provider_addresses 
			WHERE provider_id = $1 AND is_correct IS NULL
		`, providerID)
		if err != nil {
			return err
		}
		defer addressRows.Close()

		for addressRows.Next() {
			var addr models.ProviderAddress
			err = addressRows.Scan(
				&addr.ID, &addr.UUID, &addr.ProviderID, &addr.AddressCategory,
				&addr.Address1, &addr.Address2, &addr.City, &addr.State, &addr.Zip,
				&addr.Country, &addr.CreatedAt, &addr.UpdatedAt,
			)
			if err != nil {
				return err
			}
			preview.UnvalidatedAddresses = append(preview.UnvalidatedAddresses, addr)
		}

		// Get unvalidated phones
		phoneRows, err := tx.Query(ctx, `
			SELECT id, uuid, provider_id, phone, phone_type, extension,
			       created_at, updated_at
			FROM provider_phones 
			WHERE provider_id = $1 AND is_correct IS NULL
		`, providerID)
		if err != nil {
			return err
		}
		defer phoneRows.Close()

		for phoneRows.Next() {
			var phone models.ProviderPhone
			err = phoneRows.Scan(
				&phone.ID, &phone.UUID, &phone.ProviderID, &phone.Phone,
				&phone.PhoneType, &phone.Extension, &phone.CreatedAt, &phone.UpdatedAt,
			)
			if err != nil {
				return err
			}
			preview.UnvalidatedPhones = append(preview.UnvalidatedPhones, phone)
		}

		// Get total counts
		var totalAddresses, totalPhones, validatedAddresses, validatedPhones int
		
		err = tx.QueryRow(ctx, `SELECT COUNT(*) FROM provider_addresses WHERE provider_id = $1`, providerID).Scan(&totalAddresses)
		if err != nil {
			return err
		}
		
		err = tx.QueryRow(ctx, `SELECT COUNT(*) FROM provider_phones WHERE provider_id = $1`, providerID).Scan(&totalPhones)
		if err != nil {
			return err
		}
		
		err = tx.QueryRow(ctx, `SELECT COUNT(*) FROM provider_addresses WHERE provider_id = $1 AND is_correct IS NOT NULL`, providerID).Scan(&validatedAddresses)
		if err != nil {
			return err
		}
		
		err = tx.QueryRow(ctx, `SELECT COUNT(*) FROM provider_phones WHERE provider_id = $1 AND is_correct IS NOT NULL`, providerID).Scan(&validatedPhones)
		if err != nil {
			return err
		}

		preview.TotalRequired = totalAddresses + totalPhones
		preview.TotalValidated = validatedAddresses + validatedPhones
		preview.CanComplete = len(preview.UnvalidatedAddresses) == 0 && len(preview.UnvalidatedPhones) == 0

		// Generate helpful message
		if preview.CanComplete {
			preview.Message = "All validations complete. You can now complete the validation."
		} else {
			unvalidatedCount := len(preview.UnvalidatedAddresses) + len(preview.UnvalidatedPhones)
			preview.Message = fmt.Sprintf("Please validate %d remaining items (%d addresses, %d phones) before completing.", 
				unvalidatedCount, len(preview.UnvalidatedAddresses), len(preview.UnvalidatedPhones))
		}

		result = preview
		return nil
	})
	
	if err != nil {
		return nil, err
	}
	
	return result, nil
}

// ValidationPreview holds preview information for validation session
type ValidationPreview struct {
	CanComplete          bool                    `json:"can_complete"`
	UnvalidatedAddresses []models.ProviderAddress `json:"unvalidated_addresses"`
	UnvalidatedPhones    []models.ProviderPhone   `json:"unvalidated_phones"`
	TotalRequired        int                     `json:"total_required"`
	TotalValidated       int                     `json:"total_validated"`
	Message              string                  `json:"message"`
}

// GetStats gets basic provider validation statistics
func GetStats(userID int) (map[string]interface{}, error) {
	ctx := context.Background()
	stats := make(map[string]interface{})

	// Total providers needing validation
	var totalPending int
	err := database.QueryRow(ctx, `
		SELECT COUNT(DISTINCT p.id)
		FROM providers p
		JOIN provider_addresses pa ON p.id = pa.provider_id
		JOIN provider_phones pp ON p.id = pp.provider_id
		LEFT JOIN validation_sessions vs ON p.id = vs.provider_id AND vs.status = 'in_progress'
		WHERE p.is_active = true
		  AND vs.id IS NULL
		  AND (pa.is_correct IS NULL OR pp.is_correct IS NULL)
	`).Scan(&totalPending)
	if err != nil {
		return nil, err
	}
	stats["total_pending"] = totalPending

	// User's completed today
	var completedToday int
	err = database.QueryRow(ctx, `
		SELECT COUNT(*) FROM validation_sessions 
		WHERE user_id = $1 AND DATE(completed_at) = CURRENT_DATE AND status = 'completed'
	`, userID).Scan(&completedToday)
	if err != nil {
		return nil, err
	}
	stats["completed_today"] = completedToday

	// Currently in progress
	var inProgress int
	err = database.QueryRow(ctx, `
		SELECT COUNT(*) FROM validation_sessions 
		WHERE user_id = $1 AND status = 'in_progress'
	`, userID).Scan(&inProgress)
	if err != nil {
		return nil, err
	}
	stats["in_progress"] = inProgress

	return stats, nil
}