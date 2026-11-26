# PM-TRAVEL Backend — PM_10

FastAPI menyediakan autentikasi admin/operator, pengelolaan kendaraan/perangkat,
konfigurasi dua target koridor, siklus perjalanan, lokasi, jarak, serta ringkasan
penumpang. Acuan task: [PM_10, issue #11](https://github.com/kristiandwiputra/PM-TRAVEL/issues/11).

## Menjalankan di Windows

Prasyarat: PostgreSQL/PostGIS berjalan, konfigurasi lokal tersedia di
`%LOCALAPPDATA%\PM-TRAVEL\backend.env`, dan migrasi berada pada revision
`d6c9a2b4f701`. Konfigurasi yang dibaca: `PG_HOST`, `PG_PORT`, `PG_DATABASE`,
`PG_USER`, `PG_PASSWORD`, `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`,
`MQTT_PASSWORD`, serta `JWT_SECRET` minimal 32 karakter. Variabel lingkungan
dapat mengganti nilai file. Simpan nilai rahasia di luar Git.

Jalankan dari folder `backend` dengan virtual environment yang sudah dipakai proyek:

```powershell
$pmPython = Join-Path $env:LOCALAPPDATA 'PM-TRAVEL\backend-venv\Scripts\python.exe'
& $pmPython -m pip install -r requirements_pm10.txt
& $pmPython -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload --no-access-log
```

Untuk virtual environment lain, ganti `$pmPython` dengan executable Python
lingkungan tersebut. Buka [Swagger](http://127.0.0.1:8001/docs),
[OpenAPI](http://127.0.0.1:8001/openapi.json), dan
[health database](http://127.0.0.1:8001/health/db).
Subscriber MQTT adalah proses terpisah; menjalankan API tidak menjalankan subscriber.
Access log dimatikan agar kode publik yang berada di URL tidak tercatat oleh Uvicorn.

## Kontrak dan perilaku

- Login: `POST /api/auth/login` dengan JSON `{ "email": "...", "password": "..." }`.
  JWT berlaku 30 menit; gunakan tombol **Authorize** di Swagger.
- Operator dibatasi oleh kepemilikan kendaraan dan trip; admin dapat mengelola seluruh armada.
- Trip: `planned → active → completed`, dengan kedatangan Hajimena sebelum selesai
  di Kotabumi. Pembatalan menggunakan `canceled`.
- Target disalin saat trip dibuat. Perubahan konfigurasi tidak mengubah trip lama.
- Riwayat GPS mengikuti `trip_id` yang divalidasi saat penyimpanan, sehingga pemindahan
  perangkat setelah trip selesai tidak menghapus riwayat, posisi, atau perhitungan jaraknya.
- `location_status` mengikuti `observed_at`: `fresh` ≤30 detik, `stale` >30–60 detik,
  `no_update` >60 detik, `invalid_timestamp` untuk waktu mendatang.
  `gps_status` terpisah dan mengikuti pesan terbaru berdasarkan waktu penerimaan.
- Ringkasan publik hanya berlaku saat trip aktif. Tidak memuat ID internal, waktu
  penerimaan internal, atau riwayat GPS. Target publik dibedakan melalui `sequence_no`.
- Respons sukses memiliki model OpenAPI yang eksplisit; properti request yang tidak
  dikenal ditolak dengan 422. Boolean status harus berupa boolean JSON.
- Gangguan koneksi/pool database menghasilkan JSON 503 dengan `Retry-After: 3`.
  Log handler hanya menyebut jenis kesalahan, tanpa SQL, parameter, token, atau kode publik.
- Jarak dalam meter adalah estimasi antarfix/garis lurus, bukan jarak jalan/odometer.
  ETA tetap `unavailable` sampai PM_15 diintegrasikan.

## Pengujian regresi

Dari folder `backend`:

```powershell
$pmPython = Join-Path $env:LOCALAPPDATA 'PM-TRAVEL\backend-venv\Scripts\python.exe'
& $pmPython -m unittest discover -s tests -p 'test_pm10_*.py' -v
```

`test_pm10_contract.py` memeriksa batas freshness dan skema OpenAPI tanpa koneksi
database. `test_pm10_api.py` menggunakan PostgreSQL/PostGIS **lokal `pmtravel_dev`**.
Fixture berlabel `QA-PM10-*` berjalan dalam transaksi yang di-rollback, dan setiap
mutasi API memakai savepoint. Tidak membutuhkan akun admin asli. Sequence PostgreSQL
dapat tetap bertambah walaupun baris fixture dibatalkan.

Skrip lama `tests/smoke_pm10.py` berbeda: meminta akun admin dan menyimpan data QA.
Skrip itu tidak dijalankan oleh perintah regresi di atas.

Lihat [kontrak dan hasil regresi](../docs/PM_10_API_dan_Pengujian.md) serta
[OpenAPI tersimpan](../docs/PM10_openapi.json). Pengujian ini tidak membuktikan
kinerja beban, akses paralel, integrasi alat MQTT, atau kesiapan deployment produksi.
