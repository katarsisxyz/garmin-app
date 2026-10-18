# Berkontribusi ke Garmin Hub

[English](CONTRIBUTING.md) | **Bahasa Indonesia**

Terima kasih sudah mau membantu. Laporan bug, perbaikan, endpoint baru, dan peningkatan tampilan semuanya diterima. Panduan ini menjelaskan cara menyiapkan proyek, seperti apa perubahan yang baik, dan cara mengirimkannya.

## Sebelum mulai

- Untuk bug, cek dulu [issue yang sudah ada](https://github.com/katarsisxyz/garmin-app/issues).
- Untuk fitur baru atau perubahan besar, buka issue untuk diskusi sebelum menulis kode, supaya kamu tidak membangun sesuatu yang ternyata tidak cocok.
- Perbaikan kecil (typo, dokumentasi, bug yang jelas) boleh langsung dikirim sebagai pull request.

## Persiapan

Kebutuhan: Go 1.24+, Node.js 20+, `make`, dan `openssl`.

```sh
git clone git@github.com:katarsisxyz/garmin-app.git
cd garmin-app
make setup   # dependency, .env, secret
make dev     # backend :8080, frontend :5173
```

Konfigurasi ada di [README.id.md](README.id.md) dan daftar endpoint di [docs/API.md](docs/API.md).

### Mencoba dengan akun Garmin asli

- Pakai akunmu sendiri, jangan akun orang lain.
- Login sekali lalu pakai ulang session-nya. Cloudflare milik Garmin memblokir IP yang login dengan password berulang kali (`garmin_rate_limited`); request yang memakai token tidak terpengaruh.
- Sebagian besar pekerjaan tampilan tidak butuh akun asli: frontend hanya membaca JSON yang diteruskan API, jadi kamu bisa menyajikan data contoh.

## Membuat perubahan

1. Fork repo, lalu buat branch dari `main`: `git checkout -b fix/sleep-score-empty`.
2. Buat perubahanmu, fokus pada satu hal.
3. Jalankan pengecekan:

   ```sh
   make test    # go vet, go test, type-check frontend
   gofmt -l .   # seharusnya tidak mencetak apa pun
   ```

4. Commit dengan format [Conventional Commits](https://www.conventionalcommits.org/), seperti riwayat yang sudah ada:

   ```
   feat: add VO2 max trend to the sleep page
   fix: sort weigh-ins by day when timestamps are missing
   docs: document the workouts/scheduled endpoint
   ```

5. Push lalu buka pull request ke `main`.

## Panduan kode

### Umum

- Buat sesederhana mungkin. Utamakan standard library dan helper yang sudah ada daripada dependency atau abstraksi baru. Kalau menambah dependency, jelaskan alasannya di PR.
- Ikuti gaya kode di sekitarnya: penamaan, gaya komentar, susunan file.
- Untuk logika yang tidak sepele (percabangan, parser, apa pun yang menyentuh auth), sertakan satu pengecekan yang bisa dijalankan, cukup table test kecil.

### Backend (Go)

- Format dengan `gofmt`; `go vet` harus lolos.
- Handler meneruskan JSON Garmin apa adanya. Jangan menambah struct Go yang memetakan ulang field Garmin kecuali frontend benar-benar membutuhkannya.
- Validasi input di batas sistem dan kembalikan `httpx.BadRequest(...)` untuk input yang salah. Error lain lewat mapping error di `internal/httpx`, supaya client selalu menerima `{"error": {"code", "message", "request_id"}}`.
- Semua akses akun lewat `h.accountID(c)` / `h.client(c)`, yang menegakkan aturan session (`me`, tidak boleh mengakses akun lain). Jangan membaca `c.Params("accountId")` langsung.

### Menambah endpoint

1. Tambahkan route di `internal/handler/handler.go` dengan memakai `h.date`, `h.dateRange`, `h.plain`, `h.byID`, atau `h.raw`. Path statis seperti `/workouts/scheduled` harus didaftarkan sebelum `/workouts/:id`.
2. Dokumentasikan di [docs/API.md](docs/API.md) dan tabel endpoint di [docs/PRD.md](docs/PRD.md).
3. Tambahkan request ke koleksi Postman di [postman/](postman/).

### Frontend (React)

- TypeScript harus lolos type-check (sudah termasuk di `make test`).
- Pakai komponen bersama di `web/src/ui.tsx` (`Panel`, `Stat`, `Button`, `Field`, `ConfirmButton`, `toast`) dan fungsi format di `web/src/format.ts`, jangan membuat versi baru sendiri.
- Warna diambil dari token di `web/src/index.css`. Warna menandai jenis metrik (langkah, jantung, tidur, battery, stress) atau aksi; jangan menambah warna dekoratif.
- JSON Garmin tidak selalu lengkap. Baca field dengan aman (`a?.b ?? f.DASH`) supaya field yang hilang tampil "–", bukan membuat halaman error.
- Teks tampilan berbahasa Indonesia dengan kalimat biasa. Tombol menyebut persis apa yang dilakukan ("Simpan berat", bukan "Submit"), dan pesan error menjelaskan langkah selanjutnya.
- Cek perubahanmu di lebar desktop dan mobile 390 px.

## Keamanan

- Jangan pernah commit `.env`, token, password, cookie, atau data akun asli, termasuk di screenshot dan log yang dilampirkan ke issue.
- Jangan pernah me-log password, kode MFA, token Garmin, header `X-API-Key`, atau cookie session.
- Menemukan celah keamanan? Jangan buka issue publik. Hubungi maintainer secara pribadi lewat email di profil GitHub-nya.

## Melaporkan bug

Sertakan:

- Apa yang kamu lakukan, apa yang kamu harapkan, dan apa yang terjadi.
- `request_id` dari response error atau log server. Dengan ini error di server bisa dicari tanpa membagikan kredensial.
- Browser dan OS untuk bug tampilan, atau request-nya (tanpa kredensial) untuk bug API.
- Untuk field yang tampil "–" padahal seharusnya ada: bagian JSON Garmin yang relevan, dengan nilai pribadi dihapus.

## Checklist pull request

- [ ] `make test` lolos dan `gofmt -l .` tidak mencetak apa pun
- [ ] Perubahan fokus dan deskripsi PR menjelaskan alasannya
- [ ] Endpoint baru atau yang berubah sudah didokumentasikan di `docs/API.md` dan Postman
- [ ] Perubahan tampilan sudah dicek di desktop dan mobile, dengan screenshot di PR
- [ ] Tidak ada secret atau data pribadi di kode, commit, atau screenshot

## Lisensi

Dengan berkontribusi, kamu setuju bahwa kontribusimu dilisensikan di bawah [MIT License](LICENSE) proyek ini.
