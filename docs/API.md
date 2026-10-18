# Referensi API

Base URL lokal: `http://localhost:8080`. Semua body request dan response berformat JSON, kecuali unggah dan unduh file aktivitas.

Response sukses meneruskan JSON dari Garmin Connect **apa adanya**, tanpa diubah atau dibungkus. Nama field mengikuti Garmin (misalnya `totalSteps`, `dailySleepDTO`). Jika Garmin mengembalikan body kosong, API menjawab `204 No Content`.

## Autentikasi

Ada dua cara, dan keduanya berlaku untuk semua endpoint `/api/v1`.

### Cookie session (browser)

Dipakai oleh frontend. Browser tidak pernah memegang API key.

| Endpoint | Body | Hasil |
| --- | --- | --- |
| `POST /auth/login` | `{"email", "password"}` | Tanpa MFA: cookie `session` + `{"mfa_required": false}`. Dengan MFA: cookie `mfa_pending` (10 menit) + `{"mfa_required": true}` |
| `POST /auth/mfa` | `{"code"}` | Memakai cookie `mfa_pending`; berhasil: cookie `session` + `{"connected": true}`. Kode salah boleh diulang |
| `POST /auth/logout` | | Menghapus cookie `session`. Token Garmin tetap tersimpan |

- Cookie `session` berisi JWT HS256 dengan `sub` = ID akun (Garmin profile ID), berlaku 7 hari, `HttpOnly`, `SameSite=Strict`.
- Session hanya boleh mengakses akunnya sendiri: gunakan `/api/v1/accounts/me/...`. ID akun lain menghasilkan `403`.
- `/auth/login` dan `/auth/mfa` dibatasi 5 request per menit per IP.

### API key (server, Postman)

Kirim header `X-API-Key: <API_KEY>`. API key boleh mengakses akun mana pun; `:accountId` adalah ID bebas dari sistem kamu (misalnya user ID). `me` tidak bisa dipakai dengan API key.

Menghubungkan akun dengan API key:

| Endpoint | Body | Hasil |
| --- | --- | --- |
| `POST /api/v1/accounts/:accountId/connect` | `{"email", "password"}` | `{"connected", "mfa_required"}` |
| `POST /api/v1/accounts/:accountId/connect/mfa` | `{"code"}` | `{"connected": true}` |
| `GET /api/v1/accounts/:accountId/status` | | `{"connected": false}` atau `{"connected": true, "display_name", "full_name"}` |
| `DELETE /api/v1/accounts/:accountId` | | `204`; menghapus token tersimpan (dengan session, cookie juga dihapus) |

## Endpoint data

Semua path di bawah relatif terhadap `/api/v1/accounts/:accountId` (atau `/api/v1/accounts/me` dengan session).

Konvensi parameter:
- Tanggal selalu `YYYY-MM-DD`. Jika `date` kosong, server memakai tanggal hari ini (zona waktu server).
- Rentang memakai `start` dan `end`.
- `:id` dan ID lain harus bilangan bulat positif; selain itu `400`.

### Profil, perangkat, gear

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/profile` | Profil pengguna |
| GET | `/profile/settings` | Pengaturan profil (unit, zona waktu, dll.) |
| GET | `/devices` | Daftar perangkat terhubung |
| GET | `/devices/last-used` | Perangkat terakhir dipakai |
| GET | `/devices/:id/settings` | Pengaturan satu perangkat |
| GET | `/gear` | Daftar gear (sepatu, sepeda) |
| GET | `/gear/:uuid/stats` | Statistik pemakaian gear |

### Harian

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/daily/summary?date=` | Ringkasan harian: langkah, detak istirahat, Body Battery, stress |
| GET | `/daily/steps?date=` | Grafik langkah per 15 menit |
| GET | `/daily/steps/range?start=&end=` | Total langkah per hari |
| GET | `/daily/heart-rate?date=` | Detak jantung sepanjang hari |
| GET | `/daily/hrv?date=` | HRV semalam, rata-rata mingguan, rentang normal |
| GET | `/daily/stress?date=` | Stress rata-rata dan maksimum |
| GET | `/daily/sleep?date=` | Tidur: durasi per fase, skor, `sleepLevels` per menit |
| GET | `/daily/body-battery?start=&end=` | Body Battery per hari |
| GET | `/daily/spo2?date=` | Saturasi oksigen |
| GET | `/daily/respiration?date=` | Laju napas |
| GET | `/daily/hydration?date=` | Minum hari itu dan targetnya |
| POST | `/daily/hydration` | Body `{"value_ml": 250, "date": "2026-10-18"}`. Nilai negatif untuk koreksi; maksimum 10.000 ml |
| GET | `/daily/intensity-minutes?date=` | Menit intensitas |

### Body

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/body/composition?start=&end=` | Komposisi tubuh |
| GET | `/body/weigh-ins?start=&end=` | Penimbangan per hari (`weight` dalam gram) |
| POST | `/body/weigh-ins` | Body `{"weight": 70.5, "unit": "kg", "timestamp": "2026-10-18T07:00:00+07:00"}`. `unit` `kg` atau `lbs` (default `kg`); `timestamp` opsional |
| DELETE | `/body/weigh-ins/:pk?date=` | `pk` = `samplePk` dari daftar penimbangan; `date` = hari penimbangan |
| GET | `/body/blood-pressure?start=&end=` | Pengukuran tekanan darah |
| POST | `/body/blood-pressure` | Body `{"systolic": 120, "diastolic": 80, "pulse": 65, "timestamp": "...", "notes": ""}`. Sistolik 70–260, diastolik 40–150; `pulse` dan `timestamp` opsional |
| DELETE | `/body/blood-pressure/:version?date=` | `version` dari daftar pengukuran; `date` = hari pengukuran |

### Performa dan latihan

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/performance/training-readiness?date=` | Skor dan level training readiness |
| GET | `/performance/training-status?date=` | Training status dan load |
| GET | `/performance/max-metrics?date=` | VO2 max |
| GET | `/performance/endurance-score?start=&end=` | Endurance score |
| GET | `/performance/race-predictions` | Prediksi waktu lomba terbaru. Dengan `start`, `end`, dan `type` (`daily` atau `monthly`) untuk rentang maksimal satu tahun |
| GET | `/performance/hr-zones` | Zona detak jantung |
| GET | `/performance/personal-records` | Rekor pribadi |
| GET | `/training-plans` | Training plan yang tersedia |

