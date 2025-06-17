package database

import (
	"context"
	"fmt"
	"log"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func RunMigrations(databaseURL string, migrationsPath string) error {
	log.Printf("Running migrations from %s", migrationsPath)
	
	m, err := migrate.New(
		fmt.Sprintf("file://%s", migrationsPath),
		databaseURL,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}
	defer m.Close()

	err = m.Up()
	if err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	if err == migrate.ErrNoChange {
		log.Println("No new migrations to apply")
	} else {
		log.Println("Migrations applied successfully")
	}

	return nil
}

func RollbackMigrations(databaseURL string, migrationsPath string, steps int) error {
	log.Printf("Rolling back %d migration steps", steps)
	
	m, err := migrate.New(
		fmt.Sprintf("file://%s", migrationsPath),
		databaseURL,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}
	defer m.Close()

	err = m.Steps(-steps)
	if err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to rollback migrations: %w", err)
	}

	log.Printf("Successfully rolled back %d migration steps", steps)
	return nil
}

func MigrationStatus(databaseURL string, migrationsPath string) error {
	m, err := migrate.New(
		fmt.Sprintf("file://%s", migrationsPath),
		databaseURL,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}
	defer m.Close()

	version, dirty, err := m.Version()
	if err != nil {
		return fmt.Errorf("failed to get migration version: %w", err)
	}

	log.Printf("Current migration version: %d, dirty: %t", version, dirty)
	return nil
}

// Health check functions
func HealthCheck(ctx context.Context) error {
	if DB == nil {
		return fmt.Errorf("database connection not initialized")
	}

	if err := DB.Ping(ctx); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	// Check if we can query the users table (basic connectivity test)
	var count int
	err := DB.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to query users table: %w", err)
	}

	return nil
}

func GetDatabaseStats(ctx context.Context) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Connection pool stats
	poolStats := DB.Stat()
	stats["pool"] = map[string]interface{}{
		"total_conns":        poolStats.TotalConns(),
		"acquired_conns":     poolStats.AcquiredConns(),
		"idle_conns":         poolStats.IdleConns(),
		"constructing_conns": poolStats.ConstructingConns(),
	}

	// Database activity stats
	var dbStats struct {
		NumBackends   int
		ActiveQueries int
		IdleQueries   int
	}

	err := DB.QueryRow(ctx, `
		SELECT 
			count(*) as num_backends,
			count(*) FILTER (WHERE state = 'active') as active_queries,
			count(*) FILTER (WHERE state = 'idle') as idle_queries
		FROM pg_stat_activity 
		WHERE datname = current_database()
	`).Scan(&dbStats.NumBackends, &dbStats.ActiveQueries, &dbStats.IdleQueries)
	
	if err != nil {
		return nil, fmt.Errorf("failed to get database stats: %w", err)
	}

	stats["activity"] = dbStats

	// Table sizes
	var tableSizes []map[string]interface{}
	rows, err := DB.Query(ctx, `
		SELECT 
			schemaname,
			tablename,
			pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
			pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
		FROM pg_tables 
		WHERE schemaname = 'public'
		ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to get table sizes: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var schema, table, size string
		var sizeBytes int64
		if err := rows.Scan(&schema, &table, &size, &sizeBytes); err != nil {
			continue
		}
		tableSizes = append(tableSizes, map[string]interface{}{
			"schema":     schema,
			"table":      table,
			"size":       size,
			"size_bytes": sizeBytes,
		})
	}

	stats["table_sizes"] = tableSizes

	return stats, nil
}