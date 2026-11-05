# Kontrak Telemetri GPS PM-TRAVEL

## 1. Satuan Data
- Latitude dan longitude: derajat desimal.
- Kecepatan: kilometer per jam (km/jam).
- Waktu GPS: UTC dengan format ISO 8601.
- Status GPS: boolean (true/false).
- Jumlah satelit: bilangan bulat.
- HDOP: angka desimal, opsional.

## 2. Ketentuan Waktu
- observed_at: waktu pengamatan dari GPS.
- received_at: waktu penerimaan dari backend.
- Seluruh timestamp disimpan dalam UTC.
- Dashboard menampilkan waktu dalam WIB.

## 3. Ketentuan GPS Tidak Valid
- gps_valid bernilai false.
- Koordinat yang tidak tersedia diisi null.
- Waktu GPS yang tidak valid diisi null.
- Data tidak valid tidak memperbarui posisi terakhir.
- Backend tetap mencatat waktu penerimaan.

## 4. Data Opsional
- satellites: jumlah satelit.
- hdop: indikator ketelitian GPS.

## 5. Penanganan Pesan Terlambat
- Waktu pengamatan asli tidak boleh diubah.
- Data lama tidak boleh menggantikan posisi terbaru.
- Pesan tetap dapat disimpan sebagai riwayat.

## 5.1 Contoh Pesan GPS Valid
{
  "device_id": "PMT-001",
  "boot_id": "B001",
  "sequence_id": 1,
  "message_id": "PMT-001-B001-1",
  "trip_id": "TRIP-001",
  "observed_at": "2026-11-03T16:01:50Z",
  "latitude": -5.345293,
  "longitude": 105.241603,
  "speed_kmh": 2.9,
  "gps_valid": true,
  "satellites": 10,
  "hdop": 1.2
}

## 5.2 Contoh Pesan GPS Tidak Valid
{
  "device_id": "PMT-001",
  "boot_id": "B001",
  "sequence_id": 2,
  "message_id": "PMT-001-B001-2",
  "trip_id": "TRIP-001",
  "observed_at": null,
  "latitude": null,
  "longitude": null,
  "speed_kmh": null,
  "gps_valid": false,
  "satellites": 0,
  "hdop": null
}

### 5.3 Ketentuan Tambahan

1. **boot_id**
   - Digunakan untuk mengidentifikasi sesi perangkat.
   - Dibuat ketika ESP32 memulai sesi baru.
   - Harus membedakan sesi sebelum dan sesudah perangkat restart.

2. **sequence_id**
   - Nomor urut pesan GPS.
   - Bertambah setiap perangkat menghasilkan pesan baru.
   - Tidak berubah ketika pesan yang sama dikirim ulang.

3. **message_id**
   - Identitas unik untuk setiap pesan.
   - Digunakan backend untuk mendeteksi pesan duplikat.
   - Tetap sama ketika perangkat mengirim ulang pesan.

4. **trip_id**
   - Identitas perjalanan kendaraan.
   - Menghubungkan data GPS dengan perjalanan yang sesuai.
   - Contoh: TRIP-001.

5. **observed_at**
   - Waktu saat GPS melakukan pengamatan.
   - Menggunakan UTC dengan format ISO 8601.
   - Contoh: 2026-11-03T16:01:50Z.

6. **received_at**
   - Waktu saat backend menerima pesan MQTT.
   - Dibuat oleh backend, bukan ESP32.
   - Disimpan dalam UTC.

7. **Nilai null**
   - Menunjukkan data yang tidak tersedia.
   - Tidak boleh otomatis diganti dengan angka nol.
   - Koordinat null tidak digunakan untuk menghitung ETA.

8. **Pengiriman Ulang**
   - Pesan yang dikirim ulang mempertahankan identitas aslinya.
   - Backend harus mencegah penyimpanan duplikat.
   - Data lama tidak boleh menggantikan posisi terbaru.

## 6. Rancangan Komunikasi MQTT

### 6.1 Topik MQTT

Setiap perangkat menggunakan topik berdasarkan device_id.

Topik telemetri:
pmtravel/{device_id}/telemetry

Topik ACK:
pmtravel/{device_id}/ack

Contoh perangkat PMT-001:

Telemetri:
pmtravel/PMT-001/telemetry

ACK:
pmtravel/PMT-001/ack

### 6.2 Hak Akses

Perangkat ESP32:
- Publish ke topik telemetri miliknya.
- Subscribe ke topik ACK miliknya.
- Tidak dapat mengakses topik perangkat lain.

Backend:
- Subscribe ke seluruh topik telemetri yang diizinkan.
- Publish ACK ke perangkat yang sesuai.

### 6.3 Kredensial

- Setiap perangkat memiliki kredensial tersendiri.
- Kredensial backend dipisahkan dari perangkat.
- Kredensial tidak disimpan langsung di repository.
- Identitas perangkat diverifikasi menggunakan kredensial dan topik MQTT.

### 6.4 MQTT QoS

