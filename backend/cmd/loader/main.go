package main

import (
	"context"
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/user/auth-app/internal/database"
)

func main() {
	// Load database configuration
	config := database.LoadConfig()
	
	// Initialize PostgreSQL connection pool
	if err := database.InitDB(config); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer database.Close()

	// Get CSV file path
	csvPath := os.Getenv("CSV_PATH")
	if csvPath == "" {
		if len(os.Args) >= 2 {
			csvPath = os.Args[1]
		} else {
			csvPath = "./bpo_inconclusive_provider_data_sample.csv"
		}
	}

	// Check if we should skip data loading
	if os.Getenv("SKIP_DATA_LOAD") == "true" {
		log.Println("Skipping data load as SKIP_DATA_LOAD is set to true")
		return
	}

	// Check if data already exists
	ctx := context.Background()
	var providerCount int
	err := database.QueryRow(ctx, "SELECT COUNT(*) FROM providers").Scan(&providerCount)
	if err != nil {
		log.Printf("Warning: Could not check existing data: %v", err)
	} else if providerCount > 0 {
		log.Printf("Data already exists (%d providers). Skipping load.", providerCount)
		return
	}

	log.Printf("Loading CSV data from: %s", csvPath)

	// Open CSV file
	file, err := os.Open(csvPath)
	if err != nil {
		log.Fatal("Failed to open CSV file:", err)
	}
	defer file.Close()

	// Read CSV
	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1 // Allow variable number of fields
	records, err := reader.ReadAll()
	if err != nil {
		log.Fatal("Failed to read CSV:", err)
	}

	if len(records) == 0 {
		log.Fatal("CSV file is empty")
	}

	// Log the header for debugging
	log.Printf("CSV Header: %v", records[0])

	// Skip header
	dataRecords := records[1:]
	log.Printf("Processing %d data records", len(dataRecords))

	// Use transaction for better performance and consistency
	err = database.WithTx(ctx, func(tx pgx.Tx) error {
		return loadCSVData(ctx, tx, dataRecords)
	})

	if err != nil {
		log.Fatal("Failed to load CSV data:", err)
	}

	// Print final statistics
	printStatistics(ctx)
}

func loadCSVData(ctx context.Context, tx pgx.Tx, records [][]string) error {
	// Track unique providers and prepare batch inserts
	providers := make(map[string]int)    // npi -> provider_id
	addresses := []AddressRecord{}
	phones := []PhoneRecord{}
	
	log.Printf("Processing %d records...", len(records))

	// Process records in batches for better performance
	batchSize := 1000
	for i := 0; i < len(records); i += batchSize {
		end := i + batchSize
		if end > len(records) {
			end = len(records)
		}
		
		batch := records[i:end]
		log.Printf("Processing batch %d-%d of %d", i+1, end, len(records))
		
		if err := processBatch(ctx, tx, batch, providers, &addresses, &phones, i); err != nil {
			return fmt.Errorf("failed to process batch %d-%d: %w", i+1, end, err)
		}
	}

	// Insert addresses in batch
	if err := batchInsertAddresses(ctx, tx, addresses); err != nil {
		return fmt.Errorf("failed to batch insert addresses: %w", err)
	}

	// Insert phones in batch
	if err := batchInsertPhones(ctx, tx, phones); err != nil {
		return fmt.Errorf("failed to batch insert phones: %w", err)
	}

	log.Printf("Successfully loaded %d providers, %d addresses, %d phones", 
		len(providers), len(addresses), len(phones))
	
	return nil
}

