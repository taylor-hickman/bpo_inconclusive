package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID          int                    `json:"id"`
	UUID        uuid.UUID              `json:"uuid"`
	Email       string                 `json:"email"`
	Password    string                 `json:"-"`
	FirstName   NullString             `json:"first_name"`
	LastName    NullString             `json:"last_name"`
	IsActive    bool                   `json:"is_active"`
	LastLoginAt NullTime               `json:"last_login_at"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	CreatedBy   NullInt64              `json:"created_by,omitempty"`
	UpdatedBy   NullInt64              `json:"updated_by,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}