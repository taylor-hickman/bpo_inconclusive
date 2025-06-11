package main

import (
	"fmt"
	"log"

	"github.com/user/auth-app/internal/database"
)

func main() {
	// Initialize database
	if err := database.InitDB("../../../auth.db"); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	fmt.Println("=== Users in Database ===")
	
	rows, err := database.DB.Query("SELECT id, email, created_at FROM users")
	if err != nil {
		log.Fatal("Failed to query users:", err)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id int
		var email, createdAt string
		err := rows.Scan(&id, &email, &createdAt)
		if err != nil {
			log.Fatal("Failed to scan row:", err)
		}
		fmt.Printf("User %d: %s (created: %s)\n", id, email, createdAt)
		count++
	}
	
	fmt.Printf("\nTotal users: %d\n", count)
}