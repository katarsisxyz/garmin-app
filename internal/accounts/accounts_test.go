package accounts

import (
	"bytes"
	"errors"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func TestTokenRoundTrip(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	a, err := New(db, bytes.Repeat([]byte{7}, 32), logrus.New())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := a.load("u1"); !errors.Is(err, ErrNotConnected) {
		t.Fatalf("want ErrNotConnected, got %v", err)
	}
	for _, tok := range []string{`{"v":1}`, `{"v":2}`} { // second save must upsert
		if err := a.save("u1", tok); err != nil {
			t.Fatal(err)
		}
	}
	var row GarminAccount
	db.First(&row, "account_id = ?", "u1")
	if bytes.Contains(row.Tokens, []byte(`"v"`)) {
		t.Fatal("tokens stored in plaintext")
	}
	if got, err := a.load("u1"); err != nil || got != `{"v":2}` {
		t.Fatalf("got %q, %v", got, err)
	}
	if err := a.Disconnect("u1"); err != nil {
		t.Fatal(err)
	}
	if _, err := a.load("u1"); !errors.Is(err, ErrNotConnected) {
		t.Fatalf("want ErrNotConnected after disconnect, got %v", err)
	}
}
