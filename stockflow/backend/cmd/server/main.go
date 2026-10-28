package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/lib/pq"

	"stockflow/backend/internal/config"
	"stockflow/backend/internal/handler"
	"stockflow/backend/internal/repository"
	"stockflow/backend/internal/service"
)

func main() {
	cfg := config.LoadConfig()

	log.Printf("[SERVER INIT] Menghubungkan ke basis data PostgreSQL...")
	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("[FATAL] Gagal menginisialisasi driver database: %v", err)
	}
	defer db.Close()

	// Konfigurasi connection pooling standar enterprise
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Ping database dengan timeout
	ctxPing, cancelPing := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelPing()
	if err := db.PingContext(ctxPing); err != nil {
		log.Printf("[WARNING] Ping ke database gagal: %v (Pastikan PostgreSQL berjalan)", err)
	} else {
		log.Printf("[SERVER INIT] Berhasil terhubung ke database PostgreSQL")
	}

	// Dependency Injection: Repository -> Service -> Handler
	productRepo := repository.NewPostgresProductRepository(db)
	orderRepo := repository.NewPostgresOrderRepository(db)

	productService := service.NewProductService(productRepo)
	orderService := service.NewOrderService(orderRepo)

	productHandler := handler.NewProductHandler(productService)
	orderHandler := handler.NewOrderHandler(orderService)

	// Router net/http Go 1.22+ dengan pattern matching terstandarisasi
	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","service":"stockflow-backend"}`))
	})

	// Products & Stock Movements Endpoints
	mux.HandleFunc("GET /api/products", productHandler.GetProducts)
	mux.HandleFunc("POST /api/products", productHandler.CreateProduct)
	mux.HandleFunc("PUT /api/products/{id}", productHandler.UpdateProduct)
	mux.HandleFunc("DELETE /api/products/{id}", productHandler.DeleteProduct)
	mux.HandleFunc("POST /api/products/{id}/stock", productHandler.AdjustStock)
	mux.HandleFunc("GET /api/products/{id}/movements", productHandler.GetMovements)

	// Sales Orders Endpoints
	mux.HandleFunc("POST /api/orders", orderHandler.CreateOrder)
	mux.HandleFunc("GET /api/orders/{id}", orderHandler.GetOrderByID)
	mux.HandleFunc("POST /api/orders/{id}/cancel", orderHandler.CancelOrder)

	// Bonus: Reports Endpoint
	mux.HandleFunc("GET /api/reports/daily-sales", orderHandler.GetDailySalesReport)

	// Pasang Chain Middleware: Recovery -> Logging -> CORS
	wrappedMux := handler.RecoverMiddleware(handler.LoggingMiddleware(handler.CORSMiddleware(mux)))

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      wrappedMux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Jalankan server di goroutine terpisah
	go func() {
		log.Printf("[SERVER RUNNING] StockFlow REST API mendengarkan di http://localhost:%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] Server HTTP berhenti tak terduga: %v", err)
		}
	}()

	// Graceful shutdown listener
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)
	<-stopChan

	log.Printf("[SERVER SHUTDOWN] Menerima sinyal terminasi, mematikan server secara graceful...")
	ctxShutdown, cancelShutdown := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelShutdown()

	if err := server.Shutdown(ctxShutdown); err != nil {
		log.Printf("[ERROR] Kesalahan saat shutdown server: %v", err)
	}
	log.Printf("[SERVER SHUTDOWN] Server berhasil dimatikan dengan aman.")
}
