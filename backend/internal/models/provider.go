package models

import (
	"time"

	"github.com/google/uuid"
)

type Provider struct {
	ID               int                    `json:"id"`
	UUID             uuid.UUID              `json:"uuid"`
	NPI              string                 `json:"npi"`
	GNPI             NullString             `json:"gnpi"`
	ProviderName     string                 `json:"provider_name"`
	Specialty        NullString             `json:"specialty"`
	ProviderGroup    NullString             `json:"provider_group"`
	LicenseNumbers   []string               `json:"license_numbers,omitempty"`
	Credentials      []string               `json:"credentials,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	IsActive         bool                   `json:"is_active"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
	CreatedBy        NullInt64              `json:"created_by,omitempty"`
	UpdatedBy        NullInt64              `json:"updated_by,omitempty"`
}

type ProviderAddress struct {
	ID                  int                    `json:"id"`
	UUID                uuid.UUID              `json:"uuid"`
	ProviderID          int                    `json:"provider_id"`
	AddressCategory     string                 `json:"address_category"`
	Address1            string                 `json:"address1"`
	Address2            NullString             `json:"address2"`
	City                NullString             `json:"city"`
	State               NullString             `json:"state"`
	Zip                 NullString             `json:"zip"`
	Country             string                 `json:"country"`
	IsCorrect           NullBool               `json:"is_correct"`
	CorrectedAddress1   NullString             `json:"corrected_address1"`
	CorrectedAddress2   NullString             `json:"corrected_address2"`
	CorrectedCity       NullString             `json:"corrected_city"`
	CorrectedState      NullString             `json:"corrected_state"`
	CorrectedZip        NullString             `json:"corrected_zip"`
	ValidationNotes     NullString             `json:"validation_notes"`
	ValidationMetadata  map[string]interface{} `json:"validation_metadata,omitempty"`
	ConfidenceScore     NullFloat64            `json:"confidence_score"`
	ValidatedBy         NullInt64              `json:"validated_by"`
	ValidatedAt         NullTime               `json:"validated_at"`
	CreatedAt           time.Time              `json:"created_at"`
	UpdatedAt           time.Time              `json:"updated_at"`
	CreatedBy           NullInt64              `json:"created_by,omitempty"`
	UpdatedBy           NullInt64              `json:"updated_by,omitempty"`
	LinkID              NullString             `json:"link_id,omitempty"` // Legacy compatibility
}

type ProviderPhone struct {
	ID                 int                      `json:"id"`
	UUID               uuid.UUID                `json:"uuid"`
	ProviderID         int                      `json:"provider_id"`
	Phone              string                   `json:"phone"`
	PhoneType          string                   `json:"phone_type"`
	Extension          NullString               `json:"extension"`
	IsCorrect          NullBool                 `json:"is_correct"`
	CorrectedPhone     NullString               `json:"corrected_phone"`
	ValidationNotes    NullString               `json:"validation_notes"`
	ValidationMetadata map[string]interface{}   `json:"validation_metadata,omitempty"`
	CallAttempts       []CallAttemptRecord      `json:"call_attempts,omitempty"`
	IsFlagged          bool                     `json:"is_flagged"`
	FlagReason         NullString               `json:"flag_reason"`
	ConfidenceScore    NullFloat64              `json:"confidence_score"`
	ValidatedBy        NullInt64                `json:"validated_by"`
	ValidatedAt        NullTime                 `json:"validated_at"`
	CreatedAt          time.Time                `json:"created_at"`
	UpdatedAt          time.Time                `json:"updated_at"`
	CreatedBy          NullInt64                `json:"created_by,omitempty"`
	UpdatedBy          NullInt64                `json:"updated_by,omitempty"`
	LinkID             NullString               `json:"link_id,omitempty"` // Legacy compatibility
}

type ValidationSession struct {
	ID                int                      `json:"id"`
	UUID              uuid.UUID                `json:"uuid"`
	ProviderID        int                      `json:"provider_id"`
	UserID            int                      `json:"user_id"`
	Status            string                   `json:"status"`
	Priority          int                      `json:"priority"`
	CallAttempts      []CallAttemptRecord      `json:"call_attempts,omitempty"`
	CallAttempt1      NullTime                 `json:"call_attempt_1"`      // Legacy compatibility
	CallAttempt2      NullTime                 `json:"call_attempt_2"`      // Legacy compatibility
	StartedAt         time.Time                `json:"started_at"`
	CompletedAt       NullTime                 `json:"completed_at"`
	LockedAt          time.Time                `json:"locked_at"`
	LockedBy          NullInt64                `json:"locked_by"`
	ValidationResults map[string]interface{}   `json:"validation_results,omitempty"`
	Notes             NullString               `json:"notes"`
	QualityScore      NullFloat64              `json:"quality_score"`
	CreatedAt         time.Time                `json:"created_at"`
	UpdatedAt         time.Time                `json:"updated_at"`
	CreatedBy         NullInt64                `json:"created_by,omitempty"`
	UpdatedBy         NullInt64                `json:"updated_by,omitempty"`
}

