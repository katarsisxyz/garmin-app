// Package handler maps HTTP routes to garminconnect-go methods.
package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"garmin-app/internal/accounts"
	"garmin-app/internal/httpx"

	"github.com/gofiber/fiber/v2"
	gc "github.com/katarsisxyz/garminconnect-go"
)

type Handler struct {
	Accounts *accounts.Accounts
}

type (
	dateFn  = func(*gc.Garmin, context.Context, string) (json.RawMessage, error)
	rangeFn = func(*gc.Garmin, context.Context, string, string) (json.RawMessage, error)
	plainFn = func(*gc.Garmin, context.Context) (json.RawMessage, error)
	idFn    = func(*gc.Garmin, context.Context, int64) (json.RawMessage, error)
)

// Register mounts every account route on r (already behind the API key).
func (h *Handler) Register(r fiber.Router) {
	a := r.Group("/accounts/:accountId")

	a.Post("/connect", h.connect)
	a.Post("/connect/mfa", h.connectMFA)
	a.Get("/status", h.status)
	a.Delete("/", h.disconnect)

	a.Get("/profile", h.plain((*gc.Garmin).GetUserProfile))
	a.Get("/profile/settings", h.plain((*gc.Garmin).GetUserprofileSettings))
	a.Get("/devices", h.plain((*gc.Garmin).GetDevices))
	a.Get("/devices/last-used", h.plain((*gc.Garmin).GetDeviceLastUsed))
	a.Get("/devices/:id/settings", h.byID((*gc.Garmin).GetDeviceSettings))
	a.Get("/gear", h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		return g.GetGear(ctx, g.ProfileID)
	}))
	a.Get("/gear/:uuid/stats", h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		return g.GetGearStats(ctx, c.Params("uuid"))
	}))

	a.Get("/daily/summary", h.date((*gc.Garmin).GetUserSummary))
	a.Get("/daily/steps", h.date((*gc.Garmin).GetStepsData))
	a.Get("/daily/steps/range", h.dateRange((*gc.Garmin).GetDailySteps))
	a.Get("/daily/heart-rate", h.date((*gc.Garmin).GetHeartRates))
	a.Get("/daily/hrv", h.date((*gc.Garmin).GetHRVData))
	a.Get("/daily/stress", h.date((*gc.Garmin).GetStressData))
	a.Get("/daily/sleep", h.date((*gc.Garmin).GetSleepData))
	a.Get("/daily/body-battery", h.dateRange((*gc.Garmin).GetBodyBattery))
	a.Get("/daily/spo2", h.date((*gc.Garmin).GetSpo2Data))
	a.Get("/daily/respiration", h.date((*gc.Garmin).GetRespirationData))
	a.Get("/daily/hydration", h.date((*gc.Garmin).GetHydrationData))
	a.Post("/daily/hydration", h.raw(addHydration))
	a.Get("/daily/intensity-minutes", h.date((*gc.Garmin).GetIntensityMinutesData))

	a.Get("/body/composition", h.dateRange((*gc.Garmin).GetBodyComposition))
	a.Get("/body/weigh-ins", h.dateRange((*gc.Garmin).GetWeighIns))
	a.Post("/body/weigh-ins", h.raw(addWeighIn))
	a.Delete("/body/weigh-ins/:pk", h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		pk, err := paramID(c, "pk")
		if err != nil {
			return nil, err
		}
		return g.DeleteWeighIn(ctx, pk, c.Query("date"))
	}))
	a.Get("/body/blood-pressure", h.dateRange((*gc.Garmin).GetBloodPressure))
	a.Post("/body/blood-pressure", h.raw(addBloodPressure))

	a.Get("/performance/training-readiness", h.date((*gc.Garmin).GetTrainingReadiness))
	a.Get("/performance/training-status", h.date((*gc.Garmin).GetTrainingStatus))
	a.Get("/performance/max-metrics", h.date((*gc.Garmin).GetMaxMetrics))
	a.Get("/performance/endurance-score", h.dateRange((*gc.Garmin).GetEnduranceScore))
	a.Get("/performance/race-predictions", h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		return g.GetRacePredictions(ctx, c.Query("start"), c.Query("end"), c.Query("type"))
	}))
	a.Get("/performance/hr-zones", h.plain((*gc.Garmin).GetHeartRateZones))
	a.Get("/performance/personal-records", h.plain((*gc.Garmin).GetPersonalRecord))
	a.Get("/training-plans", h.plain((*gc.Garmin).GetTrainingPlans))

	a.Get("/activities", h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		return g.GetActivities(ctx, c.QueryInt("start", 0), c.QueryInt("limit", 20), c.Query("type"), "")
	}))
	a.Get("/activities/by-date", h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		return g.GetActivitiesByDate(ctx, c.Query("start"), c.Query("end"), c.Query("type"), "")
	}))
	a.Post("/activities/upload", h.raw(uploadActivity))
	a.Get("/activities/:id", h.byID((*gc.Garmin).GetActivity))
	a.Get("/activities/:id/details", h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		id, err := paramID(c, "id")
		if err != nil {
			return nil, err
		}
		return g.GetActivityDetails(ctx, id, c.QueryInt("max_chart", 2000), c.QueryInt("max_poly", 4000))
	}))
	a.Get("/activities/:id/splits", h.byID((*gc.Garmin).GetActivitySplits))
	a.Get("/activities/:id/hr-zones", h.byID((*gc.Garmin).GetActivityHRInTimezones))
	a.Get("/activities/:id/weather", h.byID((*gc.Garmin).GetActivityWeather))
	a.Get("/activities/:id/download", h.downloadActivity)
	a.Patch("/activities/:id", h.raw(patchActivity))
	a.Delete("/activities/:id", h.byID((*gc.Garmin).DeleteActivity))

	a.Get("/workouts", h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		return g.GetWorkouts(ctx, c.QueryInt("start", 0), c.QueryInt("limit", 20))
	}))
	a.Post("/workouts", h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		return g.UploadWorkout(ctx, json.RawMessage(c.Body()))
	}))
	a.Get("/workouts/:id", h.byID((*gc.Garmin).GetWorkoutByID))
	a.Delete("/workouts/:id", h.byID((*gc.Garmin).DeleteWorkout))
	a.Post("/workouts/:id/schedule", h.raw(scheduleWorkout))
	a.Post("/workouts/:id/push", h.raw(pushWorkout))

	a.Get("/raw", h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		path := c.Query("path")
		if !strings.HasPrefix(path, "/") {
			return nil, httpx.BadRequest("path must start with /")
		}
		params := url.Values{}
		for k, v := range c.Queries() {
			if k != "path" {
				params.Set(k, v)
			}
		}
		return g.ConnectAPI(ctx, path, params)
	}))
}

