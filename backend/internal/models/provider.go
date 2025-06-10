package models

import (
	"time"
)

type Provider struct {
	ID            int    `json:"id"`
	NPI           string `json:"npi"`
	GNPI          string `json:"gnpi"`
	ProviderName  string `json:"provider_name"`
	Specialty     string `json:"specialty"`
	ProviderGroup string `json:"provider_group"`
	CreatedAt     time.Time `json:"created_at"`
}

type ProviderAddress struct {
	ID                int            `json:"id"`
	ProviderID        int            `json:"provider_id"`
	AddressCategory   string         `json:"address_category"`
	Address1          string         `json:"address1"`
	Address2          NullString `json:"address2"`
	City              string         `json:"city"`
	State             string         `json:"state"`
	Zip               string         `json:"zip"`
	IsCorrect         NullBool   `json:"is_correct"`
	CorrectedAddress1 NullString `json:"corrected_address1"`
	CorrectedAddress2 NullString `json:"corrected_address2"`
	CorrectedCity     NullString `json:"corrected_city"`
	CorrectedState    NullString `json:"corrected_state"`
	CorrectedZip      NullString `json:"corrected_zip"`
	ValidatedBy       NullInt64  `json:"validated_by"`
	ValidatedAt       NullTime   `json:"validated_at"`
	CreatedAt         time.Time      `json:"created_at"`
}

type ProviderPhone struct {
	ID             int            `json:"id"`
	ProviderID     int            `json:"provider_id"`
	Phone          string         `json:"phone"`
	IsCorrect      NullBool   `json:"is_correct"`
	CorrectedPhone NullString `json:"corrected_phone"`
	ValidatedBy    NullInt64  `json:"validated_by"`
	ValidatedAt    NullTime   `json:"validated_at"`
	CreatedAt      time.Time      `json:"created_at"`
}

type ValidationSession struct {
	ID           int           `json:"id"`
	ProviderID   int           `json:"provider_id"`
	UserID       int           `json:"user_id"`
	CallAttempt1 NullTime  `json:"call_attempt_1"`
	CallAttempt2 NullTime  `json:"call_attempt_2"`
	ClosedDate   NullTime  `json:"closed_date"`
	Status       string        `json:"status"`
	LockedAt     time.Time     `json:"locked_at"`
	CreatedAt    time.Time     `json:"created_at"`
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

type CallAttemptRequest struct {
	AttemptNumber int `json:"attempt_number"` // 1 or 2
}