package main

import (
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"github.com/user/auth-app/internal/database"
	"github.com/user/auth-app/internal/handlers"
)

func main() {
	if err := database.InitDB("../../auth.db"); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	r := mux.NewRouter()

	// Auth routes
	r.HandleFunc("/api/auth/register", handlers.Register).Methods("POST")
	r.HandleFunc("/api/auth/login",
		handlers.Login).Methods("POST")
	r.HandleFunc("/api/auth/me", handlers.AuthMiddleware(handlers.GetUser)).Methods("GET")

	// Provider routes (all require authentication)
	r.HandleFunc("/api/providers/next", handlers.AuthMiddleware(handlers.GetNextProvider)).Methods("GET")
	r.HandleFunc("/api/providers/stats", handlers.AuthMiddleware(handlers.GetProviderStats)).Methods("GET")
	r.HandleFunc("/api/sessions/{sessionId}/validate", handlers.AuthMiddleware(handlers.UpdateValidation)).Methods("PUT")
	r.HandleFunc("/api/sessions/{sessionId}/call-attempt", handlers.AuthMiddleware(handlers.RecordCallAttempt)).Methods("POST")
	r.HandleFunc("/api/sessions/{sessionId}/preview", handlers.AuthMiddleware(handlers.GetValidationPreview)).Methods("GET")
	r.HandleFunc("/api/sessions/{sessionId}/complete", handlers.AuthMiddleware(handlers.CompleteValidation)).Methods("POST")

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:3001"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(r)

	log.Println("Server starting on port 8080...")
	if err := http.ListenAndServe(":8080", handler); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
