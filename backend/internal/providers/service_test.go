package providers

import (
	"testing"

	"github.com/user/auth-app/internal/database"
	"github.com/user/auth-app/internal/models"
)

func TestMain(m *testing.M) {
	// Initialize test database
	if err := database.InitDB(":memory:"); err != nil {
		panic("Failed to initialize test database: " + err.Error())
	}
	
	// Apply link_id migration
	migrations := []string{
		"ALTER TABLE provider_addresses ADD COLUMN link_id TEXT",
		"ALTER TABLE provider_phones ADD COLUMN link_id TEXT",
	}
	
	for _, migration := range migrations {
		if _, err := database.DB.Exec(migration); err != nil {
			// Ignore errors, column might exist
		}
	}
	
	// Run tests
	m.Run()
}

func setupTestData(t *testing.T) (providerID int, userID int) {
	// Create test user with unique email
	result, err := database.DB.Exec(`
		INSERT INTO users (email, password) VALUES (?, ?)
	`, t.Name()+"@example.com", "hashed_password")
	if err != nil {
		t.Fatal("Failed to create test user:", err)
	}
	uid, _ := result.LastInsertId()
	userID = int(uid)

	// Create test provider with unique NPI
	npi := "123456" + t.Name()
	result, err = database.DB.Exec(`
		INSERT INTO providers (npi, gnpi, provider_name, specialty, provider_group)
		VALUES (?, ?, ?, ?, ?)
	`, npi, "0987654321", "Dr. Test Provider", "Cardiology", "Test Group")
	if err != nil {
		t.Fatal("Failed to create test provider:", err)
	}
	pid, _ := result.LastInsertId()
	providerID = int(pid)

	// Create addresses with link_ids
	addresses := []struct {
		category string
		address1 string
		city     string
		state    string
		zip      string
		linkID   string
	}{
		{"Primary", "123 Main St", "Anytown", "CA", "12345", "test-1"},
		{"Secondary", "456 Oak Ave", "Othertown", "CA", "67890", "test-2"},
		{"Billing", "789 Pine Rd", "Somewhere", "CA", "11111", "test-3"},
	}

	for _, addr := range addresses {
		_, err = database.DB.Exec(`
			INSERT INTO provider_addresses 
			(provider_id, address_category, address1, city, state, zip, link_id)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, providerID, addr.category, addr.address1, addr.city, addr.state, addr.zip, addr.linkID)
		if err != nil {
			t.Fatal("Failed to create test address:", err)
		}
	}

	// Create phones with matching link_ids
	phones := []struct {
		phone  string
		linkID string
	}{
		{"5551234567", "test-1"},
		{"5559876543", "test-2"},
		// Note: test-3 has no phone (testing addresses without phones)
	}

	for _, phone := range phones {
		_, err = database.DB.Exec(`
			INSERT INTO provider_phones 
			(provider_id, phone, link_id)
			VALUES (?, ?, ?)
		`, providerID, phone.phone, phone.linkID)
		if err != nil {
			t.Fatal("Failed to create test phone:", err)
		}
	}

	return providerID, userID
}

func TestGetNextProvider(t *testing.T) {
	providerID, userID := setupTestData(t)

	// Test getting next provider
	data, err := GetNextProvider(userID)
	if err != nil {
		t.Fatal("GetNextProvider failed:", err)
	}

	// Verify provider data
	if data.Provider.ID != providerID {
		t.Errorf("Expected provider ID %d, got %d", providerID, data.Provider.ID)
	}

	// Verify we have 3 addresses
	if len(data.Addresses) != 3 {
		t.Errorf("Expected 3 addresses, got %d", len(data.Addresses))
	}

	// Verify we have 2 phones
	if len(data.Phones) != 2 {
		t.Errorf("Expected 2 phones, got %d", len(data.Phones))
	}

	// Verify address-phone records are properly paired
	if len(data.AddressPhoneRecords) != 3 {
		t.Errorf("Expected 3 address-phone records, got %d", len(data.AddressPhoneRecords))
	}

	// Check specific pairings
	foundPrimary := false
	foundSecondary := false
	foundBilling := false

	for _, record := range data.AddressPhoneRecords {
		switch record.Address.AddressCategory {
		case "Primary":
			foundPrimary = true
			if record.Phone.Phone != "5551234567" {
				t.Errorf("Primary address paired with wrong phone: %s", record.Phone.Phone)
			}
		case "Secondary":
			foundSecondary = true
			if record.Phone.Phone != "5559876543" {
				t.Errorf("Secondary address paired with wrong phone: %s", record.Phone.Phone)
			}
		case "Billing":
			foundBilling = true
			if record.Phone.Phone != "" {
				t.Errorf("Billing address should have no phone, got: %s", record.Phone.Phone)
			}
		}
	}

	if !foundPrimary || !foundSecondary || !foundBilling {
		t.Error("Not all address categories were found in records")
	}

	// Verify validation session was created
	if data.ValidationSession == nil {
		t.Fatal("No validation session created")
	}
	if data.ValidationSession.Status != "in_progress" {
		t.Errorf("Expected session status 'in_progress', got %s", data.ValidationSession.Status)
	}
}

func TestUpdateValidation(t *testing.T) {
	providerID, userID := setupTestData(t)

	// First get a provider to create a session
	data, err := GetNextProvider(userID)
	if err != nil {
		t.Fatal("Failed to get provider:", err)
	}

	sessionID := data.ValidationSession.ID

	// Find the address and phone IDs from the returned data
	var primaryAddressID, primaryPhoneID int
	for _, record := range data.AddressPhoneRecords {
		if record.Address.AddressCategory == "Primary" {
			primaryAddressID = record.Address.ID
			primaryPhoneID = record.Phone.ID
			break
		}
	}

	// Test validation update
	update := models.ValidationUpdate{
		AddressValidations: []models.AddressValidation{
			{
				AddressID: primaryAddressID,
				IsCorrect: false,
				CorrectedAddress1: "123 New Main St",
				CorrectedCity: "Newtown",
			},
		},
		PhoneValidations: []models.PhoneValidation{
			{
				PhoneID: primaryPhoneID,
				IsCorrect: true,
			},
		},
	}

	err = UpdateValidation(sessionID, userID, update)
	if err != nil {
		t.Fatal("UpdateValidation failed:", err)
	}

	// Verify the updates were applied correctly
	var addr models.ProviderAddress
	err = database.DB.QueryRow(`
		SELECT is_correct, corrected_address1, corrected_city, validated_by
		FROM provider_addresses WHERE id = ?
	`, primaryAddressID).Scan(
		&addr.IsCorrect.NullBool,
		&addr.CorrectedAddress1.NullString,
		&addr.CorrectedCity.NullString,
		&addr.ValidatedBy.NullInt64,
	)
	if err != nil {
		t.Fatal("Failed to query updated address:", err)
	}

	if addr.IsCorrect.Bool != false {
		t.Error("Address should be marked as incorrect")
	}
	if addr.CorrectedAddress1.String != "123 New Main St" {
		t.Errorf("Expected corrected address '123 New Main St', got '%s'", addr.CorrectedAddress1.String)
	}
	if addr.CorrectedCity.String != "Newtown" {
		t.Errorf("Expected corrected city 'Newtown', got '%s'", addr.CorrectedCity.String)
	}
	if int(addr.ValidatedBy.Int64) != userID {
		t.Errorf("Expected validated_by to be %d, got %d", userID, addr.ValidatedBy.Int64)
	}

	// Verify phone update
	var phone models.ProviderPhone
	err = database.DB.QueryRow(`
		SELECT is_correct, validated_by
		FROM provider_phones WHERE id = ?
	`, primaryPhoneID).Scan(
		&phone.IsCorrect.NullBool,
		&phone.ValidatedBy.NullInt64,
	)
	if err != nil {
		t.Fatal("Failed to query updated phone:", err)
	}

	if phone.IsCorrect.Bool != true {
		t.Error("Phone should be marked as correct")
	}
	if int(phone.ValidatedBy.Int64) != userID {
		t.Errorf("Expected validated_by to be %d, got %d", userID, phone.ValidatedBy.Int64)
	}

	// Verify other addresses/phones were NOT updated
	var otherAddrCount int
	database.DB.QueryRow(`
		SELECT COUNT(*) FROM provider_addresses 
		WHERE provider_id = ? AND id != ? AND validated_by IS NOT NULL
	`, providerID, primaryAddressID).Scan(&otherAddrCount)

	if otherAddrCount > 0 {
		t.Error("Other addresses were incorrectly updated")
	}
}

func TestAddNewAddress(t *testing.T) {
	providerID, userID := setupTestData(t)

	// Get provider and create session
	data, err := GetNextProvider(userID)
	if err != nil {
		t.Fatal("Failed to get provider:", err)
	}

	sessionID := data.ValidationSession.ID

	// Test adding new address
	update := models.ValidationUpdate{
		NewAddresses: []models.AddressInput{
			{
				AddressCategory: "Additional",
				Address1: "999 New Street",
				City: "Newville",
				State: "CA",
				Zip: "99999",
			},
		},
	}

	err = UpdateValidation(sessionID, userID, update)
	if err != nil {
		t.Fatal("Failed to add new address:", err)
	}

	// Verify new address was added
	var count int
	err = database.DB.QueryRow(`
		SELECT COUNT(*) FROM provider_addresses
		WHERE provider_id = ? AND address1 = '999 New Street'
	`, providerID).Scan(&count)
	if err != nil {
		t.Fatal("Failed to query new address:", err)
	}

	if count != 1 {
		t.Errorf("Expected 1 new address, found %d", count)
	}
}

func TestCompleteValidation(t *testing.T) {
	_, userID := setupTestData(t)

	// Get provider and create session
	data, err := GetNextProvider(userID)
	if err != nil {
		t.Fatal("Failed to get provider:", err)
	}

	sessionID := data.ValidationSession.ID

	// Mark all addresses and phones as validated
	update := models.ValidationUpdate{}
	
	for _, addr := range data.Addresses {
		update.AddressValidations = append(update.AddressValidations, models.AddressValidation{
			AddressID: addr.ID,
			IsCorrect: true,
		})
	}
	
	for _, phone := range data.Phones {
		update.PhoneValidations = append(update.PhoneValidations, models.PhoneValidation{
			PhoneID: phone.ID,
			IsCorrect: true,
		})
	}

	err = UpdateValidation(sessionID, userID, update)
	if err != nil {
		t.Fatal("Failed to update validations:", err)
	}

	// Record call attempt
	err = RecordCallAttempt(sessionID, userID, 1)
	if err != nil {
		t.Fatal("Failed to record call attempt:", err)
	}

	// Complete validation
	err = CompleteValidation(sessionID, userID)
	if err != nil {
		t.Fatal("Failed to complete validation:", err)
	}

	// Verify session is completed
	var status string
	var closedDate models.NullTime
	err = database.DB.QueryRow(`
		SELECT status, closed_date FROM validation_sessions WHERE id = ?
	`, sessionID).Scan(&status, &closedDate.NullTime)
	if err != nil {
		t.Fatal("Failed to query session:", err)
	}

	if status != "completed" {
		t.Errorf("Expected status 'completed', got '%s'", status)
	}
	if !closedDate.Valid {
		t.Error("Closed date should be set")
	}
}

func TestNoProvidersAvailable(t *testing.T) {
	// Create a user but no providers
	result, err := database.DB.Exec(`
		INSERT INTO users (email, password) VALUES (?, ?)
	`, "empty"+t.Name()+"@example.com", "hashed_password")
	if err != nil {
		t.Fatal("Failed to create test user:", err)
	}
	uid, _ := result.LastInsertId()
	userID := int(uid)

	// Test getting next provider when none available
	_, err = GetNextProvider(userID)
	if err != ErrNoProvidersAvailable {
		t.Errorf("Expected ErrNoProvidersAvailable, got %v", err)
	}
}