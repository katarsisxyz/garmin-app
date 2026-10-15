// Package httpx holds the Fiber middleware and the error-to-HTTP mapping.
package httpx

import (
	"crypto/subtle"
	"errors"
	"net/http"
	"time"

	"garmin-app/internal/accounts"

	"github.com/gofiber/fiber/v2"
	gc "github.com/katarsisxyz/garminconnect-go"
	"github.com/sirupsen/logrus"
)

// Error is an error the handler already knows the HTTP answer for.
type Error struct {
	Status  int
	Code    string
	Message string
}

func (e *Error) Error() string { return e.Message }

func BadRequest(msg string) error {
	return &Error{http.StatusBadRequest, "invalid_argument", msg}
}

// classify maps an error to status, code and the message safe to show clients.
// ErrNotFound must come before ErrConnection: a not-found also matches it.
func classify(err error) (int, string, string) {
	var he *Error
	var fe *fiber.Error
	switch {
	case errors.As(err, &he):
		return he.Status, he.Code, he.Message
	case errors.As(err, &fe):
		code := "invalid_argument"
		switch {
		case fe.Code == http.StatusNotFound:
			code = "not_found"
		case fe.Code >= 500:
			code = "internal_error"
		}
		// fasthttp parse errors echo the raw request (headers included), so never forward fe.Message.
		return fe.Code, code, http.StatusText(fe.Code)
	case errors.Is(err, accounts.ErrNotConnected):
		return http.StatusConflict, "account_not_connected", "garmin account not connected"
	case errors.Is(err, accounts.ErrNoPendingMFA):
		return http.StatusConflict, "mfa_not_pending", "no pending garmin login; connect again"
	case errors.Is(err, gc.ErrInvalidArgument):
		return http.StatusBadRequest, "invalid_argument", err.Error()
	case errors.Is(err, gc.ErrInvalidFileFormat):
		return http.StatusBadRequest, "invalid_file_format", "file must be FIT, GPX or TCX"
	case errors.Is(err, gc.ErrAuthentication):
		return http.StatusUnauthorized, "garmin_reauth_required", "garmin rejected the credentials; connect the account again"
	case errors.Is(err, gc.ErrNotFound):
		return http.StatusNotFound, "not_found", "not found"
	case errors.Is(err, gc.ErrTooManyRequests):
		return http.StatusTooManyRequests, "garmin_rate_limited", "too many requests to garmin; try again later"
	case errors.Is(err, gc.ErrConnection):
		return http.StatusBadGateway, "garmin_unavailable", "garmin is unavailable"
	}
	return http.StatusInternalServerError, "internal_error", "internal error"
}

// ErrorHandler writes {"error": {...}} and keeps the full error for the request log.
func ErrorHandler(c *fiber.Ctx, err error) error {
	status, code, msg := classify(err)
	c.Locals("error", err.Error())
	return c.Status(status).JSON(fiber.Map{"error": fiber.Map{
		"code": code, "message": msg, "request_id": c.Locals("requestid"),
	}})
}

// Logger writes one JSON log line per request. It renders errors itself so the
// logged status is the one the client gets.
func Logger(log *logrus.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		if err := c.Next(); err != nil {
			if herr := c.App().Config().ErrorHandler(c, err); herr != nil {
				return herr
			}
		}
		status := c.Response().StatusCode()
		entry := log.WithFields(logrus.Fields{
			"request_id": c.Locals("requestid"),
			"method":     c.Method(),
			"path":       c.Path(),
			"status":     status,
			"latency_ms": time.Since(start).Milliseconds(),
		})
		if id := c.Params("accountId"); id != "" {
			entry = entry.WithField("account_id", id)
		}
		if e, ok := c.Locals("error").(string); ok {
			entry = entry.WithField("error", e)
		}
		switch {
		case status >= 500:
			entry.Error("request")
		case status >= 400:
			entry.Warn("request")
		default:
			entry.Info("request")
		}
		return nil
	}
}

// APIKey rejects requests whose X-API-Key header does not match key.
func APIKey(key string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if subtle.ConstantTimeCompare([]byte(c.Get("X-API-Key")), []byte(key)) != 1 {
			return &Error{http.StatusUnauthorized, "unauthorized", "missing or invalid API key"}
		}
		return c.Next()
	}
}
