package handler

import (
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"garmin-app/internal/httpx"

	"github.com/gofiber/fiber/v2"
)

func TestAccountAccess(t *testing.T) {
	secret := []byte(strings.Repeat("s", 32))
	h := &Handler{Secret: secret}
	app := fiber.New(fiber.Config{ErrorHandler: httpx.ErrorHandler})
	app.Get("/login/:id", func(c *fiber.Ctx) error { return httpx.SetSession(c, secret, c.Params("id")) })
	app.Get("/api/:accountId", httpx.Auth("key", secret), func(c *fiber.Ctx) error {
		id, err := h.accountID(c)
		if err != nil {
			return err
		}
		return c.SendString(id)
	})

	resp, _ := app.Test(httptest.NewRequest("GET", "/login/42", nil))
	session := strings.Split(resp.Header.Get("Set-Cookie"), ";")[0]
	forged := "session=" + strings.Repeat("x", 20)

	cases := []struct {
		path, key, cookie string
		status            int
		body              string
	}{
		{"/api/u1", "", "", 401, ""},
		{"/api/u1", "wrong", "", 401, ""},
		{"/api/u1", "key", "", 200, "u1"},
		{"/api/me", "key", "", 400, ""},
		{"/api/me", "", session, 200, "42"},
		{"/api/42", "", session, 200, "42"},
		{"/api/43", "", session, 403, ""},
		{"/api/me", "", forged, 401, ""},
	}
	for _, tc := range cases {
		req := httptest.NewRequest("GET", tc.path, nil)
		if tc.key != "" {
			req.Header.Set("X-API-Key", tc.key)
		}
		if tc.cookie != "" {
			req.Header.Set("Cookie", tc.cookie)
		}
		resp, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != tc.status || (tc.body != "" && string(body) != tc.body) {
			t.Errorf("%s key=%q cookie=%v: got %d %s", tc.path, tc.key, tc.cookie != "", resp.StatusCode, body)
		}
	}
}