### Aktivitas

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/activities?start=0&limit=20&type=` | Daftar aktivitas terbaru. `type` opsional, misalnya `running`, `cycling`. `limit` maksimum 1000 |
| GET | `/activities/by-date?start=&end=&type=` | Aktivitas dalam rentang tanggal |
| POST | `/activities/upload` | Multipart, field `file`: file `.fit`, `.gpx`, atau `.tcx` |
| GET | `/activities/:id` | Detail aktivitas (`summaryDTO`) |
| GET | `/activities/:id/details?max_chart=2000&max_poly=4000` | Data per detik dan rute |
| GET | `/activities/:id/splits` | Split per lap (`lapDTOs`) |
| GET | `/activities/:id/hr-zones` | Waktu di tiap zona detak jantung |
| GET | `/activities/:id/weather` | Cuaca saat aktivitas |
| GET | `/activities/:id/download?format=` | File biner. `format`: `original` (zip berisi FIT), `gpx`, `tcx`, `kml`, `csv`. Default `original` |
| PATCH | `/activities/:id` | Body `{"name"}` dan/atau `{"description"}`. Mengembalikan aktivitas yang sudah diperbarui |
| DELETE | `/activities/:id` | Menghapus aktivitas dari Garmin Connect secara permanen |

### Workout

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/workouts?start=0&limit=20` | Workout tersimpan |
| POST | `/workouts` | Body: JSON workout format Garmin, diteruskan apa adanya. Contoh ada di koleksi Postman |
| GET | `/workouts/scheduled?year=&month=` | Kalender Garmin satu bulan (1–12); workout ada di `calendarItems` dengan `itemType: "workout"`. Default bulan ini |
| DELETE | `/workouts/scheduled/:id` | Membatalkan jadwal (`id` dari `calendarItems`); workout-nya tetap ada |
| GET | `/workouts/:id` | Detail workout |
| DELETE | `/workouts/:id` | Menghapus workout |
| POST | `/workouts/:id/schedule` | Body `{"date": "2026-10-20"}` |
| POST | `/workouts/:id/push` | Body `{"device_id": 3311}`; perangkat dari `/devices`. Jam menerimanya saat sinkron berikutnya |

### Proxy

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/raw?path=/userprofile-service/socialProfile` | GET ke endpoint Garmin Connect mana pun yang belum dibungkus. `path` harus diawali `/`; query lain ikut diteruskan |

## Endpoint lain

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/healthz` | `{"status": "ok"}`, tanpa autentikasi |
| GET | `/*` | Frontend dari `WEB_DIR`. Path yang tidak dikenal mengembalikan `index.html`, kecuali di bawah `/api/` dan `/auth/` |

## Error

Semua error berbentuk:

```json
{"error": {"code": "garmin_rate_limited", "message": "too many requests to garmin; try again later", "request_id": "5227ec9c-..."}}
```

`request_id` sama dengan header `X-Request-ID` dan field `request_id` di log server, jadi bisa dipakai untuk mencari detail error.

| HTTP | `code` | Arti |
| --- | --- | --- |
| 400 | `invalid_argument` | Input tidak valid (tanggal, ID, body JSON) |
| 400 | `invalid_file_format` | File unggahan bukan FIT, GPX, atau TCX |
| 401 | `unauthorized` | API key salah atau session tidak ada / kedaluwarsa |
| 401 | `garmin_reauth_required` | Garmin menolak kredensial atau token; akun perlu login ulang |
| 403 | `forbidden` | Session mencoba mengakses akun lain |
| 404 | `not_found` | Data atau route tidak ada |
| 409 | `account_not_connected` | Akun belum dihubungkan atau tokennya sudah dihapus |
| 409 | `mfa_not_pending` | Tidak ada login MFA yang menunggu, atau sudah lewat 10 menit |
| 429 | `rate_limited` | Lebih dari 5 percobaan login per menit dari IP yang sama |
| 429 | `garmin_rate_limited` | Garmin membatasi permintaan |
| 502 | `garmin_unavailable` | Garmin tidak bisa dihubungi atau mengembalikan error |
| 500 | `internal_error` | Kesalahan di server |

## Contoh

```sh
# Status akun dengan API key
curl -H "X-API-Key: $API_KEY" http://localhost:8080/api/v1/accounts/user-1/status

# Login sebagai browser, simpan cookie, lalu ambil ringkasan hari ini
curl -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"nama@email.com","password":"..."}' http://localhost:8080/auth/login
curl -b cookies.txt http://localhost:8080/api/v1/accounts/me/daily/summary

# Unggah file aktivitas
curl -b cookies.txt -F file=@lari.fit http://localhost:8080/api/v1/accounts/me/activities/upload

# Unduh GPX
curl -b cookies.txt -OJ "http://localhost:8080/api/v1/accounts/me/activities/123/download?format=gpx"
```
