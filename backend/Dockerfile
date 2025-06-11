# Multi-stage build for Go backend
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache gcc musl-dev sqlite-dev

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the applications
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/api
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o loader ./cmd/loader

# Final stage
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates sqlite

WORKDIR /root/

# Copy the binaries from builder stage
COPY --from=builder /app/main .
COPY --from=builder /app/loader .

# Copy startup script
COPY --from=builder /app/scripts/startup.sh .
RUN chmod +x startup.sh

# Copy CSV data
COPY --from=builder /app/bpo_inconclusive_provider_data_sample.csv ./data/

# Create directory for database
RUN mkdir -p /data

# Expose port
EXPOSE 8080

# Set environment variables
ENV DB_PATH=/data/auth.db
ENV PORT=8080
ENV CSV_PATH=/root/data/bpo_inconclusive_provider_data_sample.csv

# Run the startup script
CMD ["./startup.sh"]