func processBatch(ctx context.Context, tx pgx.Tx, batch [][]string, providers map[string]int, 
	addresses *[]AddressRecord, phones *[]PhoneRecord, batchOffset int) error {
	
	for idx, record := range batch {
		if len(record) < 15 {
			log.Printf("Skipping record %d: insufficient fields (%d)", batchOffset+idx, len(record))
			continue
		}

		// Parse CSV fields
		npi := strings.TrimSpace(record[0])
		gnpi := strings.TrimSpace(record[1])
		groupName := strings.TrimSpace(record[2])
		specialty := strings.TrimSpace(record[3])
		firstName := strings.TrimSpace(record[4])
		lastName := strings.TrimSpace(record[5])
		addressCategory := strings.TrimSpace(record[6])
		address1 := strings.TrimSpace(record[7])
		address2 := strings.TrimSpace(record[8])
		city := strings.TrimSpace(record[9])
		state := strings.TrimSpace(record[10])
		zip := strings.TrimSpace(record[11])
		phone := strings.TrimSpace(record[12])
		addressStatus := strings.TrimSpace(record[13])
		phoneStatus := strings.TrimSpace(record[14])

		// Validate required fields
		if npi == "" || firstName == "" || lastName == "" {
			log.Printf("Skipping record %d: missing required fields", batchOffset+idx)
			continue
		}

		// Get or create provider
		providerID, exists := providers[npi]
		if !exists {
			var err error
			providerID, err = createProvider(ctx, tx, npi, gnpi, firstName, lastName, specialty, groupName)
			if err != nil {
				log.Printf("Failed to create provider %s: %v", npi, err)
				continue
			}
			providers[npi] = providerID
		}

		// Generate unique link ID for this address-phone pair
		linkID := fmt.Sprintf("%d-%d-%d", providerID, batchOffset+idx, len(*addresses))

		// Prepare address record
		addressRecord := AddressRecord{
			ProviderID:      providerID,
			AddressCategory: normalizeAddressCategory(addressCategory),
			Address1:        address1,
			Address2:        nullIfEmpty(address2),
			City:            nullIfEmpty(city),
			State:           normalizeState(state),
			Zip:             normalizeZip(zip),
			IsCorrect:       parseValidationStatus(addressStatus),
			LinkID:          linkID,
		}
		*addresses = append(*addresses, addressRecord)

		// Prepare phone record if phone exists
		if phone != "" && phone != "null" {
			phoneRecord := PhoneRecord{
				ProviderID: providerID,
				Phone:      normalizePhone(phone),
				PhoneType:  "office",
				IsCorrect:  parseValidationStatus(phoneStatus),
				LinkID:     linkID,
			}
			*phones = append(*phones, phoneRecord)
		}
	}

	return nil
}

func createProvider(ctx context.Context, tx pgx.Tx, npi, gnpi, firstName, lastName, specialty, groupName string) (int, error) {
	providerName := strings.TrimSpace(firstName + " " + lastName)
	
	var providerID int
	err := tx.QueryRow(ctx, `
		INSERT INTO providers (uuid, npi, gnpi, provider_name, specialty, provider_group, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, true)
		ON CONFLICT (npi) DO UPDATE SET 
			provider_name = EXCLUDED.provider_name,
			specialty = EXCLUDED.specialty,
			provider_group = EXCLUDED.provider_group,
			updated_at = CURRENT_TIMESTAMP
		RETURNING id
	`, uuid.New(), npi, nullIfEmpty(gnpi), providerName, nullIfEmpty(specialty), nullIfEmpty(groupName)).Scan(&providerID)
	
	return providerID, err
}

func batchInsertAddresses(ctx context.Context, tx pgx.Tx, addresses []AddressRecord) error {
	if len(addresses) == 0 {
		return nil
	}

	// Use COPY for bulk insert performance
	copySource := pgx.CopyFromSlice(len(addresses), func(i int) ([]interface{}, error) {
		addr := addresses[i]
		return []interface{}{
			uuid.New(),                    // uuid
			addr.ProviderID,              // provider_id
			addr.AddressCategory,         // address_category
			addr.Address1,                // address1
			addr.Address2,                // address2
			addr.City,                    // city
			addr.State,                   // state
			addr.Zip,                     // zip
			"US",                         // country
			addr.IsCorrect,               // is_correct
			addr.LinkID,                  // link_id
		}, nil
	})

	_, err := tx.CopyFrom(ctx, pgx.Identifier{"provider_addresses"}, 
		[]string{"uuid", "provider_id", "address_category", "address1", "address2", 
			"city", "state", "zip", "country", "is_correct", "link_id"}, copySource)
	
	if err != nil {
		return fmt.Errorf("failed to copy addresses: %w", err)
	}

	log.Printf("Inserted %d addresses using COPY", len(addresses))
	return nil
}

func batchInsertPhones(ctx context.Context, tx pgx.Tx, phones []PhoneRecord) error {
	if len(phones) == 0 {
		return nil
	}

	// Use COPY for bulk insert performance
	copySource := pgx.CopyFromSlice(len(phones), func(i int) ([]interface{}, error) {
		phone := phones[i]
		return []interface{}{
			uuid.New(),         // uuid
			phone.ProviderID,   // provider_id
			phone.Phone,        // phone
			phone.PhoneType,    // phone_type
			nil,                // extension
			phone.IsCorrect,    // is_correct
			phone.LinkID,       // link_id
		}, nil
	})

	_, err := tx.CopyFrom(ctx, pgx.Identifier{"provider_phones"}, 
		[]string{"uuid", "provider_id", "phone", "phone_type", "extension", "is_correct", "link_id"}, copySource)
	
	if err != nil {
		return fmt.Errorf("failed to copy phones: %w", err)
	}

	log.Printf("Inserted %d phones using COPY", len(phones))
	return nil
}

