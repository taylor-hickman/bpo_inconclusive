package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/user/auth-app/internal/database"
	"github.com/user/auth-app/internal/models"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret = []byte("your-secret-key-change-in-production")

func RegisterUser(email, password string) (*models.User, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	var user models.User
	
	query := `
		INSERT INTO users (uuid, email, password, is_active) 
		VALUES ($1, $2, $3, true) 
		RETURNING id, uuid, email, is_active, created_at, updated_at
	`
	
	err = database.QueryRow(ctx, query, uuid.New(), email, string(hashedPassword)).Scan(
		&user.ID, &user.UUID, &user.Email, &user.IsActive, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return &user, nil
}

func LoginUser(email, password string) (*models.User, string, error) {
	ctx := context.Background()
	var user models.User
	
	query := `
		SELECT id, uuid, email, password, first_name, last_name, is_active,
		       last_login_at, metadata, created_at, updated_at, created_by, updated_by
		FROM users 
		WHERE email = $1 AND is_active = true
	`
	
	err := database.QueryRow(ctx, query, email).Scan(
		&user.ID, &user.UUID, &user.Email, &user.Password,
		&user.FirstName, &user.LastName, &user.IsActive,
		&user.LastLoginAt, &user.Metadata, &user.CreatedAt, &user.UpdatedAt,
		&user.CreatedBy, &user.UpdatedBy,
	)
	
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, "", errors.New("invalid credentials")
		}
		return nil, "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, "", errors.New("invalid credentials")
	}

	// Update last login time
	_, err = database.DB.Exec(ctx, `
		UPDATE users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $1
	`, user.ID)
	if err != nil {
		// Log the error but don't fail the login
		fmt.Printf("Failed to update last login time for user %d: %v\n", user.ID, err)
	}

	token, err := GenerateJWT(user.ID)
	if err != nil {
		return nil, "", err
	}

	user.Password = ""
	return &user, token, nil
}

func GenerateJWT(userID int) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

func ValidateJWT(tokenString string) (int, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jwtSecret, nil
	})

	if err != nil {
		return 0, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		userIDValue, exists := claims["user_id"]
		if !exists {
			return 0, errors.New("user_id not found in token")
		}
		
		userIDFloat, ok := userIDValue.(float64)
		if !ok {
			return 0, fmt.Errorf("user_id is not a number: %T", userIDValue)
		}
		
		return int(userIDFloat), nil
	}

	return 0, errors.New("invalid token")
}

func GetUserByID(userID int) (*models.User, error) {
	ctx := context.Background()
	var user models.User
	
	query := `
		SELECT id, uuid, email, first_name, last_name, is_active,
		       last_login_at, metadata, created_at, updated_at, created_by, updated_by
		FROM users 
		WHERE id = $1 AND is_active = true
	`
	
	err := database.QueryRow(ctx, query, userID).Scan(
		&user.ID, &user.UUID, &user.Email, &user.FirstName, &user.LastName,
		&user.IsActive, &user.LastLoginAt, &user.Metadata,
		&user.CreatedAt, &user.UpdatedAt, &user.CreatedBy, &user.UpdatedBy,
	)
	
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	
	return &user, nil
}