// Package accounts keeps one Garmin client per account and stores each
// account's tokens encrypted in SQLite.
package accounts

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
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
	sink    *sink
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
	g := a.newClient(&sink{id: id}, "", "")
	if _, err := g.Login(ctx, tokens); err != nil {
		return nil, err
	}
	a.clients[id] = g
	return g, nil
}

// Connect logs in with email and password under a caller-chosen id. needsMFA
// means FinishMFA(id, code) must follow within 10 minutes.
func (a *Accounts) Connect(ctx context.Context, id, email, password string) (needsMFA bool, err error) {
	needsMFA, _, err = a.login(ctx, id, id, email, password)
	return needsMFA, err
}

// ConnectWeb logs in without an id: the account id becomes the Garmin
// profile id. With MFA it returns the key to pass to FinishMFA.
func (a *Accounts) ConnectWeb(ctx context.Context, email, password string) (needsMFA bool, pendingKey, accountID string, err error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return false, "", "", err
	}
	pendingKey = "web:" + hex.EncodeToString(b)
	needsMFA, accountID, err = a.login(ctx, pendingKey, "", email, password)
	return needsMFA, pendingKey, accountID, err
}

// FinishMFA completes the login pending under key and returns its account id.
// A wrong code can be retried.
func (a *Accounts) FinishMFA(ctx context.Context, key, code string) (string, error) {
	a.mu.Lock()
	p, ok := a.pending[key]
	a.mu.Unlock()
	if !ok || time.Now().After(p.expires) {
		return "", ErrNoPendingMFA
	}
	if err := p.g.ResumeLogin(ctx, code); err != nil {
		return "", err
	}
	a.mu.Lock()
	delete(a.pending, key)
	a.mu.Unlock()
	return a.finish(p.g, p.sink)
}

// login runs a password login. An empty id is taken from the Garmin profile once logged in.
func (a *Accounts) login(ctx context.Context, key, id, email, password string) (bool, string, error) {
	s := &sink{id: id}
	g := a.newClient(s, email, password, gc.WithReturnOnMFA())
	needsMFA, err := g.Login(ctx, "")
	if err != nil {
		return false, "", err
	}
	if needsMFA {
		a.mu.Lock()
		a.pending[key] = pendingLogin{g, s, time.Now().Add(mfaTTL)}
		a.mu.Unlock()
		return true, "", nil
	}
	id, err = a.finish(g, s)
	return false, id, err
}

// finish names the account (if needed), stores its tokens and caches the client.
func (a *Accounts) finish(g *gc.Garmin, s *sink) (string, error) {
	id := s.get()
	if id == "" {
		switch {
		case g.ProfileID != 0:
			id = strconv.FormatInt(g.ProfileID, 10)
		case g.DisplayName != "":
			id = g.DisplayName
		default:
			return "", errors.New("garmin profile has no id")
		}
		s.set(id)
	}
	if err := a.save(id, g.Client.Dumps()); err != nil {
		return "", err
	}
	a.mu.Lock()
	a.clients[id] = g
	a.mu.Unlock()
	return id, nil
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

// sink holds the account id token saves go to; empty until a web login knows it.
type sink struct {
	mu sync.Mutex
	id string
}

func (s *sink) get() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.id
}

func (s *sink) set(id string) {
	s.mu.Lock()
	s.id = id
	s.mu.Unlock()
}

func (a *Accounts) newClient(s *sink, email, password string, opts ...gc.Option) *gc.Garmin {
	saver := gc.WithTokenSaver(func(tokens string) {
		id := s.get()
		if id == "" {
			return // finish() saves them once the id is known
		}
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