type AddressPhoneRecord struct {
	ID      string          `json:"id"`       // composite identifier: "addr_id-phone_id"
	Address ProviderAddress `json:"address"`
	Phone   ProviderPhone   `json:"phone"`
}

type ProviderValidationData struct {
	Provider            Provider             `json:"provider"`
	AddressPhoneRecords []AddressPhoneRecord `json:"address_phone_records"` // Legacy field for backward compatibility
	Addresses           []ProviderAddress    `json:"addresses"`
	Phones              []ProviderPhone      `json:"phones"`
	ValidationSession   *ValidationSession   `json:"validation_session,omitempty"`
}

type AddressValidation struct {
	AddressID         int    `json:"address_id"`
	IsCorrect         bool   `json:"is_correct"`
	CorrectedAddress1 string `json:"corrected_address1,omitempty"`
	CorrectedAddress2 string `json:"corrected_address2,omitempty"`
	CorrectedCity     string `json:"corrected_city,omitempty"`
	CorrectedState    string `json:"corrected_state,omitempty"`
	CorrectedZip      string `json:"corrected_zip,omitempty"`
}

type PhoneValidation struct {
	PhoneID        int    `json:"phone_id"`
	IsCorrect      bool   `json:"is_correct"`
	CorrectedPhone string `json:"corrected_phone,omitempty"`
}

type ValidationUpdate struct {
	AddressValidations []AddressValidation `json:"address_validations"`
	PhoneValidations   []PhoneValidation   `json:"phone_validations"`
	NewAddresses       []AddressInput      `json:"new_addresses,omitempty"`
}

type AddressInput struct {
	AddressCategory string `json:"address_category"`
	Address1        string `json:"address1"`
	Address2        string `json:"address2,omitempty"`
	City            string `json:"city"`
	State           string `json:"state"`
	Zip             string `json:"zip"`
}

// New types for enhanced validation tracking
type CallAttemptRecord struct {
	AttemptNumber int       `json:"attempt_number"`
	AttemptedAt   time.Time `json:"attempted_at"`
	Status        string    `json:"status"` // successful, no_answer, busy, disconnected, invalid
	Notes         string    `json:"notes,omitempty"`
	Duration      int       `json:"duration,omitempty"` // seconds
}

type FlaggedPhone struct {
	ID         int                    `json:"id"`
	UUID       uuid.UUID              `json:"uuid"`
	Phone      string                 `json:"phone"`
	FlagType   string                 `json:"flag_type"`
	FlagReason NullString             `json:"flag_reason"`
	FlaggedCount int                  `json:"flagged_count"`
	Severity   int                    `json:"severity"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	FlaggedBy  int                    `json:"flagged_by"`
	ResolvedBy NullInt64              `json:"resolved_by"`
	ResolvedAt NullTime               `json:"resolved_at"`
	IsActive   bool                   `json:"is_active"`
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
}

type ValidationStats struct {
	UserID                  int         `json:"user_id"`
	Email                   string      `json:"email"`
	TotalValidations        int         `json:"total_validations"`
	CompletedValidations    int         `json:"completed_validations"`
	InProgressValidations   int         `json:"in_progress_validations"`
	AvgQualityScore         NullFloat64 `json:"avg_quality_score"`
	AvgCompletionTimeMinutes NullFloat64 `json:"avg_completion_time_minutes"`
	UniqueProvidersValidated int         `json:"unique_providers_validated"`
	LastValidationDate      NullTime    `json:"last_validation_date"`
}

type ProviderSearchResult struct {
	ID           int       `json:"id"`
	UUID         uuid.UUID `json:"uuid"`
	NPI          string    `json:"npi"`
	ProviderName string    `json:"provider_name"`
	Specialty    string    `json:"specialty"`
	ProviderGroup string   `json:"provider_group"`
	Rank         float32   `json:"rank"`
}

type CallAttemptRequest struct {
	AttemptNumber int `json:"attempt_number"` // 1 or 2
}