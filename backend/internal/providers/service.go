package providers

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/user/auth-app/internal/database"
	"github.com/user/auth-app/internal/models"
)

var (
	ErrNoProvidersAvailable = errors.New("no providers available for validation")
	ErrSessionLocked        = errors.New("session is locked by another user")
	ErrInvalidCallAttempt   = errors.New("invalid call attempt")
)

func GetNextProvider(userID int) (*models.ProviderValidationData, error) {
	log.Printf("GetNextProvider called for userID: %d", userID)
	
	tx, err := database.DB.Begin()
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		return nil, err
	}
	defer tx.Rollback()

	// First check if user has an active session
	var session models.ValidationSession
	err = tx.QueryRow(`
		SELECT id, provider_id, user_id, call_attempt_1, call_attempt_2, closed_date, status, locked_at, created_at
		FROM validation_sessions
		WHERE user_id = ? AND status = 'in_progress'
		ORDER BY created_at DESC
		LIMIT 1
	`, userID).Scan(
		&session.ID, &session.ProviderID, &session.UserID,
		&session.CallAttempt1.NullTime, &session.CallAttempt2.NullTime, &session.ClosedDate.NullTime,
		&session.Status, &session.LockedAt, &session.CreatedAt,
	)

	var provider models.Provider
	if err == sql.ErrNoRows {
		// No active session, find a new provider
		// Get providers that need validation (have addresses/phones without is_correct set)
		err = tx.QueryRow(`
			SELECT DISTINCT p.id, p.npi, p.gnpi, p.provider_name, p.specialty, p.provider_group, p.created_at
			FROM providers p
			LEFT JOIN provider_addresses pa ON p.id = pa.provider_id
			LEFT JOIN provider_phones pp ON p.id = pp.provider_id
			LEFT JOIN validation_sessions vs ON p.id = vs.provider_id AND vs.status = 'in_progress'
			WHERE vs.id IS NULL
			  AND (pa.is_correct IS NULL OR pp.is_correct IS NULL)
			ORDER BY RANDOM()
			LIMIT 1
		`).Scan(
			&provider.ID, &provider.NPI, &provider.GNPI,
			&provider.ProviderName, &provider.Specialty, &provider.ProviderGroup,
			&provider.CreatedAt,
		)

		if err != nil {
			if err == sql.ErrNoRows {
				return nil, ErrNoProvidersAvailable
			}
			return nil, err
		}

		// Create a new session
		result, err := tx.Exec(`
			INSERT INTO validation_sessions (provider_id, user_id, status)
			VALUES (?, ?, 'in_progress')
		`, provider.ID, userID)
		if err != nil {
			return nil, err
		}

		sessionID, _ := result.LastInsertId()
		session.ID = int(sessionID)
		session.ProviderID = provider.ID
		session.UserID = userID
		session.Status = "in_progress"
		session.LockedAt = time.Now()
		session.CreatedAt = time.Now()
	} else if err != nil {
		return nil, err
	} else {
		// Load the provider from the existing session
		err = tx.QueryRow(`
			SELECT id, npi, gnpi, provider_name, specialty, provider_group, created_at
			FROM providers
			WHERE id = ?
		`, session.ProviderID).Scan(
			&provider.ID, &provider.NPI, &provider.GNPI,
			&provider.ProviderName, &provider.Specialty, &provider.ProviderGroup,
			&provider.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
	}

	// Get address-phone records that are properly linked
	// This query will only return addresses that have a corresponding phone with the same link_id
	recordQuery := `
		SELECT 
			pa.id, pa.provider_id, pa.address_category, pa.address1, pa.address2, 
			pa.city, pa.state, pa.zip, pa.is_correct,
			pa.corrected_address1, pa.corrected_address2, pa.corrected_city,
			pa.corrected_state, pa.corrected_zip, pa.validated_by, pa.validated_at, pa.created_at,
			COALESCE(pp.id, 0), COALESCE(pp.provider_id, 0), COALESCE(pp.phone, ''), 
			pp.is_correct, pp.corrected_phone,
			pp.validated_by, pp.validated_at, pp.created_at
		FROM provider_addresses pa
		LEFT JOIN provider_phones pp ON pa.link_id = pp.link_id AND pa.provider_id = pp.provider_id
		WHERE pa.provider_id = ?
		ORDER BY pa.created_at, pa.id
	`
	
	rows, err := tx.Query(recordQuery, provider.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var addressPhoneRecords []models.AddressPhoneRecord
	for rows.Next() {
		var record models.AddressPhoneRecord
		var phoneID sql.NullInt64
		var phoneProviderID sql.NullInt64
		var phoneNumber sql.NullString
		var phoneCreatedAt sql.NullTime
		
		err := rows.Scan(
			&record.Address.ID, &record.Address.ProviderID, &record.Address.AddressCategory,
			&record.Address.Address1, &record.Address.Address2.NullString, &record.Address.City, 
			&record.Address.State, &record.Address.Zip, &record.Address.IsCorrect.NullBool,
			&record.Address.CorrectedAddress1.NullString, &record.Address.CorrectedAddress2.NullString,
			&record.Address.CorrectedCity.NullString, &record.Address.CorrectedState.NullString, &record.Address.CorrectedZip.NullString,
			&record.Address.ValidatedBy.NullInt64, &record.Address.ValidatedAt.NullTime, &record.Address.CreatedAt,
			&phoneID, &phoneProviderID, &phoneNumber,
			&record.Phone.IsCorrect.NullBool, &record.Phone.CorrectedPhone.NullString,
			&record.Phone.ValidatedBy.NullInt64, &record.Phone.ValidatedAt.NullTime, &phoneCreatedAt,
		)
		if err != nil {
			log.Printf("Error scanning address-phone record: %v", err)
			return nil, err
		}
		
		// Handle NULL phone values
		if phoneID.Valid {
			record.Phone.ID = int(phoneID.Int64)
			record.Phone.ProviderID = int(phoneProviderID.Int64)
			record.Phone.Phone = phoneNumber.String
			if phoneCreatedAt.Valid {
				record.Phone.CreatedAt = phoneCreatedAt.Time
			} else {
				record.Phone.CreatedAt = time.Now()
			}
		} else {
			// No phone for this address, use zero values
			record.Phone.ID = 0
			record.Phone.ProviderID = provider.ID
			record.Phone.Phone = ""
			record.Phone.CreatedAt = time.Time{}
		}
		
		// Create composite ID for this address-phone combination
		record.ID = fmt.Sprintf("%d-%d", record.Address.ID, record.Phone.ID)
		addressPhoneRecords = append(addressPhoneRecords, record)
	}

	// Now get distinct addresses
	addressQuery := `
		SELECT DISTINCT pa.id, pa.provider_id, pa.address_category, pa.address1, pa.address2, 
		       pa.city, pa.state, pa.zip, pa.is_correct,
		       pa.corrected_address1, pa.corrected_address2, pa.corrected_city,
		       pa.corrected_state, pa.corrected_zip, pa.validated_by, pa.validated_at, pa.created_at
		FROM provider_addresses pa
		WHERE pa.provider_id = ?
		ORDER BY pa.address_category, pa.created_at
	`
	
	addressRows, err := tx.Query(addressQuery, provider.ID)
	if err != nil {
		return nil, err
	}
	defer addressRows.Close()
	
	var addresses []models.ProviderAddress
	for addressRows.Next() {
		var addr models.ProviderAddress
		err := addressRows.Scan(
			&addr.ID, &addr.ProviderID, &addr.AddressCategory,
			&addr.Address1, &addr.Address2.NullString, &addr.City,
			&addr.State, &addr.Zip, &addr.IsCorrect.NullBool,
			&addr.CorrectedAddress1.NullString, &addr.CorrectedAddress2.NullString,
			&addr.CorrectedCity.NullString, &addr.CorrectedState.NullString, &addr.CorrectedZip.NullString,
			&addr.ValidatedBy.NullInt64, &addr.ValidatedAt.NullTime, &addr.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		addresses = append(addresses, addr)
	}
	
	// Get distinct phones
	phoneQuery := `
		SELECT DISTINCT pp.id, pp.provider_id, pp.phone, pp.is_correct, pp.corrected_phone,
		       pp.validated_by, pp.validated_at, pp.created_at
		FROM provider_phones pp
		WHERE pp.provider_id = ?
		ORDER BY pp.created_at
	`
	
	phoneRows, err := tx.Query(phoneQuery, provider.ID)
	if err != nil {
		return nil, err
	}
	defer phoneRows.Close()
	
	var phones []models.ProviderPhone
	phoneMap := make(map[string]bool) // To track unique phone numbers
	for phoneRows.Next() {
		var phone models.ProviderPhone
		err := phoneRows.Scan(
			&phone.ID, &phone.ProviderID, &phone.Phone,
			&phone.IsCorrect.NullBool, &phone.CorrectedPhone.NullString,
			&phone.ValidatedBy.NullInt64, &phone.ValidatedAt.NullTime, &phone.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		
		// Only add if we haven't seen this phone number yet
		if !phoneMap[phone.Phone] {
			phoneMap[phone.Phone] = true
			phones = append(phones, phone)
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	return &models.ProviderValidationData{
		Provider:            provider,
		AddressPhoneRecords: addressPhoneRecords,
		Addresses:           addresses,
		Phones:              phones,
		ValidationSession:   &session,
	}, nil
}

func UpdateValidation(sessionID int, userID int, update models.ValidationUpdate) error {
	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Verify session ownership
	var sessionUserID int
	err = tx.QueryRow(`
		SELECT user_id FROM validation_sessions WHERE id = ? AND status = 'in_progress'
	`, sessionID).Scan(&sessionUserID)
	if err != nil {
		return err
	}
	if sessionUserID != userID {
		return ErrSessionLocked
	}

	// Update addresses
	for _, addrVal := range update.AddressValidations {
		if addrVal.IsCorrect {
			_, err = tx.Exec(`
				UPDATE provider_addresses 
				SET is_correct = ?, validated_by = ?, validated_at = CURRENT_TIMESTAMP
				WHERE id = ?
			`, true, userID, addrVal.AddressID)
		} else {
			_, err = tx.Exec(`
				UPDATE provider_addresses 
				SET is_correct = ?, 
				    corrected_address1 = ?, corrected_address2 = ?,
				    corrected_city = ?, corrected_state = ?, corrected_zip = ?,
				    validated_by = ?, validated_at = CURRENT_TIMESTAMP
				WHERE id = ?
			`, false,
				models.NullString{NullString: sql.NullString{String: addrVal.CorrectedAddress1, Valid: addrVal.CorrectedAddress1 != ""}},
				models.NullString{NullString: sql.NullString{String: addrVal.CorrectedAddress2, Valid: addrVal.CorrectedAddress2 != ""}},
				models.NullString{NullString: sql.NullString{String: addrVal.CorrectedCity, Valid: addrVal.CorrectedCity != ""}},
				models.NullString{NullString: sql.NullString{String: addrVal.CorrectedState, Valid: addrVal.CorrectedState != ""}},
				models.NullString{NullString: sql.NullString{String: addrVal.CorrectedZip, Valid: addrVal.CorrectedZip != ""}},
				userID, addrVal.AddressID)
		}
		if err != nil {
			return err
		}
	}

	// Update phones
	for _, phoneVal := range update.PhoneValidations {
		if phoneVal.IsCorrect {
			_, err = tx.Exec(`
				UPDATE provider_phones 
				SET is_correct = ?, validated_by = ?, validated_at = CURRENT_TIMESTAMP
				WHERE id = ?
			`, true, userID, phoneVal.PhoneID)
		} else {
			_, err = tx.Exec(`
				UPDATE provider_phones 
				SET is_correct = ?, corrected_phone = ?,
				    validated_by = ?, validated_at = CURRENT_TIMESTAMP
				WHERE id = ?
			`, false,
				models.NullString{NullString: sql.NullString{String: phoneVal.CorrectedPhone, Valid: phoneVal.CorrectedPhone != ""}},
				userID, phoneVal.PhoneID)
		}
		if err != nil {
			return err
		}
	}

	// Add new addresses
	if len(update.NewAddresses) > 0 {
		// Get provider ID from session
		var providerID int
		err = tx.QueryRow(`
			SELECT provider_id FROM validation_sessions WHERE id = ?
		`, sessionID).Scan(&providerID)
		if err != nil {
			return err
		}

		for _, newAddr := range update.NewAddresses {
			_, err = tx.Exec(`
				INSERT INTO provider_addresses 
				(provider_id, address_category, address1, address2, city, state, zip, is_correct, validated_by, validated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			`, providerID, newAddr.AddressCategory, newAddr.Address1,
				models.NullString{NullString: sql.NullString{String: newAddr.Address2, Valid: newAddr.Address2 != ""}},
				newAddr.City, newAddr.State, newAddr.Zip, true, userID)
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

func RecordCallAttempt(sessionID int, userID int, attemptNumber int) error {
	if attemptNumber != 1 && attemptNumber != 2 {
		return ErrInvalidCallAttempt
	}

	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Verify session ownership
	var sessionUserID int
	var attempt1 models.NullTime
	err = tx.QueryRow(`
		SELECT user_id, call_attempt_1 FROM validation_sessions 
		WHERE id = ? AND status = 'in_progress'
	`, sessionID).Scan(&sessionUserID, &attempt1.NullTime)
	if err != nil {
		return err
	}
	if sessionUserID != userID {
		return ErrSessionLocked
	}

	// Check business day logic for attempt 2
	if attemptNumber == 2 && attempt1.Valid {
		if !isNextBusinessDay(attempt1.Time, time.Now()) {
			return errors.New("call attempt 2 must be at least 1 business day after attempt 1")
		}
	}

	// Update the appropriate attempt
	if attemptNumber == 1 {
		_, err = tx.Exec(`
			UPDATE validation_sessions 
			SET call_attempt_1 = CURRENT_TIMESTAMP 
			WHERE id = ?
		`, sessionID)
	} else {
		_, err = tx.Exec(`
			UPDATE validation_sessions 
			SET call_attempt_2 = CURRENT_TIMESTAMP 
			WHERE id = ?
		`, sessionID)
	}

	if err != nil {
		return err
	}

	return tx.Commit()
}

func CompleteValidation(sessionID int, userID int) error {
	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Verify session ownership and that all validations are complete
	var sessionUserID, providerID int
	err = tx.QueryRow(`
		SELECT user_id, provider_id FROM validation_sessions 
		WHERE id = ? AND status = 'in_progress'
	`, sessionID).Scan(&sessionUserID, &providerID)
	if err != nil {
		return err
	}
	if sessionUserID != userID {
		return ErrSessionLocked
	}

	// Check if all addresses and phones have been validated
	var unvalidatedCount int
	err = tx.QueryRow(`
		SELECT COUNT(*) FROM (
			SELECT id FROM provider_addresses 
			WHERE provider_id = ? AND is_correct IS NULL
			UNION ALL
			SELECT id FROM provider_phones 
			WHERE provider_id = ? AND is_correct IS NULL
		)
	`, providerID, providerID).Scan(&unvalidatedCount)
	if err != nil {
		return err
	}

	if unvalidatedCount > 0 {
		return errors.New("all addresses and phones must be validated before completing")
	}

	// Complete the session
	_, err = tx.Exec(`
		UPDATE validation_sessions 
		SET status = 'completed', closed_date = CURRENT_TIMESTAMP 
		WHERE id = ?
	`, sessionID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func isNextBusinessDay(t1, t2 time.Time) bool {
	// Simple implementation - considers weekends
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

func GetStats(userID int) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total providers needing validation
	var totalPending int
	err := database.DB.QueryRow(`
		SELECT COUNT(DISTINCT p.id)
		FROM providers p
		LEFT JOIN provider_addresses pa ON p.id = pa.provider_id
		LEFT JOIN provider_phones pp ON p.id = pp.provider_id
		LEFT JOIN validation_sessions vs ON p.id = vs.provider_id AND vs.status = 'in_progress'
		WHERE vs.id IS NULL
		  AND (pa.is_correct IS NULL OR pp.is_correct IS NULL)
	`).Scan(&totalPending)
	if err != nil {
		return nil, err
	}
	stats["total_pending"] = totalPending

	// User's completed today
	var completedToday int
	err = database.DB.QueryRow(`
		SELECT COUNT(*) FROM validation_sessions 
		WHERE user_id = ? AND DATE(closed_date) = DATE('now') AND status = 'completed'
	`, userID).Scan(&completedToday)
	if err != nil {
		return nil, err
	}
	stats["completed_today"] = completedToday

	// Currently in progress
	var inProgress int
	err = database.DB.QueryRow(`
		SELECT COUNT(*) FROM validation_sessions 
		WHERE user_id = ? AND status = 'in_progress'
	`, userID).Scan(&inProgress)
	if err != nil {
		return nil, err
	}
	stats["in_progress"] = inProgress

	return stats, nil
}