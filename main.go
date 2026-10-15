package main

import (
	"context"
	"encoding/hex"
	"errors"
	"io/fs"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"garmin-app/internal/accounts"
	"garmin-app/internal/handler"
	"garmin-app/internal/httpx"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

const requestTimeout = 30 * time.Second

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	log := logrus.New()
	log.SetFormatter(&logrus.JSONFormatter{})
	// .env is optional and never overrides variables already set in the environment.
	if err := godotenv.Load(); err != nil && !errors.Is(err, fs.ErrNotExist) {
		log.WithError(err).Fatal("load .env")
	}
	level, err := logrus.ParseLevel(env("LOG_LEVEL", "info"))
	if err != nil {
		log.WithError(err).Fatal("invalid LOG_LEVEL")
	}
	log.SetLevel(level)

	// The library falls back to $GARMINTOKENS on an empty tokenstore, which
	// would hand one account's tokens to another.
	os.Unsetenv("GARMINTOKENS")

	apiKey := os.Getenv("API_KEY")
	if apiKey == "" {
		log.Fatal("API_KEY is required")
	}
	encKey, err := hex.DecodeString(os.Getenv("TOKEN_ENC_KEY"))
	if err != nil || len(encKey) != 32 {
		log.Fatal("TOKEN_ENC_KEY must be 64 hex characters (openssl rand -hex 32)")
	}

	dbPath := env("DB_PATH", "data/garmin.db")
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o700); err != nil {
		log.WithError(err).Fatal("create db dir")
	}
	gormLevel := gormlogger.Silent
	if level >= logrus.DebugLevel {
		gormLevel = gormlogger.Info
	}
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: gormlogger.New(log, gormlogger.Config{LogLevel: gormLevel, SlowThreshold: time.Second}),
	})
	if err != nil {
		log.WithError(err).Fatal("open database")
	}
	accts, err := accounts.New(db, encKey, log)
	if err != nil {
		log.WithError(err).Fatal("init accounts")
	}

	// LOG_LEVEL=debug shows Fiber's startup banner and route table.
	debug := level >= logrus.DebugLevel
	app := fiber.New(fiber.Config{ErrorHandler: httpx.ErrorHandler, DisableStartupMessage: !debug, EnablePrintRoutes: debug})
	app.Use(requestid.New(), httpx.Logger(log), recover.New(), func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(context.Background(), requestTimeout)
		defer cancel()
		c.SetUserContext(ctx)
		return c.Next()
	})
	app.Get("/healthz", func(c *fiber.Ctx) error { return c.JSON(fiber.Map{"status": "ok"}) })
	(&handler.Handler{Accounts: accts}).Register(app.Group("/api/v1", httpx.APIKey(apiKey)))

	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		log.Info("shutting down")
		_ = app.ShutdownWithTimeout(10 * time.Second)
	}()

	addr := ":" + env("PORT", "8080")
	log.WithField("addr", addr).Info("listening")
	if err := app.Listen(addr); err != nil {
		log.WithError(err).Fatal("listen")
	}
}
