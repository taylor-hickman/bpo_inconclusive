# BPO Provider Validation System

A production-ready, multi-user web application for validating healthcare provider data through phone calls. Built with Go (backend) and Next.js (frontend) with comprehensive authentication, session management, and real-time statistics.

## 🚀 Features

### Core Functionality
- **Multi-user Support**: Secure authentication with JWT tokens
- **Record Locking**: Prevents multiple users from working on the same record
- **Provider Validation**: Update address and phone status with correction capabilities
- **Global Phone Flagging**: Flag phones globally to avoid duplicate calls
- **Additional Addresses**: Add new addresses discovered during calls
- **Real-time Statistics**: Track progress and completion metrics
- **Call Attempt Tracking**: Business day validation with 2-attempt limit

### User Interface
- **Responsive Design**: Mobile-friendly interface with hamburger navigation
- **Dark/Light Theme**: System-aware theme switching
- **Real-time Dashboard**: Live statistics and progress tracking
- **Validation Workflow**: Streamlined address and phone validation process
- **Progress Saving**: Auto-save validation progress

## 🛠 Tech Stack

### Backend (Go)
- **Framework**: Go 1.23+ with net/http
- **Database**: SQLite with optimized schema
- **Authentication**: JWT tokens with bcrypt password hashing
- **Architecture**: Clean architecture with separate layers

### Frontend (Next.js)
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI primitives
- **State Management**: Zustand
- **Theme**: next-themes support

## 📋 Prerequisites

- Go 1.23+
- Node.js 18+
- SQLite

## 🚀 Quick Start

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Load sample data (optional)
go run cmd/loader_v2/main.go ../bpo_inconclusive_provider_data_sample.csv

# Run database migrations
go run cmd/migrate/main.go

# Start the API server
go run cmd/api/main.go
```

Backend will start on `http://localhost:8080`

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Start development server
npm run dev
```

Frontend will start on `http://localhost:3000`

### 3. First Use

1. Register a new account at `http://localhost:3000/register`
2. Login with your credentials
3. Navigate to the Validation page
4. Click "Grab Next Provider" to start validating

## 🗄 Database Schema

### Core Tables

- **providers**: Healthcare provider information (NPI, name, specialty)
- **provider_addresses**: Address data with validation status and corrections
- **provider_phones**: Phone data with validation status and corrections
- **validation_sessions**: User validation sessions with locking mechanism
- **flagged_phones**: Globally flagged phone numbers
- **users**: User accounts with authentication

### Key Features

- **Link ID System**: Maintains address-phone relationships from original CSV data
- **Session Locking**: 30-minute auto-expiry prevents conflicts
- **Audit Trail**: Tracks who validated what and when

## 🔧 Available Commands

### Backend Commands

| Command | Purpose |
|---------|---------|
| `go run cmd/api/main.go` | Start API server |
| `go run cmd/loader_v2/main.go <csv>` | Import provider data |
| `go run cmd/migrate/main.go` | Run database migrations |
| `go run cmd/reset/main.go` | Reset validation data |
| `go run cmd/clear_sessions/main.go` | Clear stale sessions |
| `go run cmd/dev/debug/main.go` | Debug database statistics |

### Frontend Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info

### Provider Validation Endpoints (Protected)
- `GET /api/providers/next` - Get next provider to validate
- `GET /api/providers/stats` - Get validation statistics
- `PUT /api/sessions/{id}/validate` - Submit validation updates
- `POST /api/sessions/{id}/call-attempt` - Record call attempt
- `POST /api/sessions/{id}/complete` - Complete validation session

## 🎯 Usage Workflow

1. **Authentication**: Register or login to access the system
2. **Dashboard**: View statistics and progress metrics
3. **Grab Provider**: Get assigned next unvalidated provider
4. **Validate Data**: 
   - Verify address information (Yes/No/Inconclusive)
   - Verify phone information (Yes/No/Inconclusive)
   - Make corrections as needed
   - Record call attempts (max 2 on business days)
5. **Submit**: Save progress or complete validation
6. **Repeat**: System automatically assigns next provider

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Security**: Bcrypt hashing with salt
- **SQL Injection Protection**: Parameterized queries
- **Session Management**: Automatic timeout and cleanup
- **CORS Configuration**: Proper cross-origin setup

## 📊 Performance Optimizations

- **Database Indexing**: Optimized queries for large datasets
- **Connection Pooling**: Efficient database connections
- **Session Locking**: Prevents race conditions
- **Efficient Data Loading**: Minimizes N+1 query problems

## 🧪 Testing & Development

### Backend Testing
```bash
# Test database connection
go run cmd/dev/test_db/main.go

# Test API endpoints
go run cmd/dev/test_api/main.go

# Test validation logic
go run cmd/dev/test_validation/main.go
```

### Development Tools
- Debug utilities in `cmd/dev/`
- Database statistics and health checks
- User management tools
- Data loading and migration tools

## 📁 Project Structure

```
├── backend/                 # Go API server
│   ├── cmd/                # Command-line tools
│   │   ├── api/           # Main API server
│   │   ├── loader_v2/     # Data import tool
│   │   ├── migrate/       # Database migrations
│   │   └── dev/          # Development tools
│   ├── internal/          # Internal packages
│   │   ├── auth/         # Authentication logic
│   │   ├── database/     # Database layer
│   │   ├── handlers/     # HTTP handlers
│   │   ├── models/       # Data models
│   │   └── providers/    # Business logic
│   ├── migrations/        # SQL migration files
│   └── scripts/          # Development SQL scripts
├── frontend/              # Next.js application
│   ├── app/              # App Router pages
│   ├── components/       # React components
│   └── lib/             # Utilities and stores
└── bpo_inconclusive_provider_data_sample.csv  # Sample data
```