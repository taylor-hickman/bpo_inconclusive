package main

import (
	"fmt"
	"log"

	"github.com/user/auth-app/internal/database"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// Initialize database
	if err := database.InitDB("../../../auth.db"); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Create test user
	email := "test@example.com"
	password := "password123"
	
	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal("Failed to hash password:", err)
	}

	// Insert user
	result, err := database.DB.Exec(`
		INSERT INTO users (email, password_hash) 
		VALUES (?, ?)
	`, email, string(hashedPassword))
	
	if err != nil {
		log.Fatal("Failed to insert user:", err)
	}

	id, _ := result.LastInsertId()
	fmt.Printf("Created test user:\n")
	fmt.Printf("ID: %d\n", id)
	fmt.Printf("Email: %s\n", email)
	fmt.Printf("Password: %s\n", password)
}