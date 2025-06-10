package auth

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
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

	query := `INSERT INTO users (email, password) VALUES (?, ?)`
	result, err := database.DB.Exec(query, email, string(hashedPassword))
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	user := &models.User{
		ID:        int(id),
		Email:     email,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	return user, nil
}

func LoginUser(email, password string) (*models.User, string, error) {
	var user models.User
	query := `SELECT id, email, password, created_at, updated_at FROM users WHERE email = ?`
	
	err := database.DB.QueryRow(query, email).Scan(
		&user.ID, &user.Email, &user.Password, &user.CreatedAt, &user.UpdatedAt,
	)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, "", errors.New("invalid credentials")
		}
		return nil, "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, "", errors.New("invalid credentials")
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
	var user models.User
	query := `SELECT id, email, created_at, updated_at FROM users WHERE id = ?`
	
	err := database.DB.QueryRow(query, userID).Scan(
		&user.ID, &user.Email, &user.CreatedAt, &user.UpdatedAt,
	)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	
	return &user, nil
}