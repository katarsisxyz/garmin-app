package httpx

import (
	"fmt"
	"testing"

	"garmin-app/internal/accounts"

	gc "github.com/katarsisxyz/garminconnect-go"
)

func TestClassify(t *testing.T) {
	cases := []struct {
		err    error
		status int
		code   string
	}{
		{&gc.Error{Kind: gc.ErrNotFound}, 404, "not_found"}, // also matches ErrConnection
		{&gc.Error{Kind: gc.ErrConnection}, 502, "garmin_unavailable"},
		{&gc.Error{Kind: gc.ErrAuthentication}, 401, "garmin_reauth_required"},
		{&gc.Error{Kind: gc.ErrTooManyRequests}, 429, "garmin_rate_limited"},
		{&gc.Error{Kind: gc.ErrInvalidArgument}, 400, "invalid_argument"},
		{fmt.Errorf("wrap: %w", accounts.ErrNotConnected), 409, "account_not_connected"},
		{BadRequest("x"), 400, "invalid_argument"},
		{fmt.Errorf("boom"), 500, "internal_error"},
	}
	for _, tc := range cases {
		status, code, _ := classify(tc.err)
		if status != tc.status || code != tc.code {
			t.Errorf("%v: got %d %s, want %d %s", tc.err, status, code, tc.status, tc.code)
		}
	}
}
