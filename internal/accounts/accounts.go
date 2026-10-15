// Package accounts keeps one Garmin client per account and stores each
// account's tokens encrypted in SQLite.
package accounts

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"fmt"
	"sync"
	"time"

	gc "github.com/katarsisxyz/garminconnect-go"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrNotConnected = errors.New("garmin account not connected")
	ErrNoPendingMFA = errors.New("no pending garmin login; connect again")
)

const mfaTTL = 10 * time.Minute

// GarminAccount is one connected account; Tokens is AES-GCM encrypted token JSON.
type GarminAccount struct {
	AccountID string `gorm:"primaryKey"`
	Tokens    []byte `gorm:"not null"`
	UpdatedAt time.Time
}

type pendingLogin struct {
	g       *gc.Garmin
	expires time.Time
}

type Accounts struct {
	db   *gorm.DB
	aead cipher.AEAD
	log  *logrus.Logger

	mu      sync.Mutex
	clients map[string]*gc.Garmin
	pending map[string]pendingLogin
}

// New migrates the schema and returns the account registry. key must be 32 bytes.
func New(db *gorm.DB, key []byte, log *logrus.Logger) (*Accounts, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("token key: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if err := db.AutoMigrate(&GarminAccount{}); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return &Accounts{db: db, aead: aead, log: log, clients: map[string]*gc.Garmin{}, pending: map[string]pendingLogin{}}, nil
}

// Get returns the client for a connected account, logging in from stored tokens on first use.
func (a *Accounts) Get(ctx context.Context, id string) (*gc.Garmin, error) {
	// ponytail: one lock across the token login, so a cold account briefly blocks others; per-account locks if that hurts.
	a.mu.Lock()
	defer a.mu.Unlock()
	if g, ok := a.clients[id]; ok {
		return g, nil
	}
	tokens, err := a.load(id)
	if err != nil {
		return nil, err
	}
	g := a.newClient(id, "", "")
	if _, err := g.Login(ctx, tokens); err != nil {
		return nil, err
	}
	a.clients[id] = g
	return g, nil
}

// Connect logs in with email and password. needsMFA means FinishMFA must follow within 10 minutes.
func (a *Accounts) Connect(ctx context.Context, id, email, password string) (needsMFA bool, err error) {
	g := a.newClient(id, email, password, gc.WithReturnOnMFA())
	if needsMFA, err = g.Login(ctx, ""); err != nil {
		return false, err
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if needsMFA {
		a.pending[id] = pendingLogin{g, time.Now().Add(mfaTTL)}
		return true, nil
	}
	a.clients[id] = g
	return false, nil
}

// FinishMFA completes a pending login. A wrong code can be retried.
func (a *Accounts) FinishMFA(ctx context.Context, id, code string) error {
	a.mu.Lock()
	p, ok := a.pending[id]
	a.mu.Unlock()
	if !ok || time.Now().After(p.expires) {
		return ErrNoPendingMFA
	}
	if err := p.g.ResumeLogin(ctx, code); err != nil {
		return err
	}
	a.mu.Lock()
	delete(a.pending, id)
	a.clients[id] = p.g
	a.mu.Unlock()
	return nil
}

// Forget drops the cached client, e.g. after Garmin rejected its tokens.
func (a *Accounts) Forget(id string) {
	a.mu.Lock()
	delete(a.clients, id)
	a.mu.Unlock()
}

// Disconnect drops the client and deletes the stored tokens.
func (a *Accounts) Disconnect(id string) error {
	a.mu.Lock()
	delete(a.clients, id)
	delete(a.pending, id)
	a.mu.Unlock()
	return a.db.Delete(&GarminAccount{AccountID: id}).Error
}

func (a *Accounts) newClient(id, email, password string, opts ...gc.Option) *gc.Garmin {
	saver := gc.WithTokenSaver(func(tokens string) {
		if err := a.save(id, tokens); err != nil {
			a.log.WithError(err).WithField("account_id", id).Error("save garmin tokens")
		}
	})
	return gc.New(email, password, append(opts, saver)...)
}

func (a *Accounts) save(id, tokens string) error {
	nonce := make([]byte, a.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return err
	}
	row := GarminAccount{AccountID: id, Tokens: a.aead.Seal(nonce, nonce, []byte(tokens), nil)}
	return a.db.Clauses(clause.OnConflict{UpdateAll: true}).Create(&row).Error
}

func (a *Accounts) load(id string) (string, error) {
	var row GarminAccount
	err := a.db.First(&row, "account_id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", ErrNotConnected
	}
	if err != nil {
		return "", err
	}
	n := a.aead.NonceSize()
	if len(row.Tokens) < n {
		return "", errors.New("stored tokens are corrupt")
	}
	plain, err := a.aead.Open(nil, row.Tokens[:n], row.Tokens[n:], nil)
	if err != nil {
		return "", fmt.Errorf("decrypt tokens: %w", err)
	}
	return string(plain), nil
}
