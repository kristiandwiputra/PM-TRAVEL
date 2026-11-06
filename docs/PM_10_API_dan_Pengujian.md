# PM_10 — Kontrak API, pengujian, dan catatan implementasi

**Acuan:** Issue #11, PM_02, PM_03, PM_08. Bukti pengujian **belum dilakukan** saat paket kode dibuat.

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
