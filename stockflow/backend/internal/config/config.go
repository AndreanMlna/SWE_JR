package config

import (
	"os"
)

// Config menampung konfigurasi runtime aplikasi backend
type Config struct {
	Port        string
	DatabaseURL string
}

// LoadConfig memuat konfigurasi dari environment variables dengan nilai default yang aman
func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5433/stockflow?sslmode=disable"
	}

	return &Config{
		Port:        port,
		DatabaseURL: dbURL,
	}
}