// raw resolves the account's client, calls fn and forwards Garmin's JSON as is.
func (h *Handler) raw(fn func(context.Context, *gc.Garmin, *fiber.Ctx) (json.RawMessage, error)) fiber.Handler {
	return func(c *fiber.Ctx) error {
		g, err := h.client(c)
		if err != nil {
			return err
		}
		out, err := fn(c.UserContext(), g, c)
		if err != nil {
			return h.garminErr(c, err)
		}
		if len(out) == 0 {
			return c.SendStatus(fiber.StatusNoContent)
		}
		c.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
		return c.Send(out)
	}
}

func (h *Handler) date(fn dateFn) fiber.Handler {
	return h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		return fn(g, ctx, c.Query("date", time.Now().Format(time.DateOnly)))
	})
}

func (h *Handler) dateRange(fn rangeFn) fiber.Handler {
	return h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		return fn(g, ctx, c.Query("start"), c.Query("end"))
	})
}

func (h *Handler) plain(fn plainFn) fiber.Handler {
	return h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		return fn(g, ctx)
	})
}

func (h *Handler) byID(fn idFn) fiber.Handler {
	return h.raw(func(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
		id, err := paramID(c, "id")
		if err != nil {
			return nil, err
		}
		return fn(g, ctx, id)
	})
}

func (h *Handler) client(c *fiber.Ctx) (*gc.Garmin, error) {
	g, err := h.Accounts.Get(c.UserContext(), c.Params("accountId"))
	if err != nil {
		return nil, h.garminErr(c, err)
	}
	return g, nil
}

// garminErr drops the cached client when Garmin rejects its tokens, so the
// next request (after a reconnect) starts fresh.
func (h *Handler) garminErr(c *fiber.Ctx, err error) error {
	if errors.Is(err, gc.ErrAuthentication) {
		h.Accounts.Forget(c.Params("accountId"))
	}
	return err
}

func paramID(c *fiber.Ctx, name string) (int64, error) {
	id, err := strconv.ParseInt(c.Params(name), 10, 64)
	if err != nil || id <= 0 {
		return 0, httpx.BadRequest(name + " must be a positive integer")
	}
	return id, nil
}

func parseBody(c *fiber.Ctx, v any) error {
	if err := json.Unmarshal(c.Body(), v); err != nil {
		return httpx.BadRequest("invalid JSON body: " + err.Error())
	}
	return nil
}

// --- account connection ---

func (h *Handler) connect(c *fiber.Ctx) error {
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
	needsMFA, err := h.Accounts.Connect(c.UserContext(), c.Params("accountId"), body.Email, body.Password)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"connected": !needsMFA, "mfa_required": needsMFA})
}

func (h *Handler) connectMFA(c *fiber.Ctx) error {
	var body struct {
		Code string `json:"code"`
	}
	if err := parseBody(c, &body); err != nil {
		return err
	}
	if body.Code == "" {
		return httpx.BadRequest("code is required")
	}
	if err := h.Accounts.FinishMFA(c.UserContext(), c.Params("accountId"), body.Code); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"connected": true})
}

