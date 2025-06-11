package main

import (
	"fmt"
	"log"

	"github.com/user/auth-app/internal/database"
)

func main() {
	// Initialize database
	if err := database.InitDB("./auth.db"); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	fmt.Println("Applying migrations...")

	// Add link_id columns
	migrations := []string{
		"ALTER TABLE provider_addresses ADD COLUMN link_id TEXT",
		"ALTER TABLE provider_phones ADD COLUMN link_id TEXT",
		"CREATE INDEX IF NOT EXISTS idx_provider_addresses_link_id ON provider_addresses(link_id)",
		"CREATE INDEX IF NOT EXISTS idx_provider_phones_link_id ON provider_phones(link_id)",
	}

	for _, migration := range migrations {
		_, err := database.DB.Exec(migration)
		if err != nil {
			// Column might already exist
			fmt.Printf("Migration skipped (might already exist): %v\n", err)
		} else {
			fmt.Printf("Applied: %s\n", migration)
		}
	}

	// Link existing data based on creation order
	fmt.Println("\nLinking existing address-phone pairs...")

	// Get all providers
	rows, err := database.DB.Query("SELECT DISTINCT provider_id FROM provider_addresses ORDER BY provider_id")
	if err != nil {
		log.Fatal("Failed to get providers:", err)
	}
	defer rows.Close()

	var providerIDs []int
	for rows.Next() {
		var id int
		rows.Scan(&id)
		providerIDs = append(providerIDs, id)
	}

	// For each provider, link addresses and phones by order
	for _, providerID := range providerIDs {
		// Get addresses ordered by creation
		addrRows, err := database.DB.Query(`
			SELECT id FROM provider_addresses 
			WHERE provider_id = ? 
			ORDER BY created_at, id
		`, providerID)
		if err != nil {
			log.Printf("Failed to get addresses for provider %d: %v", providerID, err)
			continue
		}

		var addressIDs []int
		for addrRows.Next() {
			var id int
			addrRows.Scan(&id)
			addressIDs = append(addressIDs, id)
		}
		addrRows.Close()

		// Get phones ordered by creation
		phoneRows, err := database.DB.Query(`
			SELECT id FROM provider_phones 
			WHERE provider_id = ? 
			ORDER BY created_at, id
		`, providerID)
		if err != nil {
			log.Printf("Failed to get phones for provider %d: %v", providerID, err)
			continue
		}

		var phoneIDs []int
		for phoneRows.Next() {
			var id int
			phoneRows.Scan(&id)
			phoneIDs = append(phoneIDs, id)
		}
		phoneRows.Close()

		// Link addresses and phones
		for i := 0; i < len(addressIDs); i++ {
			linkID := fmt.Sprintf("%d-%d", providerID, i+1)
			
			// Update address
			_, err = database.DB.Exec(`
				UPDATE provider_addresses 
				SET link_id = ? 
				WHERE id = ?
			`, linkID, addressIDs[i])
			if err != nil {
				log.Printf("Failed to update address %d: %v", addressIDs[i], err)
			}

			// Update corresponding phone if it exists
			if i < len(phoneIDs) {
				_, err = database.DB.Exec(`
					UPDATE provider_phones 
					SET link_id = ? 
					WHERE id = ?
				`, linkID, phoneIDs[i])
				if err != nil {
					log.Printf("Failed to update phone %d: %v", phoneIDs[i], err)
				}
			}
		}

		fmt.Printf("Linked %d addresses with %d phones for provider %d\n", 
			len(addressIDs), len(phoneIDs), providerID)
	}

	// Show statistics
	var linkedCount int
	database.DB.QueryRow(`
		SELECT COUNT(DISTINCT pa.link_id) 
		FROM provider_addresses pa
		INNER JOIN provider_phones pp ON pa.link_id = pp.link_id
		WHERE pa.link_id IS NOT NULL
	`).Scan(&linkedCount)

	fmt.Printf("\nMigration complete! %d address-phone pairs are now properly linked.\n", linkedCount)
}