func printStatistics(ctx context.Context) {
	var stats struct {
		Providers     int
		Addresses     int
		Phones        int
		LinkedPairs   int
		ValidatedAddr int
		ValidatedPhone int
	}

	// Get counts
	database.QueryRow(ctx, "SELECT COUNT(*) FROM providers").Scan(&stats.Providers)
	database.QueryRow(ctx, "SELECT COUNT(*) FROM provider_addresses").Scan(&stats.Addresses)
	database.QueryRow(ctx, "SELECT COUNT(*) FROM provider_phones").Scan(&stats.Phones)
	database.QueryRow(ctx, `
		SELECT COUNT(DISTINCT pa.link_id) 
		FROM provider_addresses pa
		INNER JOIN provider_phones pp ON pa.link_id = pp.link_id
		WHERE pa.link_id IS NOT NULL AND pa.link_id != ''
	`).Scan(&stats.LinkedPairs)
	database.QueryRow(ctx, "SELECT COUNT(*) FROM provider_addresses WHERE is_correct IS NOT NULL").Scan(&stats.ValidatedAddr)
	database.QueryRow(ctx, "SELECT COUNT(*) FROM provider_phones WHERE is_correct IS NOT NULL").Scan(&stats.ValidatedPhone)

	fmt.Printf("\n=== CSV Data Loading Complete ===\n")
	fmt.Printf("Providers: %d\n", stats.Providers)
	fmt.Printf("Addresses: %d\n", stats.Addresses)
	fmt.Printf("Phones: %d\n", stats.Phones)
	fmt.Printf("Linked address-phone pairs: %d\n", stats.LinkedPairs)
	fmt.Printf("Pre-validated addresses: %d\n", stats.ValidatedAddr)
	fmt.Printf("Pre-validated phones: %d\n", stats.ValidatedPhone)
	fmt.Printf("Ready for validation workflow!\n")
}

// Data structures for batch operations
type AddressRecord struct {
	ProviderID      int
	AddressCategory string
	Address1        string
	Address2        *string
	City            *string
	State           *string
	Zip             *string
	IsCorrect       *bool
	LinkID          string
}

type PhoneRecord struct {
	ProviderID int
	Phone      string
	PhoneType  string
	IsCorrect  *bool
	LinkID     string
}

// Utility functions for data normalization
func nullIfEmpty(s string) *string {
	if s == "" || s == "null" {
		return nil
	}
	return &s
}

func normalizeAddressCategory(category string) string {
	switch strings.ToLower(strings.TrimSpace(category)) {
	case "practice", "practice location":
		return "practice"
	case "mailing", "mail":
		return "mailing"
	case "billing":
		return "billing"
	default:
		if category == "" {
			return "practice"
		}
		return "other"
	}
}

func normalizeState(state string) *string {
	state = strings.ToUpper(strings.TrimSpace(state))
	if len(state) == 2 && state != "" {
		return &state
	}
	return nil
}

func normalizeZip(zip string) *string {
	zip = strings.TrimSpace(zip)
	if zip == "" || zip == "null" {
		return nil
	}
	// Remove any non-digit characters except hyphens
	normalized := ""
	for _, char := range zip {
		if char >= '0' && char <= '9' || char == '-' {
			normalized += string(char)
		}
	}
	if len(normalized) >= 5 {
		return &normalized
	}
	return nil
}

func normalizePhone(phone string) string {
	// Remove all non-digit characters
	normalized := ""
	for _, char := range phone {
		if char >= '0' && char <= '9' {
			normalized += string(char)
		}
	}
	
	// Format as (XXX) XXX-XXXX if it's a 10-digit US number
	if len(normalized) == 10 {
		return fmt.Sprintf("(%s) %s-%s", 
			normalized[0:3], normalized[3:6], normalized[6:10])
	} else if len(normalized) == 11 && normalized[0] == '1' {
		// Handle 1-XXX-XXX-XXXX format
		return fmt.Sprintf("(%s) %s-%s", 
			normalized[1:4], normalized[4:7], normalized[7:11])
	}
	
	return phone // Return original if we can't normalize
}

func parseValidationStatus(status string) *bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "yes", "y", "true", "1", "correct":
		result := true
		return &result
	case "no", "n", "false", "0", "incorrect":
		result := false
		return &result
	default:
		return nil // Unknown status, needs validation
	}
}