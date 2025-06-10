package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/user/auth-app/internal/auth"
	"github.com/user/auth-app/internal/models"
)

func Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, "Email and password are required", http.StatusBadRequest)
		return
	}

	user, err := auth.RegisterUser(req.Email, req.Password)
	if err != nil {
		http.Error(w, "Failed to register user", http.StatusInternalServerError)
		return
	}

	token, err := auth.GenerateJWT(user.ID)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	response := models.AuthResponse{
		Token: token,
		User:  *user,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, "Email and password are required", http.StatusBadRequest)
		return
	}

	user, token, err := auth.LoginUser(req.Email, req.Password)
	if err != nil {
		if err.Error() == "invalid credentials" {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		http.Error(w, "Failed to login", http.StatusInternalServerError)
		return
	}

	response := models.AuthResponse{
		Token: token,
		User:  *user,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func GetUser(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(int)
	
	user, err := auth.GetUserByID(userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}