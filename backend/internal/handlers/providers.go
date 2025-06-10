package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/user/auth-app/internal/models"
	"github.com/user/auth-app/internal/providers"
)

func GetNextProvider(w http.ResponseWriter, r *http.Request) {
	userIDValue := r.Context().Value("user_id")
	if userIDValue == nil {
		log.Printf("GetNextProvider: user_id not found in context")
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}
	
	userID, ok := userIDValue.(int)
	if !ok {
		log.Printf("GetNextProvider: user_id is not an int: %T", userIDValue)
		http.Error(w, "Invalid user context", http.StatusInternalServerError)
		return
	}

	providerData, err := providers.GetNextProvider(userID)
	if err != nil {
		if err == providers.ErrNoProvidersAvailable {
			http.Error(w, "No providers available for validation", http.StatusNotFound)
			return
		}
		log.Printf("GetNextProvider: Failed to get provider for user %d: %v", userID, err)
		http.Error(w, "Failed to get provider", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(providerData)
}

func UpdateValidation(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(int)
	vars := mux.Vars(r)
	sessionID, err := strconv.Atoi(vars["sessionId"])
	if err != nil {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	var req models.ValidationUpdate
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = providers.UpdateValidation(sessionID, userID, req)
	if err != nil {
		if err == providers.ErrSessionLocked {
			http.Error(w, "Session is locked by another user", http.StatusConflict)
			return
		}
		http.Error(w, "Failed to update validation", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func RecordCallAttempt(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(int)
	vars := mux.Vars(r)
	sessionID, err := strconv.Atoi(vars["sessionId"])
	if err != nil {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	var req models.CallAttemptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = providers.RecordCallAttempt(sessionID, userID, req.AttemptNumber)
	if err != nil {
		if err == providers.ErrSessionLocked {
			http.Error(w, "Session is locked by another user", http.StatusConflict)
			return
		}
		if err == providers.ErrInvalidCallAttempt {
			http.Error(w, "Invalid call attempt", http.StatusBadRequest)
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func CompleteValidation(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(int)
	vars := mux.Vars(r)
	sessionID, err := strconv.Atoi(vars["sessionId"])
	if err != nil {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	err = providers.CompleteValidation(sessionID, userID)
	if err != nil {
		if err == providers.ErrSessionLocked {
			http.Error(w, "Session is locked by another user", http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func GetProviderStats(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(int)

	stats, err := providers.GetStats(userID)
	if err != nil {
		http.Error(w, "Failed to get stats", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}