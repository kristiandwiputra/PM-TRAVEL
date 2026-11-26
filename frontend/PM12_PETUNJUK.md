# PM_12 — Dashboard Operator React + API PM_10

## Yang dikerjakan

- Rute koridor **Tanjung Karang → Hajimena → Kotabumi**. Titik awal Tanjung Karang memakai koordinat sekitar stasiun sebagai referensi; validasi titik naik sebenarnya dengan operator.
- Login admin/operator memakai `POST /api/auth/login`, JWT hanya di memori browser (bukan localStorage).
- Kendaraan: `GET /api/vehicles/`, posisi terbaru: `GET /api/vehicles/{vehicle_id}/location/latest`, perjalanan: `GET /api/trips/`, target: `GET /api/route-targets/`.
- Polling 5 detik, status koneksi server dan status GPS terpisah, kecepatan terakhir, waktu GPS, waktu pesan diterima, serta usia data.
- Saat backend offline tampilkan pesan error tanpa koordinat kendaraan palsu. ETA tetap **belum tersedia (PM_15)**.
- Garis antartitik hanya **koridor referensi**, bukan jalur jalan sesungguhnya. Animasi denyut hanya visual pada titik GPS aktual, tidak membuat koordinat baru.

## Instalasi pada laptop Putra

1. Cadangkan file frontend bila sudah dimodifikasi sendiri.
2. Ekstrak ZIP ke folder `frontend/` dan setujui penggantian berkas dalam `src/`, `index.html`, serta `vite.config.js`.
3. Terminal pada `frontend/`:

```powershell
Copy-Item .env.example .env.local
```

4. Ubah `frontend/.env.local` agar `PM12_BACKEND_ORIGIN` sesuai port FastAPI. Default `http://127.0.0.1:8001`; jika FastAPI di port 8000, ubah port.
5. Dari folder `backend/`, jalankan API beserta penerima MQTT:

```powershell
$pmPython = Join-Path $env:LOCALAPPDATA 'PM-TRAVEL\backend-venv\Scripts\python.exe'
& $pmPython run_live.py
```

Jika FastAPI sudah berjalan, jalankan `& $pmPython mqtt_subscriber.py` di terminal backend lain.
Frontend membutuhkan keduanya untuk memantau alat: API membaca database, sedangkan
penerima MQTT menyimpan pesan alat. Kemudian pada terminal `frontend/`:

```powershell
npm install leaflet react-leaflet lucide-react
npm run lint
npm run build
npm run dev
```

6. Buka `http://localhost:5173/`; login menggunakan akun admin/operator PM_10. Setelah mengubah `.env.local`, restart `npm run dev`.

## Bukti yang perlu dikumpulkan

Bukti pemulihan penerimaan alat, hasil regresi, dan pembersihan data QA pada
27 November 2026 tercatat dalam [laporan integrasi, bagian 5](../docs/PM_12_Integrasi_Dashboard_dan_Operator.md#5-pemulihan-live-gps-dan-pembersihan-data-qa--27-november-2026).

- Screenshot tiga titik koridor di peta.
- Login dan data kendaraan dari API, termasuk `observed_at` serta `received_at`.
- Cocokkan `vehicle_id` dan koordinat dengan Swagger PM_10 serta baris `gps_positions`. Data QA lokal jangan diklaim sebagai lokasi fisik jika belum diverifikasi.
- Output `npm run lint` dan `npm run build`.

## Batasan

- PM_15 belum mengintegrasikan model ETA; tidak menampilkan angka ETA buatan.
- API internal hanya dapat dibaca setelah login. Jangan menambahkan token/password statis di file frontend.
- Masih tahap lokal, belum deployment produksi (HTTPS/Nginx/IDOR/PM_17).
- Bila bentuk respons JSON API berbeda, penyesuaian `src/api.js` harus mengikuti `docs/PM10_openapi.json` dan `docs/PM10_contoh_respons.json` dari repo lokal.
- Server tile OpenStreetMap publik memiliki aturan penggunaan; untuk trafik produksi gunakan penyedia tile sesuai kebijakan.

## Memastikan data alat terkini

- Alat `PMT-001` terhubung ke kendaraan `PMT-TEST-001` pada database lokal yang diperiksa.
- `Server terhubung` membuktikan API dapat dihubungi. Posisi live ditentukan oleh
  `observed_at`, usia GPS, dan pesan perangkat terakhir; polling tidak meremajakan posisi lama.
- Marker tidak terkini diberi warna berbeda dan tidak berdenyut seperti posisi segar.
  Kecepatan lama ditandai sebagai kecepatan terakhir.
- API yang gagal menampilkan error; tidak ada kendaraan, riwayat, kode publik, atau
  aksi perjalanan simulasi yang menggantikan respons server.
- Data simulasi `PM10-B8893AC2` sudah dibersihkan dari database lokal; API PM_10
  dan data alat fisik tetap tersedia. Penghapusan baris database tidak didistribusikan melalui Git.

