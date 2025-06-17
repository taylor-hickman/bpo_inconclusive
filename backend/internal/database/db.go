package database

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool

type Config struct {
	DatabaseURL     string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

func LoadConfig() *Config {
	config := &Config{
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://bpo_user:bpo_secure_password_2024@localhost:5432/bpo_validation?sslmode=disable"),
		MaxOpenConns:    getEnvAsInt("DB_MAX_OPEN_CONNS", 25),
		MaxIdleConns:    getEnvAsInt("DB_MAX_IDLE_CONNS", 10),
		ConnMaxLifetime: getEnvAsDuration("DB_CONN_MAX_LIFETIME", 5*time.Minute),
	}
	return config
}

func InitDB(config *Config) error {
	poolConfig, err := pgxpool.ParseConfig(config.DatabaseURL)
	if err != nil {
		return fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Configure connection pool
	poolConfig.MaxConns = int32(config.MaxOpenConns)
	poolConfig.MinConns = int32(config.MaxIdleConns)
	poolConfig.MaxConnLifetime = config.ConnMaxLifetime
	poolConfig.MaxConnIdleTime = 30 * time.Minute

	// Configure connection settings for better performance
	poolConfig.ConnConfig.RuntimeParams = map[string]string{
		"application_name": "bpo-validation-backend",
		"timezone":        "UTC",
	}

	// Create connection pool
	DB, err = pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		return fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test the connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := DB.Ping(ctx); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	return nil
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}

// Helper functions for environment variables
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

// Transaction helper functions
func WithTx(ctx context.Context, fn func(pgx.Tx) error) error {
	tx, err := DB.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if err := fn(tx); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// Query helper functions
func QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	return DB.QueryRow(ctx, sql, args...)
}

func Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	return DB.Query(ctx, sql, args...)
}

func Exec(ctx context.Context, sql string, args ...interface{}) error {
	_, err := DB.Exec(ctx, sql, args...)
	return err
}