# PM_12 — Implementasi Dashboard Pemantauan dan Panel Operator

**Versi Dokumen:** 1.0  
**Tanggal:** 27 November 2026  
**PIC Implementasi:** Maulana Rizki Ramadhani (bersama tim frontend/UI-UX)  
**Acuan Issue:** [Issue #13 — PM_12](https://github.com/kristiandwiputra/PM-TRAVEL/issues/13)  
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