- Telemetri menggunakan QoS 1.
- ACK aplikasi menggunakan QoS 1.
- Retained message dinonaktifkan untuk telemetri dan ACK.
- Backend menangani kemungkinan pesan duplikat.

### 6.5 Keamanan Koneksi

- Broker menggunakan autentikasi.
- ACL membatasi akses setiap perangkat.
- TLS direncanakan untuk melindungi komunikasi.
- Dukungan TLS pada SIM800L harus diuji sebelum dinyatakan berhasil.
- Konfigurasi final disesuaikan dengan kemampuan modem dan hasil pengujian.

### 6.6 Ketentuan ACK

Backend mengirim ACK aplikasi setelah transaksi database berhasil.

Status ACK:
- stored: pesan baru berhasil disimpan.
- duplicate: pesan identik sudah tersimpan sebelumnya.

ACK harus mencantumkan message_id yang sesuai.

Jika penyimpanan gagal atau terdapat konflik identitas,
backend tidak mengirim ACK sukses.

## 7. Rancangan ACK Aplikasi

### 7.1 Tujuan ACK

ACK (Acknowledgement) merupakan pesan konfirmasi dari backend
kepada perangkat ESP32 setelah data telemetri berhasil diproses.

ACK aplikasi berbeda dengan PUBACK pada protokol MQTT.

PUBACK menunjukkan penerimaan pesan pada tingkat protokol MQTT,
sedangkan ACK aplikasi menunjukkan hasil penyimpanan pada database.

### 7.2 Alur Pengiriman ACK

1. ESP32 membaca data dari GPS.
2. ESP32 membuat pesan telemetri dengan message_id unik.
3. SIM800L mengirim pesan melalui MQTT.
4. MQTT broker meneruskan pesan kepada backend.
5. Backend memvalidasi identitas perangkat dan isi pesan.
6. Backend memeriksa apakah message_id sudah tersimpan.
7. Backend menjalankan transaksi penyimpanan.
8. Setelah transaksi berhasil, backend mengirim ACK aplikasi.
9. ESP32 mencocokkan ACK dengan message_id yang dikirim.
10. Pesan yang sudah dikonfirmasi dapat dihapus dari buffer perangkat.

### 7.3 Topik ACK

Format topik:

pmtravel/{device_id}/ack

Contoh:

pmtravel/PMT-001/ack

Setiap perangkat hanya diperbolehkan menerima ACK miliknya.

### 7.4 Format ACK

ACK memiliki field wajib:

- device_id: identitas perangkat.
- message_id: identitas pesan yang dikonfirmasi.
- status: hasil pemrosesan pesan.

Status ACK yang digunakan:

1. stored
   Pesan baru berhasil disimpan ke database.

2. duplicate
   Pesan identik sudah tersimpan sebelumnya.

ACK hanya dikirim setelah transaksi database dinyatakan berhasil.

### 7.5 Contoh ACK Stored

```json
{
  "device_id": "PMT-001",
  "message_id": "PMT-001-B001-1",
  "status": "stored"
}
```

Status stored berarti backend berhasil menyimpan pesan baru
ke database.

### 7.6 Contoh ACK Duplicate

```json
{
  "device_id": "PMT-001",
  "message_id": "PMT-001-B001-1",
  "status": "duplicate"
}
```

Status duplicate berarti pesan dengan identitas dan isi yang sama
sudah tersimpan sebelumnya.

Backend tidak membuat baris telemetri baru untuk pesan duplikat.

### 7.7 Ketentuan Keamanan dan Konsistensi

1. Backend harus memvalidasi device_id berdasarkan kredensial
   dan topik MQTT yang digunakan.

2. message_id digunakan untuk mendeteksi pengiriman berulang.

3. Pengiriman ulang harus mempertahankan message_id,
   observed_at, dan isi pesan aslinya.

4. Pesan dengan message_id sama tetapi isi berbeda
   dinyatakan sebagai konflik.

5. Konflik identitas tidak menghasilkan ACK sukses.

6. Kegagalan penyimpanan database tidak menghasilkan ACK sukses.

7. ACK stored hanya dikirim setelah transaksi database
   berhasil di-commit.

8. ACK duplicate hanya dikirim jika pesan yang sama
   sudah dipastikan tersimpan.

9. Pesan lama tidak boleh menggantikan posisi terbaru kendaraan.

10. Backend mencatat kegagalan pemrosesan untuk kebutuhan
    pemeriksaan dan pengujian.

### 7.8 Ketentuan Pengiriman Ulang

Jika ESP32 belum menerima ACK yang sesuai:

1. Pesan tetap berada dalam buffer perangkat.
2. ESP32 dapat mencoba mengirim ulang pesan.
3. message_id tidak boleh berubah saat pengiriman ulang.
4. Backend harus dapat mengenali pesan duplikat.
5. Setelah menerima ACK stored atau duplicate,
   perangkat dapat menghapus pesan dari buffer.

Waktu tunggu dan interval pengiriman ulang ditetapkan
pada rancangan buffer dan retry di checklist berikutnya.

