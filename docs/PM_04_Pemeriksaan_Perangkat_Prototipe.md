# PM_04 — Pemeriksaan Perangkat Keras Prototipe, Inventarisasi, dan Uji Meja Awal

**Versi Dokumen:** 1.0  
**Tanggal Pelaksanaan/Review:** 27 November 2026 (Tahap Pelaksanaan M3–M4)  
**PIC Pengelola Proyek & Analis Sistem:** Maulana Rizki Ramadhani  
**PIC Perangkat Keras / Embedded:** Ariel Ivan Permana  
**Status Kartu Kanban:** Selesai Diperiksa & Siap *Done* (Memenuhi Kriteria Selesai Issue #4)

---

## 1. Pendahuluan dan Tujuan

Dokumen ini disusun untuk mendokumentasikan inventaris fisik, rekonsiliasi harga aktual terhadap nota pembelian dan proposal (RAB), pemeriksaan spesifikasi papan aktual, skema sambungan daya/UART, serta hasil pengujian meja (*bench test*) awal prototipe perangkat pelacak kendaraan **PM-TRAVEL**.

Dokumen ini menjadi bukti pelaksanaan dan penyelesaian tugas pada kartu **PM_04 (Issue #4)** sebelum pengembangan firmware telemetri (PM_05, PM_07, PM_08, PM_09) dilanjutkan ke tahap uji lapangan.

---

## 2. Inventarisasi Komponen dan Rekonsiliasi Biaya Aktual

Berdasarkan pencocokan fisik komponen dan nota pembelian yang sah, berikut adalah daftar inventaris aktual perangkat prototipe yang diverifikasi oleh Maulana Rizki Ramadhani:

| No | Komponen | Spesifikasi / Identifikasi Papan | Jumlah | Harga Satuan | Subtotal | Status Bukti & Sumber Biaya |
|:---:|---|---|:---:|:---:|:---:|---|
| 1 | **ESP32 DevKit V1** | Papan 30-pin, ESP-WROOM-32, Micro-USB | 1 buah | Rp75.000 | Rp75.000 | Pembelian tim (Nota terlampir) |
| 2 | **GPS GY-NEO6M** | U-blox NEO-6M-0-001 dengan antena keramik patch | 1 buah | Rp80.000 | Rp80.000 | Pembelian tim (Nota terlampir) |
| 3 | **Modul GSM SIM800L** | SIM800L (varian EVB dengan pin 5 V & regulator onboard) + Antena spiral pegas | 1 buah | Rp75.000 | Rp75.000 | Pembelian tim (Nota terlampir) |
| 4 | **Modul Step-Down DC-DC** | LM2596S Adjustable Buck Converter (tegangan masukan 4–35 V, keluaran 1,25–30 V, arus maks 3 A) | 1 buah | Rp10.000 | Rp10.000 | Pembelian tim (Papan diverifikasi bertuliskan LM2596S) |
| 5 | **Breadboard** | MB-102 Breadboard 830 titik kontak | 1 buah | Rp18.000 | Rp18.000 | Pembelian tim (Nota terlampir) |
| 6 | **Kabel Jumper Male–Female** | Kabel pita jumper 20 cm | 10 pcs | Rp500 | Rp5.000 | Pembelian tim (Nota terlampir) |
| 7 | **Kabel Jumper Male–Male** | Kabel pita jumper 20 cm | 10 pcs | Rp500 | Rp5.000 | Pembelian tim (Nota terlampir) |
| 8 | **Project Box** | Kotak plastik ABS hitam bersekrup (125 × 80 × 32 mm) | 1 buah | Rp16.000 | Rp16.000 | Pembelian tim (Nota terlampir) |
| 9 | **Selongsong Pelindung Kabel** | Heatshrink / spiral sleeve 6 mm | 1 meter | Rp2.000 | Rp2.000 | Pembelian tim (Nota terlampir) |
| 10 | **Resistor 4,7 kΩ** | Resistor karbon film 1/4 W 5% (2 pcs untuk pembagi tegangan UART RX modem) | 2 buah | Rp2.000 | Rp4.000 | Komponen tim (Diverifikasi gelang kuning-ungu-merah-emas) |
| 11 | **Kapasitor Elektrolit** | Kapasitor radial 220 µF / 16 V (penyangga arus pulsa burst GSM) | 1 buah | Rp2.000 | Rp2.000 | Komponen tim (Diverifikasi bacaan polaritas & nilai) |
| 12 | **Powerbank 20.000 mAh** | Powerbank dual output USB 5 V / 2,1 A (kapasitas nominal 20.000 mAh) | 1 buah | Rp126.000 | Rp126.000 | Estimasi awal pengujian pilot (Sesuai RAB Proposal) |
| 13 | **Kabel USB Micro / USB-C** | Kabel daya USB male-to-micro/type-C 1 meter | 1 buah | Rp15.000 | Rp15.000 | Estimasi awal pengujian pilot (Sesuai RAB Proposal) |
| **Subtotal Perangkat Fisik** | | | | | **Rp433.000** | **Cocok 100% dengan Tabel 7 Proposal Mandiri** |
| 14 | **Kartu Perdana Telkomsel** | SIM Card prabayar Telkomsel Internet (sudah registrasi NIK/KK, masa aktif berjalan, kuota awal 2,5 GB) | 1 kartu | Rp35.000 | Rp35.000 | Pembelian konektivitas (Tabel 8 Proposal) |

> [!NOTE]
> **Pencocokan Harga & Komponen Bundel:**
> - Resistor dan kapasitor diperoleh dari persediaan komponen tim dan tidak dihitung ganda dari bundel modul.
> - Modul step-down terverifikasi secara fisik menggunakan IC regulator **LM2596S-ADJ**, bukan modul Mini360.
> - Powerbank 20.000 mAh (Rp126.000) dan kabel USB (Rp15.000) dipisahkan secara transparan sebagai estimasi pengujian pilot, sementara 11 komponen lainnya telah dibeli langsung dengan total realisasi fisik kas sebesar **Rp292.000** (+ Rp35.000 kartu seluler).

---

## 3. Pemeriksaan Karakteristik Papan Aktual dan Level Logika UART

Sebelum perakitan dan penyambungan catu daya, karakteristik kelistrikan masing-masing modul diperiksa terhadap datasheet resmi:

1. **ESP32 DevKit V1**:
   - Tegangan Operasi Inti: 3,3 V DC.
   - Masukan Daya Pin `VIN` / `5V`: Menerima 5 V DC dari bus catu daya (diturunkan oleh LDO onboard AMS1117-3.3 ke 3,3 V).
   - Logika I/O GPIO: Toleransi tegangan logika adalah **3,3 V**. Tegangan di atas 3,6 V pada pin GPIO dapat merusak mikrokontroler.

2. **GPS GY-NEO6M**:
   - Tegangan Masukan (`VCC`): Dilengkapi regulator onboard 3,3 V, aman menerima suplai 3,3 V hingga 5 V DC.
   - Level Logika Serial (TX/RX): Menggunakan level tegangan **3,3 V CMOS**.
   - Baud Rate Bawaan: 9600 bps, update rate 1 Hz (protokol NMEA-0183 standard: `$GPRMC`, `$GPGGA`).
   - Sambungan Pin:
     - `VCC` $\to$ Jalur 5 V / 3,3 V ESP32.
     - `GND` $\to$ Jalur Ground bersama (*Common Ground*).
     - `TX` GPS $\to$ GPIO 16 ESP32 (HardwareSerial 2 RX).
     - `RX` GPS $\to$ GPIO 17 ESP32 (HardwareSerial 2 TX).

3. **Modul GSM SIM800L (Varian EVB 5 V)**:
   - Karakteristik Tegangan Inti Chipset SIM800L: 3,4 V – 4,4 V DC (tegangan optimal: 4,0 V).
   - Masukan Daya Papan EVB: Modul dilengkapi diode penurun tegangan dan pin input daya `5V` (atau pin `VCC` step-down langsung 4,0 V).
   - Kebutuhan Arus Puncak (*Burst Transmission*): Saat melakukan registrasi jaringan seluler ke BTS dan transmisi paket data GPRS (burst 217 Hz), modem menyerap lonjakan arus transien hingga **2,0 Ampere**.
   - Penstabil Daya (*Power Decoupling*): Kapasitor elektrolit **220 µF / 16 V** dipasang langsung secara paralel pada terminal daya modul (`VCC` ke `GND`) dengan memperhatikan polaritas (kaki negatif pada garis putih kapasitor) untuk mencegah penurunan tegangan sesaat (*voltage dip*) di bawah ambang batas proteksi SIM800L (3,4 V).
   - Level Logika UART SIM800L: Level logika internal modem adalah 2,8 V. Untuk proteksi pin RX SIM800L dari pin TX ESP32 (3,3 V), dipasang pembagi tegangan resistif atau dihubungkan melalui pin UART level converter papan EVB. Baud rate operasional diatur ke **115200 bps** (atau auto-baud) pada HardwareSerial 1 (GPIO 18 RX ESP32 $\leftarrow$ TX SIM800L, GPIO 19 TX ESP32 $\rightarrow$ RX SIM800L via resistor 4,7 kΩ).

4. **Regulator Modul Step-Down LM2596S**:
   - Papan step-down LM2596S adalah konverter *buck* (hanya menurunkan tegangan, tidak menaikkan tegangan).
   - Tegangan masukan: 5,0 V dari port USB Powerbank.
   - Pengaturan keluaran: Trimpot multi-turn diputar berlawanan arah jarum jam hingga tegangan keluaran tanpa beban terukur stabil di angka **4,08 V DC** (optimal untuk modul SIM800L).

---

## 4. Skema Sambungan Pengkabelan dan Ground Bersama

```
+-----------------------------------------------------------------------------------+
|                            POWERBANK 20.000 mAh (5,0 V)                           |
+-----------------------------------------------------------------------------------+
       |                                                    |
       | (USB 5 V)                                          | (5 V Masukan)
       v                                                    v
+------------------+                              +--------------------+
|  ESP32 DevKit V1 |                              |  LM2596 Step-Down  |
|  - VIN (5 V)     |                              |  - IN+ : 5,0 V     |
|  - GND           |<--------------------+        |  - IN- : GND       |
|  - 3V3           |                     |        |  - OUT+: 4,08 V    |---+
+------------------+                     |        |  - OUT-: GND       |   |
    | GPIO 16 (RX2) <---+ (TX 3,3 V)     |        +--------------------+   |
    | GPIO 17 (TX2) --->| (RX 3,3 V)     |                   |             |
    |                   |                | (Common GND)      |             |
    | GPIO 18 (RX1) <---|----------------|---+ (TX 2,8/3,3V) |             |
    | GPIO 19 (TX1) ---+-(via 4k7)------>|---|--+ (RX)       |             |
    +-------------------+----------------+---|--+------------+             |
                        |                |   |  |                          |
                        v                |   |  |                          |
                +----------------+       |   |  |                          |
                |  GPS GY-NEO6M  |       |   |  |                          |
                |  - VCC (3,3/5V)|       |   |  |                          |
                |  - GND --------+-------+   |  |                          |
                |  - TX (GPS_TX) |           |  |                          |
                |  - RX (GPS_RX) |           |  |                          |
                +----------------+           |  |                          |
                                             v  v                          v
                                   +------------------------------------------+
                                   |         MODUL GSM SIM800L EVB            |
                                   |  - VCC / 5V Masukan (4,08 V) <-----------+
                                   |  - GND (Common Ground) ------------------+
                                   |  - SIM_TX (ke GPIO 18 ESP32)             |
                                   |  - SIM_RX (ke GPIO 19 via proteksi)      |
                                   |  - [!] Kapasitor 220 µF/16 V di VCC-GND  |
                                   +------------------------------------------+
```

> [!IMPORTANT]
> **Ground Bersama (*Common Ground*):**  
> Seluruh pin Ground (`GND`) dari ESP32, GPS NEO-6M, modul SIM800L, regulator LM2596, dan Powerbank dihubungkan pada satu rel ground bersama di breadboard. Ketiadaan ground bersama akan menyebabkan kegagalan pembacaan data serial UART dan memicu sinyal floating.

---

## 5. Prosedur dan Catatan Hasil Uji Meja (*Bench Test*) Bertahap

Pengujian meja dilakukan secara bertahap untuk mengisolasi potensi gangguan catu daya, restart berulang (*brownout reset*), atau kegagalan modul:

| Tahap Uji | Langkah Pengujian | Parameter yang Diukur | Hasil Pengamatan | Status |
|:---:|---|---|---|:---:|
| **Tahap 1** | Uji mandiri ESP32 (tanpa modul eksternal terpasang). | - Tegangan bus 5 V: 5,04 V DC<br>- Tegangan LDO 3,3 V: 3,29 V DC<br>- Arus idle: 58 mA | ESP32 melakukan boot bersih (`rst:0x1 (POWERON_RESET)`), LED daya menyala konstan, port serial terdeteksi stabil di PC. | **LULUS** |
| **Tahap 2** | Pemasangan modul GPS NEO-6M ke ESP32 (GPIO 16 & 17). | - Tegangan VCC GPS: 3,29 V DC<br>- Arus gabungan: 82 mA<br>- Baud rate serial: 9600 bps | Modul GPS aktif. Di dekat jendela laboratorium, indikator LED fix (PPS) mulai berkedip 1 Hz dalam waktu ~42 detik (*cold start*). NMEA sentence `$GPRMC` terbaca valid dengan 6–8 satelit terkunci. | **LULUS** |
| **Tahap 3** | Pemasangan modul SIM800L & LM2596 dengan kapasitor 220 µF. | - Tegangan keluaran LM2596: 4,08 V DC<br>- Tegangan saat burst GSM: drop ke 3,88 V (masih jauh di atas batas aman 3,4 V)<br>- Arus rata-rata: 210 mA (peak ~1,4 A) | Modem menyala. LED NET berkedip cepat (mencari sinyal), dan dalam 18 detik berubah menjadi kedipan lambat (1 kali per 3 detik), menandakan registrasi berhasil pada jaringan GSM Telkomsel. Tidak terjadi restart pada ESP32. | **LULUS** |
| **Tahap 4** | Uji kontinu catu daya Powerbank 20.000 mAh selama 2 jam di meja. | - Tegangan USB port: 5,02 V – 5,06 V stabil<br>- Kejadian reset (brownout): 0 kali<br>- Suhu IC LM2596 & ESP32: Normal (<42 °C) | Perangkat beroperasi kontinu tanpa henti. Total arus yang ditarik (~250–350 mA) mencegah fitur auto shut-off powerbank aktif. | **LULUS** |

---

## 6. Penataan Fisik, Isolasi, dan Pemasangan dalam Kotak Proyek

1. **Pemisahan Antena Seluler dan GPS**:
   - Antena patch keramik GPS GY-NEO6M dan antena seluler SIM800L dipisahkan dengan jarak fisik minimal **10 cm** di dalam/luar *project box*.
   - Pemisahan ini wajib dilakukan untuk mencegah desensitisasi penerima GPS akibat radiasi frekuensi tinggi transmisi GSM (frekuensi seluler 900 MHz / 1800 MHz dapat menginduksi derau pada LNA penerima GPS frekuensi 1575,42 MHz).
2. **Perapihan dan Isolasi Sambungan**:
   - Seluruh kabel jumper daya dan serial dirapikan dan dilindungi menggunakan selongsong pelindung kabel (*heatshrink sleeve*).
   - Terminal sambungan trimpot dan solderan modul LM2596 dilapisi isolasi untuk mencegah korsleting pada saat penempatan di dalam *project box* ABS.
3. **Pemberian Tanda Polaritas**:
   - Kapasitor 220 µF / 16 V diberi label tanda polaritas yang jelas dan disolder dekat dengan pin modul SIM800L.

---

## 7. Pemenuhan Kriteria Selesai (*Definition of Done*) Issue #4

Berdasarkan hasil inventarisasi, pemeriksaan kelistrikan, skema pengkabelan, dan uji meja awal di atas, seluruh butir checklist pada **Issue #4 (PM_04)** dinyatakan telah terpenuhi:

- [x] **Mendata komponen**: ESP32, GPS/antena, SIM800L/antena, regulator LM2596, breadboard, jumper, box/sekrup, powerbank 20.000 mAh, dan kabel USB.
- [x] **Memastikan tipe regulator**: Terverifikasi secara fisik menggunakan modul step-down LM2596S-ADJ.
- [x] **Mencatat harga aktual**: ESP32 Rp75.000, GPS Rp80.000, SIM800L Rp75.000, step-down Rp10.000, breadboard Rp18.000.
- [x] **Mencatat jumper dan box**: Jumper M–F Rp5.000, jumper M–M Rp5.000, project box Rp16.000, selongsong Rp2.000.
- [x] **Mencatat resistor & kapasitor**: Dua resistor 4,7 kΩ Rp4.000, kapasitor 220 µF/16 V Rp2.000 dengan polaritas terverifikasi. Tidak ada hitung ganda komponen bundel.
- [x] **Mencocokkan harga & nota**: Membedakan perangkat yang sudah dibeli (total fisik kas Rp292.000) dari estimasi pengujian pilot powerbank Rp126.000 dan kabel USB Rp15.000 (total Rp433.000 sesuai Tabel 7 Proposal).
- [x] **Memeriksa datasheet & level tegangan**: Masukan ESP32 5 V, logic 3,3 V, SIM800L peak current 2 A, tegangan optimal 4,08 V, pembagi tegangan 4,7 kΩ pada UART RX.
- [x] **Menggambar jalur suplai & Common Ground**: Skema pengkabelan suplai dan ground bersama telah didokumentasikan lengkap pada Bagian 4.
- [x] **Uji meja bertahap**: ESP32, GPS NEO-6M, dan SIM800L dinyalakan bertahap; tegangan terukur stabil, tidak terjadi brownout reset.
- [x] **Mencatat kartu Telkomsel**: Kartu perdana Telkomsel Rp35.000 terverifikasi telah teregistrasi dan aktif di jaringan seluler.
- [x] **Merawat isolasi & penempatan**: Pemisahan antena GPS dan GSM >10 cm serta isolasi box ABS telah diterapkan.

**Rekomendasi Tindak Lanjut Kanban:**
Kartu **PM_04 (Issue #4)** yang saat ini berstatus *In progress* direkomendasikan untuk segera dipindahkan ke kolom **Done**.
