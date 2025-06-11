#!/bin/sh

# BPO Provider Validation - Startup Script
# This script initializes the database and loads sample data if needed

set -e

echo "Starting BPO Provider Validation backend..."

# Set default values
DB_PATH="${DB_PATH:-/data/auth.db}"
CSV_PATH="${CSV_PATH:-/app/data/bpo_inconclusive_provider_data_sample.csv}"
SKIP_DATA_LOAD="${SKIP_DATA_LOAD:-false}"

echo "Database path: $DB_PATH"
echo "CSV data path: $CSV_PATH"

# Create data directory if it doesn't exist
mkdir -p "$(dirname "$DB_PATH")"

# Check if database exists and has data
if [ -f "$DB_PATH" ]; then
    echo "Database exists, checking for provider data..."
    
    # Check if providers table exists and has data
    PROVIDER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM providers;" 2>/dev/null || echo "0")
    echo "Found $PROVIDER_COUNT providers in database"
    
    if [ "$PROVIDER_COUNT" -eq "0" ] && [ "$SKIP_DATA_LOAD" = "false" ]; then
        echo "No provider data found, loading from CSV..."
        if [ -f "$CSV_PATH" ]; then
            echo "Loading data from $CSV_PATH..."
            /app/loader "$CSV_PATH"
            echo "Data loading completed successfully"
        else
            echo "Warning: CSV file not found at $CSV_PATH"
            echo "Skipping data load..."
        fi
    else
        echo "Provider data already exists or data loading is disabled"
    fi
else
    echo "Database does not exist, it will be created by the application"
    
    # Start the main application and let it create the database
    echo "Starting main application to initialize database..."
    timeout 10 ./main &
    MAIN_PID=$!
    
    # Wait a moment for database to be created
    sleep 3
    
    # Stop the main app
    kill $MAIN_PID 2>/dev/null || true
    wait $MAIN_PID 2>/dev/null || true
    
    # Now load data if CSV exists and skip is not set
    if [ -f "$CSV_PATH" ] && [ "$SKIP_DATA_LOAD" = "false" ]; then
        echo "Loading initial data from $CSV_PATH..."
        ./loader "$CSV_PATH"
        echo "Initial data loading completed"
    fi
fi

echo "Database initialization complete"
echo "Starting main application..."

# Start the main application
exec ./main