### 7.9 Konfigurasi MQTT ACK

- QoS: 1.
- Retained: false.
- Topik ACK terpisah untuk setiap perangkat.
- Perangkat hanya subscribe ke topik ACK miliknya.
- Backend memiliki izin publish ke topik ACK yang sesuai.

### 7.10 Pengujian ACK

Pengujian yang harus dilakukan:

1. Pesan baru berhasil disimpan menghasilkan ACK stored.
2. Pesan identik yang dikirim ulang menghasilkan ACK duplicate.
3. Pesan dengan message_id sama tetapi isi berbeda ditolak.
4. Kegagalan database tidak menghasilkan ACK sukses.
5. ACK yang tidak sesuai message_id diabaikan perangkat.
6. Pesan tetap dapat dikirim ulang jika ACK tidak diterima.
7. Pesan duplikat tidak menambah jumlah baris GPS di database.

## 8. Rancangan Buffer dan Pengiriman Ulang

### 8.1 Tujuan Buffer

Buffer digunakan untuk menampung data GPS sementara
ketika koneksi GPRS atau MQTT mengalami gangguan.

ESP32 tetap membaca data GPS meskipun koneksi terputus.

### 8.2 Kapasitas Buffer

- Media penyimpanan: RAM ESP32.
- Kapasitas awal: 60 pesan.
- Ukuran maksimal: 512 byte per payload.
- Interval pengambilan GPS: 10 detik.
- Metode penyimpanan: antrean FIFO.

Dengan interval 10 detik, kapasitas 60 pesan
setara dengan sekitar 10 menit data GPS.

Kapasitas ini hanya perkiraan berdasarkan interval
pengambilan yang konsisten.

### 8.3 Mekanisme Penyimpanan

1. ESP32 membaca data GPS.
2. ESP32 membuat pesan telemetri.
3. Setiap pesan memiliki message_id unik.
4. Pesan dimasukkan ke dalam buffer.
5. Jika MQTT tersedia, pesan dikirim ke broker.
6. Pesan tetap dipertahankan sampai ACK aplikasi diterima.
7. Setelah ACK stored atau duplicate diterima,
   pesan yang sesuai dihapus dari buffer.

### 8.4 Ketentuan Buffer Penuh

Jika buffer telah berisi 60 pesan dan data baru masuk:

1. Pesan paling lama dikeluarkan dari buffer.
2. Pesan baru dimasukkan ke buffer.
3. Jumlah pesan yang hilang dicatat.
4. Sistem tidak menganggap pesan yang dibuang
   sebagai pesan berhasil terkirim.

Mekanisme ini disebut drop-oldest.

### 8.5 Pengiriman Ulang

Jika koneksi MQTT terputus:

1. ESP32 tetap mengumpulkan data GPS.
2. Pesan disimpan selama kapasitas buffer tersedia.
3. ESP32 mencoba menghubungkan kembali koneksi.
4. Setelah terhubung, pesan dikirim berdasarkan urutan antrean.
5. Pesan yang belum memperoleh ACK dapat dikirim ulang.
6. message_id dan observed_at tidak berubah saat retry.
7. Pesan dihapus setelah ACK yang sesuai diterima.

Interval retry awal diusulkan 5 detik,
kemudian dapat ditingkatkan sampai maksimal 60 detik.

Nilai final disesuaikan dengan hasil pengujian SIM800L.

### 8.6 Pencatatan Kehilangan Pesan

ESP32 mencatat:

- Jumlah pesan yang dibuang akibat buffer penuh.
- Jumlah percobaan pengiriman ulang.
- Status koneksi MQTT.
- Nomor urut pesan untuk membantu mendeteksi kehilangan data.

Informasi tersebut digunakan untuk evaluasi
keandalan pengiriman telemetri.

### 8.7 Keterbatasan Buffer RAM

Buffer menggunakan RAM sehingga bersifat sementara.

Jika ESP32 kehilangan daya atau melakukan restart,
pesan yang belum tersimpan secara permanen dapat hilang.

Sistem tidak menjamin pemulihan pesan RAM setelah
perangkat kehilangan daya.

### 8.8 Batas Ukuran Payload

- Maksimal 512 byte per payload MQTT.
- Ukuran dihitung berdasarkan byte hasil encoding.
- Payload JSON dibuat ringkas.
- Pesan yang melebihi batas tidak boleh dimasukkan
  ke antrean pengiriman tanpa penanganan kesalahan.

### 8.9 Skenario Pengujian

1. MQTT aktif dan data terkirim normal.
2. MQTT terputus selama 1 menit.
3. MQTT terputus selama 5 menit.
4. MQTT terputus melebihi 10 menit.
5. Buffer mencapai kapasitas maksimal.
6. Koneksi pulih dan pesan dikirim ulang.
7. Pesan duplikat tidak tersimpan dua kali.
8. ESP32 restart ketika buffer masih berisi pesan.
9. Payload yang melebihi 512 byte ditangani.