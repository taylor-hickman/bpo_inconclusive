package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/user/auth-app/internal/database"
)

func main() {
	var action = flag.String("action", "up", "Migration action: up, down, status")
	var steps = flag.Int("steps", 0, "Number of migration steps for rollback")
	flag.Parse()

	// Load database configuration
	config := database.LoadConfig()
	
	// Initialize PostgreSQL connection pool
	if err := database.InitDB(config); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer database.Close()

	// Set migrations path
	migrationsPath := "/app/migrations/postgres"
	if _, err := os.Stat(migrationsPath); os.IsNotExist(err) {
		migrationsPath = "../../migrations/postgres"
	}

	switch *action {
	case "up":
		fmt.Println("Applying migrations...")
		if err := database.RunMigrations(config.DatabaseURL, migrationsPath); err != nil {
			log.Fatal("Failed to apply migrations:", err)
		}
		fmt.Println("Migrations applied successfully!")
		
	case "down":
		if *steps <= 0 {
			log.Fatal("Please specify the number of steps to rollback using -steps flag")
		}
		fmt.Printf("Rolling back %d migration steps...\n", *steps)
		if err := database.RollbackMigrations(config.DatabaseURL, migrationsPath, *steps); err != nil {
			log.Fatal("Failed to rollback migrations:", err)
		}
		fmt.Printf("Successfully rolled back %d migration steps!\n", *steps)
		
	case "status":
		fmt.Println("Getting migration status...")
		if err := database.MigrationStatus(config.DatabaseURL, migrationsPath); err != nil {
			log.Fatal("Failed to get migration status:", err)
		}
		
	default:
		fmt.Printf("Unknown action: %s\n", *action)
		fmt.Println("Available actions: up, down, status")
		os.Exit(1)
	}
}