func (h *Handler) status(c *fiber.Ctx) error {
	g, err := h.client(c)
	if errors.Is(err, accounts.ErrNotConnected) {
		return c.JSON(fiber.Map{"connected": false})
	}
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"connected": true, "display_name": g.DisplayName, "full_name": g.FullName})
}

func (h *Handler) disconnect(c *fiber.Ctx) error {
	if err := h.Accounts.Disconnect(c.Params("accountId")); err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// --- writes ---

func addHydration(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
	var body struct {
		ValueML float64 `json:"value_ml"`
		Date    string  `json:"date"`
	}
	if err := parseBody(c, &body); err != nil {
		return nil, err
	}
	return g.AddHydrationData(ctx, body.ValueML, time.Time{}, body.Date)
}

func addWeighIn(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
	var body struct {
		Weight    float64   `json:"weight"`
		Unit      string    `json:"unit"`
		Timestamp time.Time `json:"timestamp"`
	}
	if err := parseBody(c, &body); err != nil {
		return nil, err
	}
	if body.Unit == "" {
		body.Unit = "kg"
	}
	return g.AddWeighIn(ctx, body.Weight, body.Unit, body.Timestamp)
}

func addBloodPressure(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
	var body struct {
		Systolic  int       `json:"systolic"`
		Diastolic int       `json:"diastolic"`
		Pulse     int       `json:"pulse"`
		Timestamp time.Time `json:"timestamp"`
		Notes     string    `json:"notes"`
	}
	if err := parseBody(c, &body); err != nil {
		return nil, err
	}
	return g.SetBloodPressure(ctx, body.Systolic, body.Diastolic, body.Pulse, body.Timestamp, body.Notes)
}

func patchActivity(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
	id, err := paramID(c, "id")
	if err != nil {
		return nil, err
	}
	var body struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
	}
	if err := parseBody(c, &body); err != nil {
		return nil, err
	}
	if body.Name == nil && body.Description == nil {
		return nil, httpx.BadRequest("name or description is required")
	}
	if body.Name != nil {
		if _, err := g.SetActivityName(ctx, id, *body.Name); err != nil {
			return nil, err
		}
	}
	if body.Description != nil {
		if _, err := g.SetActivityDescription(ctx, id, *body.Description); err != nil {
			return nil, err
		}
	}
	return g.GetActivity(ctx, id)
}

// uploadActivity spools the multipart "file" to a temp file, since the library uploads from a path.
func uploadActivity(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
	fh, err := c.FormFile("file")
	if err != nil {
		return nil, httpx.BadRequest("multipart field \"file\" is required")
	}
	dir, err := os.MkdirTemp("", "garmin-upload-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, filepath.Base(fh.Filename))
	if err := c.SaveFile(fh, path); err != nil {
		return nil, err
	}
	return g.UploadActivity(ctx, path)
}

var downloadFormats = map[string]struct {
	format gc.ActivityDownloadFormat
	ext    string
	mime   string
}{
	"original": {gc.FormatOriginal, "zip", "application/zip"},
	"tcx":      {gc.FormatTCX, "tcx", "application/vnd.garmin.tcx+xml"},
	"gpx":      {gc.FormatGPX, "gpx", "application/gpx+xml"},
	"kml":      {gc.FormatKML, "kml", "application/vnd.google-earth.kml+xml"},
	"csv":      {gc.FormatCSV, "csv", "text/csv"},
}

func (h *Handler) downloadActivity(c *fiber.Ctx) error {
	f, ok := downloadFormats[c.Query("format", "original")]
	if !ok {
		return httpx.BadRequest("format must be one of original, tcx, gpx, kml, csv")
	}
	id, err := paramID(c, "id")
	if err != nil {
		return err
	}
	g, err := h.client(c)
	if err != nil {
		return err
	}
	data, err := g.DownloadActivity(c.UserContext(), id, f.format)
	if err != nil {
		return h.garminErr(c, err)
	}
	c.Set(fiber.HeaderContentType, f.mime)
	c.Attachment("activity_" + c.Params("id") + "." + f.ext)
	return c.Send(data)
}

func scheduleWorkout(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
	id, err := paramID(c, "id")
	if err != nil {
		return nil, err
	}
	var body struct {
		Date string `json:"date"`
	}
	if err := parseBody(c, &body); err != nil {
		return nil, err
	}
	return g.ScheduleWorkout(ctx, id, body.Date)
}

func pushWorkout(ctx context.Context, g *gc.Garmin, c *fiber.Ctx) (json.RawMessage, error) {
	id, err := paramID(c, "id")
	if err != nil {
		return nil, err
	}
	var body struct {
		DeviceID int64 `json:"device_id"`
	}
	if err := parseBody(c, &body); err != nil {
		return nil, err
	}
	return g.PushWorkoutToDevice(ctx, id, body.DeviceID)
}
