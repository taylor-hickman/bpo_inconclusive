#!/bin/sh

# BPO Provider Validation - Startup Script
# This script initializes PostgreSQL database and loads sample data if needed

set -e

echo "Starting BPO Provider Validation backend..."

# Set default values for PostgreSQL
DATABASE_URL="${DATABASE_URL:-postgres://bpo_user:bpo_secure_password_2024@postgres:5432/bpo_validation?sslmode=disable}"
CSV_PATH="${CSV_PATH:-/root/data/bpo_inconclusive_provider_data_sample.csv}"
SKIP_DATA_LOAD="${SKIP_DATA_LOAD:-false}"

echo "Database URL: $DATABASE_URL"
echo "CSV data path: $CSV_PATH"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h postgres -p 5432 -U bpo_user > /dev/null 2>&1; do
    echo "PostgreSQL is not ready yet, waiting..."
    sleep 2
done
echo "PostgreSQL is ready!"

# Migrations will be run automatically by the main application

# Check if data loading should be skipped
if [ "$SKIP_DATA_LOAD" = "true" ]; then
    echo "Skipping data load as SKIP_DATA_LOAD is set to true"
else
    # Load CSV data using the loader
    if [ -f "$CSV_PATH" ]; then
        echo "Loading initial data from $CSV_PATH..."
        ./loader "$CSV_PATH"
        echo "Data loading completed"
    else
        echo "Warning: CSV file not found at $CSV_PATH"
        echo "Skipping data load..."
    fi
fi

echo "Database initialization complete"
echo "Starting main application..."

# Start the main application
exec ./main