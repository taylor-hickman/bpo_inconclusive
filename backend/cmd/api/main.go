package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"github.com/user/auth-app/internal/database"
	"github.com/user/auth-app/internal/handlers"
)

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "../../auth.db"
	}
	
	if err := database.InitDB(dbPath); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	r := mux.NewRouter()

	// Health check endpoint
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}).Methods("GET")

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

	corsOrigins := os.Getenv("CORS_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "http://localhost:3000,http://localhost:3001"
	}
	
	origins := strings.Split(corsOrigins, ",")
	for i, origin := range origins {
		origins[i] = strings.TrimSpace(origin)
	}
	
	c := cors.New(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s...", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
