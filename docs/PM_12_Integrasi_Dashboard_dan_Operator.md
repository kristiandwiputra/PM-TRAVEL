# PM_12 — Implementasi Dashboard Pemantauan dan Panel Operator

**Versi Dokumen:** 1.1<br />
**Tanggal:** 27 November 2026  
**PIC Implementasi:** Maulana Rizki Ramadhani (bersama tim frontend/UI-UX)  
**Acuan Issue:** [Issue #13 — PM_12](https://github.com/kristiandwiputra/PM-TRAVEL/issues/13), [Issue #9 — PM_08](https://github.com/kristiandwiputra/PM-TRAVEL/issues/9)<br />
**Status:** Selesai dan terverifikasi  

---

## 1. Ringkasan Pekerjaan

Sesuai dengan kebutuhan yang disepakati pada **PM_02**, **PM_03**, dan **PM_11**, telah dibangun antarmuka frontend **PM-TRAVEL** berbasis React 19, Vite, Tailwind-style modular CSS, Leaflet, GSAP, dan Motion. Antarmuka ini terhubung langsung ke kontrak REST API FastAPI PM_10 dan menyediakan dua mode utama:
1. **Dashboard dan Panel Operator**: Khusus pengguna terautentikasi (admin/operator) untuk memantau armada dan mengelola siklus perjalanan.
2. **Halaman Pelacakan Publik Penumpang**: Dapat diakses tanpa login menggunakan kode akses acak 192-bit yang diterbitkan saat perjalanan dimulai.

---

## 2. Fitur yang Telah Diimplementasikan

### 2.1 Manajemen Siklus Hidup Perjalanan (`TripsManagerPage`)
- **Daftar & Filter Status**: Operator dapat memfilter perjalanan berdasarkan status (`Semua`, `planned`, `active`, `completed`, `canceled`).
- **Pembuatan Perjalanan Baru (`POST /api/trips/`)**: Operator memilih kendaraan aktif yang terdaftar; sistem membuat perjalanan berstatus `planned` dan otomatis menyalin snapshot target koridor tetap (Hajimena & Kotabumi).
- **Mulai Perjalanan (`POST /api/trips/{id}/start`)**:
  - Mengubah status trip menjadi `active`.
  - Menerbitkan **kode akses publik acak 192-bit** yang ditampilkan dalam modal khusus dengan tombol *Salin Kode* dan tautan pengujian langsung.
  - Mematuhi aturan keamanan: kode hanya diberikan satu kali dan di database hanya disimpan digest hash SHA-256.
- **Kedatangan di Hajimena (`POST /api/trips/{id}/arrive-hajimena`)**:
  - Mencatat waktu tiba aktual di Hajimena.
  - Perjalanan **tetap aktif** menuju target akhir Kotabumi (tidak otomatis selesai).
- **Penyelesaian di Kotabumi (`POST /api/trips/{id}/complete`)**:
  - Menyelesaikan perjalanan di Kotabumi setelah kedatangan Hajimena tercatat.
  - Status trip berubah menjadi `completed` dan kode akses publik otomatis dicabut.
- **Pembatalan Perjalanan (`POST /api/trips/{id}/cancel`)**: Membatalkan perjalanan `planned` atau `active` dan mencabut kode publik.
- **Pemeriksaan Detail & Riwayat GPS**:
  - Modal detail menampilkan status waktu, koordinat terakhir, kecepatan, status GPS/lokasi, satelit, HDOP, dan last seen.
  - Snapshot kedua target dengan sisa jarak garis lurus (*Great-Circle*).
  - Estimasi jarak tempuh segmen GPS valid beserta catatan metodologinya.
  - Tombol untuk memuat log riwayat titik GPS perjalanan (`GET /api/trips/{id}/positions`).

### 2.2 Mode Pelacakan Penumpang (`PassengerTrackPage`)
- Akses langsung via kode atau parameter query URL (`?trip={public_code}`).
- Menampilkan peta Leaflet, posisi armada terkini, sisa jarak garis lurus ke target, serta status perjalanan.
- Menolak kode salah atau kode perjalanan yang telah selesai dengan pesan ramah pengguna (HTTP 404).
- Bebas dari kebocoran data internal (tidak memuat internal ID, `received_at`, `last_seen`, atau riwayat GPS mentah).

### 2.3 Floating Pill Hallmark Telemetri IoT
- Menampilkan status ringkas kendaraan yang dipilih di atas peta: nomor plat, kecepatan km/jam, dan label status kesegaran lokasi.
- Animasi denyut *hallmark pulse* yang mencerminkan status: hijau mint (`fresh` $\le 30$ detik), kuning amber (`stale` $> 30$ s.d. $60$ detik), atau merah rose (`no_update` $> 60$ detik).
- Dapat diklik untuk membuka kartu detail telemetri IoT lengkap dan tombol pusatkan peta (*Center Map*).

### 2.4 Navigasi Bergerak (Bottom Tab Bar) & Interpolasi Marker GSAP
- **Bottom Tab Bar**: Terpasang di bagian bawah layar perangkat seluler dengan indikator animasi layout spring untuk pergantian halaman yang ergonomis.
- **Interpolasi GSAP**: Perubahan koordinat kendaraan pada peta diinterpolasikan secara mulus (`gsap.to`) selama 1.8 detik dengan kurva `power2.out`, mencegah pergerakan marker yang patah-patah saat polling data baru.

---

## 3. Hasil Pengujian dan Verifikasi

| Jenis Pengujian | Perintah / Alat | Hasil Pengujian | Keterangan |
|---|---|---|---|
| **Linting Kode** | `npm run lint` (ESLint) | **Lulus (0 error, 0 warning)** | Mematuhi standar sintaksis React, hooks, dan ESModule |
| **Kompilasi Produksi** | `npm run build` (Vite / Rolldown) | **Lulus (build sukses)** | Menghasilkan bundel teroptimasi di `dist/` |
| **Verifikasi Kontrak Mock** | `node PM12_API_MOCK_VERIF.mjs` | **Lulus (seluruh assertion OK)** | Menguji login, dashboard, polling, usia GPS, aksi trip CRUD, lifecycle operator, dan publik penumpang |

---

## 4. Keterbatasan dan Rencana Integrasi PM_15

- **Estimasi Waktu Tiba (ETA)**:
  Sesuai dengan kontrak pada bab 3 PM_10, seluruh endpoint perjalanan (`/api/trips/{id}` dan `/api/public/trips/{code}`) mengembalikan status ETA:
  ```json
  {
    "status": "unavailable",
    "predicted_arrival_at": null,
    "predicted_duration_seconds": null,
    "model_version": null,
    "reason": "PM_15_not_integrated"
  }
  ```
  Dashboard operator dan halaman pelacakan penumpang dengan jujur menampilkan label **"Belum tersedia (PM_15)"** dan tidak menampilkan angka estimasi rekaan.
- Integrasi model prediksi machine learning nyata (Random Forest / Gradient Boosting) akan diselesaikan pada tahapan **PM_14** dan **PM_15**.

---

## 5. Pemulihan live GPS dan pembersihan data QA — 27 November 2026

### 5.1 Pemetaan terhadap Kanban

| Task | Perubahan | Bukti |
|---|---|---|
| [PM_08 — issue #9](https://github.com/kristiandwiputra/PM-TRAVEL/issues/9) | Mengaktifkan penerima MQTT yang belum berjalan; membuat client ID penerima unik; menunggu SUBACK sebelum menyatakan subscription aktif; menangani reconnect awal dan melengkapi log disconnect | `backend/mqtt_subscriber.py`; commit [175a14e](https://github.com/kristiandwiputra/PM-TRAVEL/commit/175a14e15c2f96184a5ad1a6ebe7a74720af47cc) |
| PM_08 | Menambahkan launcher API dan MQTT dalam satu proses serta dependensi `paho-mqtt`; menolak pengaitan GPS ke trip yang belum dimulai | `backend/run_live.py`, `backend/requirements_pm10.txt`, `backend/tests/test_pm08_live.py` |
| [PM_12 — issue #13](https://github.com/kristiandwiputra/PM-TRAVEL/issues/13) | Menghapus fallback kendaraan/koordinat/riwayat/perjalanan simulasi; kegagalan API dan konflik aksi diteruskan sebagai error; tidak membuat kode publik palsu | `frontend/src/api.js`, `frontend/tests/live-api.test.mjs`; commit 175a14e |
| PM_12 | Menampilkan usia GPS, nama kendaraan, pesan perangkat terakhir, dan status GPS; memperingatkan posisi lama; membedakan marker tidak terkini dan kecepatan terakhir; memprioritaskan posisi GPS terbaru saat memilih kendaraan awal | `frontend/src/App.jsx`, `frontend/src/App.css`; commit 175a14e |
| PM_08 / PM_12, operasi lokal | Membersihkan satu kendaraan simulasi QA dan relasinya agar dashboard hanya menampilkan kendaraan alat fisik | Transaksi database lokal pada bagian 5.4; tidak mengubah atau menghapus API PM_10 |

### 5.2 Hasil pengujian kode

| Pemeriksaan | Perintah | Hasil pada perbaikan 175a14e |
|---|---|---|
| Penerima MQTT, ACK setelah penyimpanan, penolakan payload/kegagalan DB, ID unik, dan siklus launcher | Dari `backend/`: `python -m unittest discover -s tests -p 'test_pm08_*.py' -v` | 9 test lulus; tanpa mengirim GPS uji ke broker |
| Regresi API, hak akses, riwayat, siklus perjalanan, dan kontrak | Dari `backend/`: `python -m unittest discover -s tests -p 'test_pm10_*.py' -v` | 16 test lulus dengan fixture lokal dan rollback |
| API tidak membuat data/aksi pengganti ketika gagal, otorisasi lokasi, serta status GPS lama | Dari `frontend/`: `node --test tests/live-api.test.mjs` | 7 test lulus; sebelumnya 7 kasus ini gagal |
| Kontrak frontend operator/penumpang | Dari `frontend/`: `node PM12_API_MOCK_VERIF.mjs` | Seluruh assertion lulus |
| Build frontend | Dari `frontend/`: `npm run build` | Sukses; ada peringatan ukuran bundel di atas 500 kB |

Total suite regresi: **32 test lulus**, ditambah verifikasi mock lama dan build.
Lint tidak dijalankan ulang untuk perbaikan ini; laporan lint pada bagian 3 berasal
dari implementasi sebelumnya.

### 5.3 Bukti penerimaan alat fisik pada laptop

- Perangkat `PMT-001` mengirim ke topik `pmtravel/PMT-001/telemetry` pada broker yang
  sudah dikonfigurasi. Pesan native diterima, disimpan ke `gps_positions`, dan
  diikuti ACK `stored` sesuai `message_id`.
- Pemeriksaan sekitar **02:20 WIB, 27 November 2026** mencatat **50 pesan dalam
  jendela 10 menit, 48 dengan GPS valid**. Posisi GPS terakhir saat pemeriksaan
  bertimestamp **02:20:35 WIB**, dengan status `fresh` dan usia sekitar **3 detik**.
- API pada port 8001 dan frontend pada port 5173 merespons 200. Request tanpa token
  ke `/api/auth/me` melalui port frontend menghasilkan 401 sebagaimana kontrak,
  membuktikan proxy `/api` mencapai backend. Dashboard membaca API setiap 5 detik.
- Pesan dengan `gps_valid: false` tetap dapat disimpan dan mendapat ACK; pesan itu
  tidak mengganti posisi valid terakhir. ACK penyimpanan tidak menyatakan GPS valid.
- Alat sempat membuat sesi boot baru selama pengamatan. Setelah jeda, pesan kembali
  diterima. Penyebab restart perangkat belum dipastikan.

Bukti ini menunjukkan aliran pesan asli menuju database lokal dan keterjangkauan
API dari frontend. Perubahan koordinat kecil dapat disebabkan noise GPS; data ini
belum menjadi bukti penyelesaian uji perjalanan koridor penuh, pengujian beban,
ketersediaan 24 jam, atau pengujian produksi pada PM_17/PM_18.

### 5.4 Pembersihan data simulasi lokal

Atas permintaan pengguna, kendaraan **PM10-B8893AC2** dengan nama
`Simulasi QA PM_10` dihapus setelah identitas, perangkat, dan relasinya diperiksa.
Pembersihan dilakukan dalam satu transaksi pada `pmtravel_dev` lokal:

| Data QA yang dihapus | Jumlah |
|---|---:|
| Kendaraan simulasi | 1 |
| Perangkat QA | 1 |
| Perjalanan QA selesai/dibatalkan | 2 |
| Target snapshot QA | 4 |
| Pesan GPS QA | 6 |
| Prediksi ETA | 0 |

Cadangan baris terkait dibuat secara lokal dalam file `.tmp` yang diabaikan Git.
Setelah commit transaksi, armada yang tersisa adalah **PMT-TEST-001**, terhubung
ke perangkat fisik **PMT-001**. Data perangkat fisik tetap dipertahankan.

Pembersihan ini adalah perubahan **data lokal**, sehingga tidak menghasilkan diff
kode dan tidak menghapus data pada database milik anggota lain melalui `git pull`.
Modul, endpoint, migrasi, serta dokumentasi PM_10 tetap digunakan oleh aplikasi.
Kredensial, file environment asli, cadangan database, dan koordinat mentah tidak
ditambahkan ke commit laporan ini.
