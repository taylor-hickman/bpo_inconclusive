package main

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"log"
	"os"

	"github.com/user/auth-app/internal/database"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: go run main.go <csv_file_path>")
	}

	csvPath := os.Args[1]

	// Initialize database using environment variable or default
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./auth.db"
	}
	
	if err := database.InitDB(dbPath); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Open CSV file
	file, err := os.Open(csvPath)
	if err != nil {
		log.Fatal("Failed to open CSV file:", err)
	}
	defer file.Close()

	// Read CSV
	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		log.Fatal("Failed to read CSV:", err)
	}

	// Skip header
	if len(records) > 0 {
		records = records[1:]
	}

	// Track unique providers
	providers := make(map[string]int) // npi -> provider_id
	rowCount := 0

	// Insert records
	for idx, record := range records {
		if len(record) < 15 {
			continue
		}

		npi := record[0]
		gnpi := record[1]
		groupName := record[2]
		specialty := record[3]
		firstName := record[4]
		lastName := record[5]
		addressCategory := record[6]
		address1 := record[7]
		address2 := record[8]
		city := record[9]
		state := record[10]
		zip := record[11]
		phone := record[12]
		addressStatus := record[13]
		phoneStatus := record[14]

		// Check if provider exists
		providerID, exists := providers[npi]
		if !exists {
			// Insert provider
			providerName := firstName + " " + lastName
			result, err := database.DB.Exec(`
				INSERT INTO providers (npi, gnpi, provider_name, specialty, provider_group)
				VALUES (?, ?, ?, ?, ?)
			`, npi, gnpi, providerName, specialty, groupName)
			
			if err != nil {
				// Try to get existing provider
				err = database.DB.QueryRow("SELECT id FROM providers WHERE npi = ?", npi).Scan(&providerID)
				if err != nil {
					log.Printf("Failed to insert/find provider %s: %v", npi, err)
					continue
				}
			} else {
				id, _ := result.LastInsertId()
				providerID = int(id)
			}
			providers[npi] = providerID
		}

		// Create a unique link_id for this address-phone pair
		linkID := fmt.Sprintf("%d-%d-%d", providerID, idx, rowCount)
		rowCount++

		// Insert address
		var isCorrect sql.NullBool
		if addressStatus == "Yes" {
			isCorrect = sql.NullBool{Bool: true, Valid: true}
		} else if addressStatus == "No" {
			isCorrect = sql.NullBool{Bool: false, Valid: true}
		}

		addressResult, err := database.DB.Exec(`
			INSERT INTO provider_addresses (provider_id, address_category, address1, address2, city, state, zip, is_correct, link_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, providerID, addressCategory, address1, 
			sql.NullString{String: address2, Valid: address2 != "null" && address2 != ""}, 
			city, state, zip, isCorrect, linkID)
		
		if err != nil {
			log.Printf("Failed to insert address for provider %s: %v", npi, err)
			continue
		}

		addressID, _ := addressResult.LastInsertId()

		// Insert phone with the same link_id
		var phoneCorrect sql.NullBool
		if phoneStatus == "Yes" {
			phoneCorrect = sql.NullBool{Bool: true, Valid: true}
		} else if phoneStatus == "No" {
			phoneCorrect = sql.NullBool{Bool: false, Valid: true}
		}

		// Insert phone (always insert with link_id, even if it might be duplicate)
		if phone != "null" && phone != "" {
			phoneResult, err := database.DB.Exec(`
				INSERT INTO provider_phones (provider_id, phone, is_correct, link_id)
				VALUES (?, ?, ?, ?)
			`, providerID, phone, phoneCorrect, linkID)
			
			if err != nil {
				log.Printf("Failed to insert phone for provider %s: %v", npi, err)
			} else {
				phoneID, _ := phoneResult.LastInsertId()
				log.Printf("Linked address %d with phone %d using link_id %s", addressID, phoneID, linkID)
			}
		} else {
			// Even if no phone, we should mark the address as having no phone
			log.Printf("Address %d has no phone (link_id %s)", addressID, linkID)
		}
	}

	// Count records
	var providerCount, addressCount, phoneCount int
	database.DB.QueryRow("SELECT COUNT(*) FROM providers").Scan(&providerCount)
	database.DB.QueryRow("SELECT COUNT(*) FROM provider_addresses").Scan(&addressCount)
	database.DB.QueryRow("SELECT COUNT(*) FROM provider_phones").Scan(&phoneCount)

	// Count properly linked pairs
	var linkedPairs int
	database.DB.QueryRow(`
		SELECT COUNT(DISTINCT pa.link_id) 
		FROM provider_addresses pa
		INNER JOIN provider_phones pp ON pa.link_id = pp.link_id
		WHERE pa.link_id IS NOT NULL
	`).Scan(&linkedPairs)

	fmt.Printf("CSV data loaded successfully!\n")
	fmt.Printf("Providers: %d\n", providerCount)
	fmt.Printf("Addresses: %d\n", addressCount)
	fmt.Printf("Phones: %d\n", phoneCount)
	fmt.Printf("Linked address-phone pairs: %d\n", linkedPairs)
}