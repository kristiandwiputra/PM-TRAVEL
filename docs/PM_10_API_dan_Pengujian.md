# PM_10 — Kontrak API, pengujian, dan catatan implementasi

**Acuan:** [Issue #11 — PM_10](https://github.com/kristiandwiputra/PM-TRAVEL/issues/11), PM_02, PM_03, PM_08.
Paket awal belum menyertakan bukti uji. Hasil regresi lokal terbaru pada **26 November 2026** dicatat di bagian 7.

## 1. Peran dan lingkup
- `admin`: mengelola semua kendaraan, perangkat, rute/target dan trip, menetapkan `operator_id` kendaraan.
- `operator`: hanya dapat membaca/mengelola kendaraan miliknya, pengaitan perangkat operasional miliknya, dan trip yang menjadi tanggung jawabnya. Tidak mengatur kredensial MQTT atau akun teknis.
- `penumpang`: **tanpa login**, hanya dapat `GET /api/public/trips/{public_code}` untuk trip berstatus `active`. Tidak ada riwayat GPS mentah publik.
- Kendaraan lama tanpa operator_id tidak otomatis terbuka bagi seluruh operator. Admin wajib menugaskan melalui `PATCH /api/vehicles/{id}`.
- `public_code` acak 192-bit, ditampilkan sekali saat start; di database hanya SHA-256; revoke saat completed/canceled. Lindungi kode seperti kunci dan jangan masukkan ke log publik.

## 2. Endpoint
| Endpoint | Akses | Keterangan |
|---|---|---|
| POST /api/auth/login | Login | JWT 30 menit |
| GET /api/auth/me | JWT | profil |
| GET /api/vehicles/ | admin / operator pemilik | daftar, halaman limit-offset |
| GET /api/vehicles/{id} | admin / operator pemilik | detail |
| GET /api/vehicles/{id}/location/latest | admin / operator pemilik | cache posisi valid terakhir Putra, termasuk age dan last_seen internal |
| POST /api/vehicles/ | admin | buat dan opsional tugaskan operator |
| PATCH /api/vehicles/{id} | admin atau operator terbatas | admin assign/status; operator display_name |
| GET /api/devices/ | admin / operator pemilik | daftar nonrahasia |
| GET /api/devices/{id} | admin / operator pemilik | detail nonrahasia |
| POST /api/devices/ | admin | daftarkan identitas perangkat |
| PATCH /api/devices/{id}/status | admin | aktif/nonaktif |
| PATCH /api/devices/{id}/vehicle | admin / operator berwenang dua kendaraan | ubah pengaitan tanpa trip aktif |
| GET /api/route-targets/ | admin/operator | konfigurasi dua target |
| PUT /api/route-targets/{sequence_no} | admin | ubah konfigurasi untuk **trip berikutnya** |
| POST /api/trips/ | admin / operator penanggung jawab | buat planned + salin target |
| GET /api/trips/ | admin / operator penanggung jawab | riwayat dengan limit-offset |
| GET /api/trips/{id} | admin / operator penanggung jawab | posisi per trip, jarak, dua target + ETA unavailable |
| POST /api/trips/{id}/start | admin / operator penanggung jawab | planned→active; keluarkan kode sekali |
| POST /api/trips/{id}/arrive-hajimena | admin / operator penanggung jawab | tetap active |
| POST /api/trips/{id}/complete | admin / operator penanggung jawab | active→completed setelah Hajimena |
| POST /api/trips/{id}/cancel | admin / operator penanggung jawab | planned/active→canceled |
| GET /api/trips/{id}/positions | admin / operator penanggung jawab | log GPS terbatas limit<=200, tanpa raw_payload |
| GET /api/public/trips/{code} | kode aktif | hanya ringkasan perjalanan aktif; tidak ada id internal/riwayat/raw_payload |

## 3. Jarak, timestamp, dan ETA
- `observed_at`: waktu pengamatan GPS; ditampilkan UTC ISO-8601 `Z`; UI dapat mengubahnya ke WIB.
- `received_at` / `last_seen`: internal operator, bukan untuk penumpang. Aktivitas penerimaan yang baru **bukan bukti** posisi baru.
- `location_status`: `fresh` umur <=30 detik, `stale` umur >30 sampai 60, `no_update` umur >60, `no_location` jika tidak ada fix valid, `invalid_timestamp` untuk future timestamp.
- `gps_status`: keadaan pesan GPS terbaru berdasarkan penerimaan, terpisah dari posisi valid terakhir.
- `traveled_gps_segments_m`: jumlah jarak great-circle antara fix GPS valid yang tersimpan untuk trip, **bukan jarak odometer/jalan**, dapat dipengaruhi noise. Null jika tanpa fix.
- `remaining_straight_line_m`: garis lurus dari posisi valid terakhir ke masing-masing target, **bukan jarak mengikuti jalan**. Null jika posisi tidak ada.
- ETA `targets[].eta`: `status: unavailable`, waktu/durasi/model null, `reason: PM_15_not_integrated`. Integrasi PM_15 merupakan tugas terpisah.
- Kode akses aktif hanya selama `active`; route baru tidak mengubah snapshot `targets` milik trip lama.

## 4. Pengujian akhir yang wajib dibuktikan

Checklist ini mencakup verifikasi integrasi akhir. Hasil regresi dengan fixture lokal
di bagian 7 tidak otomatis menyelesaikan pengujian perangkat atau produksi.
- [ ] Migrasi berjalan tanpa benturan serta dua target tersedia; `alembic current` menunjukkan `d6c9a2b4f701`.
- [ ] Health, DB health, OpenAPI terbuat dan Swagger menampilkan router.
- [ ] Login benar 200, password salah 401, token tidak ada 401, token rusak/kedaluwarsa 401.
- [ ] Operator dibatasi ke kendaraan/trip miliknya. ID kendaraan/trip milik operator lain 404 atau 403; admin berwenang.
- [ ] Operator tidak bisa mengelola kredensial teknis; admin dapat assign operator.
- [ ] Satu trip active per kendaraan; request start kedua 409 (juga dijamin unique index di PostgreSQL).
- [ ] Snapshot kedua target dibuat; pembaruan route tidak mengubah target trip lama.
- [ ] Public code salah/salah ketik 404, planned 404, active 200, completed/canceled 404.
- [ ] Penumpang tidak dapat mengakses endpoint raw GPS atau riwayat operator.
- [ ] `gps_valid=false` atau titik terlambat tidak mengganti posisi valid terakhir; last_seen masih dapat lebih baru.
- [ ] Fresh/stale/no_update dan timestamp berdasarkan observed_at, bukan received_at.
- [ ] Tiba Hajimena tidak menyelesaikan trip. Kotabumi hanya bisa menyelesaikan sesudah Hajimena.
- [ ] Jarak memiliki satuan meter dan metode yang jujur, nilai null jika tanpa data.
- [ ] ETA unavailable sebelum PM_15 tersedia.
- [ ] Riwayat operator dengan limit/offset dan batas kepemilikan.
- [ ] Bukti tes, cuplikan contoh respons, OpenAPI JSON, commit/PR GitHub dilampirkan di issue.

## 5. CSV — Should (FR-17)
CSV **belum diterapkan**. Ini `Should`, bukan `Must`; dicatat secara transparan. Jika ditambahkan, harus terbatas pada operator berwenang dan tanpa token/kredensial/raw_payload sensitif.

## 6. Persyaratan deployment
- Gunakan HTTPS dan JWT secret panjang di berkas env lokal, tidak di Git.
- MQTT broker publik plaintext masih hanya untuk pengujian terkendali; belum memenuhi NFR keamanan produksi.
- Hak akses data dalam prototipe mengikuti `operator_id` kendaraan dan trip; perlu audit untuk penggunaan multiarmada nyata.

## 7. Penguatan PM_10 dan hasil regresi — 26 November 2026

Perubahan mengikuti kontrak lokasi/riwayat, pemisahan akses penumpang/operator,
validasi request, dan dokumentasi respons dalam issue #11.

### Perbaikan yang dibuktikan

1. **Riwayat tetap utuh setelah pemindahan perangkat.** Pembacaan posisi, jarak,
   dan GPS perjalanan mengikuti `gps_positions.trip_id`, bukan pengaitan kendaraan
   perangkat saat ini. Pemeriksaan pemilik trip tetap berlaku.
2. **Ringkasan publik tanpa ID internal.** `target_id` dihapus dari target publik;
   `sequence_no` menjadi pembeda target. Model respons publik terpisah dari model operator.
3. **Validitas pesan dan usia posisi terpisah.** Endpoint posisi kendaraan menambahkan
   `gps_status` dari pesan terakhir. Pesan GPS invalid tidak mengubah posisi valid
   terakhir menjadi lokasi invalid, dan penerimaan baru tidak meremajakan `observed_at`.
4. **Gangguan koneksi terkontrol.** Kegagalan koneksi dan timeout pool menghasilkan
   JSON 503 dengan `Retry-After: 3`. Respons/log handler tidak memuat SQL atau parameter.
5. **Kontrak eksplisit.** Seluruh 26 operasi memiliki skema respons sukses; request
   menolak field tidak dikenal, boolean status harus berupa boolean JSON, dan batas
   pagination serta enum status tercantum di Swagger/OpenAPI.

### Pelaksanaan lokal

- Python 3.13, FastAPI 0.162.0, Pydantic 2.14.3, SQLAlchemy 2.1.8, PostgreSQL/PostGIS lokal.
- Revision database: `d6c9a2b4f701`; dua target rute tersedia.
- Perintah dari `backend/`:

```powershell
$pmPython = Join-Path $env:LOCALAPPDATA 'PM-TRAVEL\backend-venv\Scripts\python.exe'
& $pmPython -m unittest discover -s tests -p 'test_pm10_*.py' -v
```

Hasil: **16 test lulus**. Sebelum perbaikan, suite awal berisi 8 test menghasilkan
4 failure dan 1 error pada kasus riwayat pemindahan perangkat, ID internal publik,
status GPS, field request asing, dan kegagalan koneksi database.

| Kelompok pemeriksaan | Hasil lokal |
|---|---|
| Login benar/salah, profil, token tidak ada/rusak/kedaluwarsa, sub UUID invalid | Lulus |
| Penolakan kendaraan/perangkat/trip/riwayat milik operator lain dan operasi admin | Lulus |
| Riwayat, posisi dan jarak tetap sama setelah perangkat dipindahkan | Lulus |
| Snapshot dua target tidak berubah setelah konfigurasi diperbarui | Lulus |
| Satu trip aktif per kendaraan dan larangan pemindahan/status saat aktif | Lulus untuk permintaan berurutan |
| Hajimena tetap aktif; complete sebelum Hajimena ditolak | Lulus |
| Kode salah ditolak; kode active dapat dibaca; completed/canceled dicabut | Lulus |
| Publik tanpa ID internal, received_at/last_seen atau riwayat GPS | Lulus |
| Posisi kosong, pesan terlambat, dan GPS invalid setelah posisi valid | Lulus |
| Batas tepat 30/60 detik dan waktu GPS mendatang/tanpa zona | Lulus pada clock uji deterministik |
| Batas pagination, field request tidak dikenal, dan ETA unavailable | Lulus |
| Gangguan koneksi/pool: JSON 503 dan respons/log tanpa parameter | Lulus dengan injeksi kegagalan |
| Semua operasi memiliki skema; enum status dan batas GPS tercantum | Lulus |

Fixture `QA-PM10-*` memakai akun sementara dalam transaksi yang di-rollback serta
savepoint per mutasi API. Tidak memakai password admin asli. Pemeriksaan setelah
suite menunjukkan **0 akun fixture tersimpan**; sequence database dapat bertambah.

`docs/PM10_openapi.json` dihasilkan ulang dari aplikasi. Contoh respons publik
disesuaikan dengan kontrak tanpa ID target internal; contoh lain tetap memakai
data QA terdahulu dan bukan rekaman perjalanan fisik baru.

### Batas bukti

Regresi ini tidak menjalankan smoke test lama yang menyimpan fixture permanen,
pengujian permintaan paralel/beban p95, MQTT pada alat fisik, retensi/restore,
TLS/VPS, atau integrasi model ETA. Kebutuhan tersebut tetap mengikuti kartu
PM_08/PM_09, PM_15, PM_16, dan PM_17 masing-masing.
