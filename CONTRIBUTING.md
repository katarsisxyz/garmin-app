# Contributing to Garmin Hub

**English** | [Bahasa Indonesia](CONTRIBUTING.id.md)

Thanks for helping out. Bug reports, fixes, new endpoints, and UI improvements are all welcome. This guide covers how to set up the project, what a good change looks like, and how to send it.

## Before you start

- For a bug, check the [existing issues](https://github.com/katarsisxyz/garmin-app/issues) first.
- For a new feature or a larger change, open an issue to discuss it before writing code. That saves you from building something that doesn't fit.
- Small fixes (typos, docs, an obvious bug) can go straight to a pull request.

## Setup

Requirements: Go 1.24+, Node.js 20+, `make`, and `openssl`.

```sh
git clone git@github.com:katarsisxyz/garmin-app.git
cd garmin-app
make setup   # dependencies, .env, secrets
make dev     # backend :8080, frontend :5173
```

See [README.md](README.md) for configuration and [docs/API.md](docs/API.md) for the endpoints.

### Testing against a real Garmin account

- Use your own account, never someone else's.
- Log in once and reuse the session. Garmin's Cloudflare blocks an IP after repeated password logins (`garmin_rate_limited`); token-based requests are not affected.
- Most UI work doesn't need a real account: the frontend only reads the JSON the API forwards, so you can serve sample data instead.

## Making a change

1. Fork the repo and create a branch from `main`: `git checkout -b fix/sleep-score-empty`.
2. Make your change, keeping it focused on one thing.
3. Run the checks:

   ```sh
   make test    # go vet, go test, frontend type check
   gofmt -l .   # should print nothing
   ```

4. Commit using [Conventional Commits](https://www.conventionalcommits.org/), like the existing history:

   ```
   feat: add VO2 max trend to the sleep page
   fix: sort weigh-ins by day when timestamps are missing
   docs: document the workouts/scheduled endpoint
   ```

5. Push and open a pull request against `main`.

## Code guidelines

### General

- Keep it simple. Prefer the standard library and existing helpers over new dependencies or abstractions. If you add a dependency, say why in the PR.
- Match the surrounding code: naming, comment style, file layout.
- Leave one runnable check for non-trivial logic (a branch, a parser, anything touching auth or money), even a small table test.

### Backend (Go)

- Format with `gofmt`; `go vet` must pass.
- Handlers forward Garmin's JSON as is. Don't add Go structs that remap Garmin fields unless the frontend can't work without them.
- Validate input at the boundary and return `httpx.BadRequest(...)` for bad input. Every other error goes through the existing error mapping in `internal/httpx`, so clients always get `{"error": {"code", "message", "request_id"}}`.
- Every account access goes through `h.accountID(c)` / `h.client(c)`, which enforce the session rules (`me`, no access to other accounts). Never read `c.Params("accountId")` directly.

### Adding an endpoint

1. Add the route in `internal/handler/handler.go`, reusing `h.date`, `h.dateRange`, `h.plain`, `h.byID`, or `h.raw`. A static path such as `/workouts/scheduled` must be registered before `/workouts/:id`.
2. Document it in [docs/API.md](docs/API.md) and the endpoint tables in [docs/PRD.md](docs/PRD.md).
3. Add a request to the Postman collection in [postman/](postman/).

### Frontend (React)

- TypeScript must type-check (`make test` does this).
- Use the shared pieces in `web/src/ui.tsx` (`Panel`, `Stat`, `Button`, `Field`, `ConfirmButton`, `toast`) and the formatters in `web/src/format.ts` instead of new one-offs.
- Colours come from the tokens in `web/src/index.css`. Colour marks the metric type (steps, heart, sleep, battery, stress) or an action; don't add decorative colours.
- Garmin's JSON isn't guaranteed. Read fields defensively (`a?.b ?? f.DASH`) so a missing field shows "–" instead of crashing the page.
- UI text is in Indonesian, in plain sentence case. Buttons say exactly what they do ("Simpan berat", not "Submit"), and errors explain what to do next.
- Check your change at both desktop width and 390 px mobile width.

## Security

- Never commit `.env`, tokens, passwords, cookies, or real account data. That includes screenshots and logs in issues.
- Never log passwords, MFA codes, Garmin tokens, the `X-API-Key` header, or session cookies.
- Found a vulnerability? Don't open a public issue. Contact the maintainer privately through the email on their GitHub profile.

## Reporting a bug

Include:

- What you did, what you expected, and what happened instead.
- The `request_id` from the error response or the server log. It lets the server-side error be found without sharing any credentials.
- Browser and OS for UI bugs, or the request (without credentials) for API bugs.
- For a field that shows "–" when it shouldn't: the relevant part of Garmin's JSON with personal values removed.

## Pull request checklist

- [ ] `make test` passes and `gofmt -l .` prints nothing
- [ ] The change is focused and the PR description explains why
- [ ] New or changed endpoints are documented in `docs/API.md` and Postman
- [ ] UI changes are checked on desktop and mobile, with a screenshot in the PR
- [ ] No secrets or personal data in the code, commits, or screenshots

## License

By contributing, you agree that your contributions are licensed under the project's [MIT License](LICENSE).
