package database

import (
	"database/sql"
	"fmt"
	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB(dataSourceName string) error {
	var err error
	DB, err = sql.Open("sqlite3", dataSourceName)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	if err = createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	return nil
}

func createTables() error {
	userTable := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT UNIQUE NOT NULL,
		password TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`

	providerTable := `
	CREATE TABLE IF NOT EXISTS providers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		npi TEXT NOT NULL,
		gnpi TEXT,
		provider_name TEXT NOT NULL,
		specialty TEXT,
		provider_group TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(npi)
	);`

	providerAddressTable := `
	CREATE TABLE IF NOT EXISTS provider_addresses (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		provider_id INTEGER NOT NULL,
		address_category TEXT,
		address1 TEXT NOT NULL,
		address2 TEXT,
		city TEXT,
		state TEXT,
		zip TEXT,
		is_correct BOOLEAN,
		corrected_address1 TEXT,
		corrected_address2 TEXT,
		corrected_city TEXT,
		corrected_state TEXT,
		corrected_zip TEXT,
		validated_by INTEGER,
		validated_at TIMESTAMP,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		link_id TEXT,
		FOREIGN KEY (provider_id) REFERENCES providers(id),
		FOREIGN KEY (validated_by) REFERENCES users(id)
	);`

	providerPhoneTable := `
	CREATE TABLE IF NOT EXISTS provider_phones (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		provider_id INTEGER NOT NULL,
		phone TEXT NOT NULL,
		is_correct BOOLEAN,
		corrected_phone TEXT,
		validated_by INTEGER,
		validated_at TIMESTAMP,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		link_id TEXT,
		FOREIGN KEY (provider_id) REFERENCES providers(id),
		FOREIGN KEY (validated_by) REFERENCES users(id)
	);`

	validationSessionTable := `
	CREATE TABLE IF NOT EXISTS validation_sessions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		provider_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		call_attempt_1 TIMESTAMP,
		call_attempt_2 TIMESTAMP,
		closed_date TIMESTAMP,
		status TEXT DEFAULT 'in_progress',
		locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (provider_id) REFERENCES providers(id),
		FOREIGN KEY (user_id) REFERENCES users(id)
	);`

	flaggedPhonesTable := `
	CREATE TABLE IF NOT EXISTS flagged_phones (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		phone TEXT UNIQUE NOT NULL,
		flagged_count INTEGER DEFAULT 1,
		flagged_by INTEGER NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (flagged_by) REFERENCES users(id)
	);`

	tables := []string{userTable, providerTable, providerAddressTable, providerPhoneTable, validationSessionTable, flaggedPhonesTable}
	
	for _, table := range tables {
		if _, err := DB.Exec(table); err != nil {
			return err
		}
	}

	// Create indexes for link_id columns
	linkIdIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_provider_addresses_link_id ON provider_addresses(link_id);`,
		`CREATE INDEX IF NOT EXISTS idx_provider_phones_link_id ON provider_phones(link_id);`,
	}
	
	for _, index := range linkIdIndexes {
		if _, err := DB.Exec(index); err != nil {
			return err
		}
	}

	return nil
}