# PM_12 — Dashboard Operator React + API PM_10

## Yang dikerjakan

- Rute koridor **Tanjung Karang → Hajimena → Kotabumi**. Titik awal Tanjung Karang memakai koordinat sekitar stasiun sebagai referensi; validasi titik naik sebenarnya dengan operator.
- Login admin/operator memakai `POST /api/auth/login`, JWT hanya di memori browser (bukan localStorage).
- Kendaraan: `GET /api/vehicles/`, posisi terbaru: `GET /api/vehicles/{vehicle_id}/location/latest`, perjalanan: `GET /api/trips/`, target: `GET /api/route-targets/`.
- Polling 10 detik, status koneksi dan status GPS, kecepatan, waktu GPS, waktu backend menerima data.
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
5. Jalankan FastAPI di terminal lain, kemudian pada terminal `frontend/`:

```powershell
npm install leaflet react-leaflet lucide-react
npm run lint
npm run build
npm run dev
```

6. Buka `http://localhost:5173/`; login menggunakan akun admin/operator PM_10. Setelah mengubah `.env.local`, restart `npm run dev`.

## Bukti yang perlu dikumpulkan

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

