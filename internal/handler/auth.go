package handler

import (
	"strings"
	"time"

	"garmin-app/internal/accounts"
	"garmin-app/internal/httpx"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

const mfaCookie = "mfa_pending"

// RegisterAuth mounts the browser login routes. They set an HttpOnly session
// cookie instead of using the API key.
func (h *Handler) RegisterAuth(r fiber.Router) {
	// Password logins from one IP get the server blocked by Garmin's Cloudflare; slow them down here first.
	limit := limiter.New(limiter.Config{
		Max: 5, Expiration: time.Minute,
		LimitReached: func(c *fiber.Ctx) error {
			return &httpx.Error{Status: fiber.StatusTooManyRequests, Code: "rate_limited", Message: "too many login attempts; wait a minute"}
		},
	})
	r.Post("/login", limit, h.webLogin)
	r.Post("/mfa", limit, h.webMFA)
	r.Post("/logout", h.webLogout)
}

func (h *Handler) webLogin(c *fiber.Ctx) error {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := parseBody(c, &body); err != nil {
		return err
	}
	if body.Email == "" || body.Password == "" {
		return httpx.BadRequest("email and password are required")
	}
	needsMFA, key, id, err := h.Accounts.ConnectWeb(c.UserContext(), body.Email, body.Password)
	if err != nil {
		return err
	}
	if needsMFA {
		httpx.SetCookie(c, mfaCookie, key, 10*time.Minute)
		return c.JSON(fiber.Map{"mfa_required": true})
	}
	if err := httpx.SetSession(c, h.Secret, id); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"mfa_required": false})
}

func (h *Handler) webMFA(c *fiber.Ctx) error {
	var body struct {
		Code string `json:"code"`
	}
	if err := parseBody(c, &body); err != nil {
		return err
	}
	if body.Code == "" {
		return httpx.BadRequest("code is required")
	}
	key := c.Cookies(mfaCookie)
	if !strings.HasPrefix(key, "web:") { // never let the cookie name an API-flow login
		return accounts.ErrNoPendingMFA
	}
	id, err := h.Accounts.FinishMFA(c.UserContext(), key, body.Code)
	if err != nil {
		return err
	}
	httpx.SetCookie(c, mfaCookie, "", -1)
	if err := httpx.SetSession(c, h.Secret, id); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"connected": true})
}

// webLogout ends the browser session; the Garmin tokens stay so the next login is token-only on the server.
func (h *Handler) webLogout(c *fiber.Ctx) error {
	httpx.ClearSession(c)
	return c.SendStatus(fiber.StatusNoContent)
}
