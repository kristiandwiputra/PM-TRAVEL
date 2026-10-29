# PM_02 Kebutuhan dan Batasan Prototipe PM-TRAVEL

**Versi:** 0.2 — penyesuaian keputusan MEET_02 untuk review tim  
**Tanggal penyusunan draf:** 29 Oktober 2026  
**Tanggal pembaruan dokumen:** 30 Oktober 2026  
**PIC perencanaan sesuai proposal:** Maulana Rizki Ramadhani  
**Status:** Keputusan rencana diperbarui berdasarkan laporan pengguna dan catatan MEET_02; review akhir PM_02, jadwal, dan strategi data ETA masih perlu dilengkapi.  
**Acuan:** Proposal PM-TRAVEL Revisi Harga Aktual, Bab 1, Bab 4, dan Bab 6; Kanban PM_01–PM_19; perubahan kebutuhan yang dilaporkan pada MEET_02. Angka perjalanan dan UAT pada proposal/kartu yang masih memakai rencana sebelumnya perlu diselaraskan.  
**Catatan review:** [MEET_02 — Penyepakatan kebutuhan dan rencana kerja proyek](https://github.com/kristiandwiputra/PM-TRAVEL/issues/22).

Dokumen ini menyatukan kebutuhan dan batasan agar anggota tim mempunyai acuan yang sama saat membangun prototipe. Seluruh kriteria pengujian di sini merupakan target rencana. Pengujian perangkat, jaringan, sistem, model lokal, dan UAT belum dilaksanakan. Kolom hasil pengujian tidak diisi sebagai berhasil sebelum ada pengukuran.

**Perubahan utama:** pengiriman lokasi setiap 10 detik; tiga perjalanan uji lapangan; satu calon pengguna untuk UAT awal; titik naik hanya di tiga agen; serta retensi GPS mentah maksimal 90 hari setelah perjalanan. Jumlah perjalanan uji tidak otomatis menjadi jumlah atau pembagian data latih. Tanggal pembaruan dokumen bukan tanggal pelaksanaan meeting atau pengujian.

## 1. Pengguna, kendaraan, koridor, dan izin

### 1.1 Pengguna dan informasi yang diperlukan

| Pengguna | Informasi dan tindakan yang diperlukan | Batas akses |
| --- | --- | --- |
| Penumpang | Membuka tautan/kode perjalanan aktif; melihat peta, posisi terakhir, waktu pengamatan/usia data, status perjalanan/data, ETA Hajimena, dan ETA Kotabumi. | Tidak memakai akun operator; hanya melihat perjalanan aktif yang kodenya sah. Tidak mengakses riwayat GPS mentah atau fungsi pengelolaan. |
| Agen/operator | Login; mengelola kendaraan, pengaitan perangkat operasional, rute/target sesuai kewenangan; membuat/memulai trip, mencatat tiba, menyelesaikan trip; memantau posisi serta kondisi data dan melihat riwayat yang diizinkan. | Tidak memperoleh seluruh kewenangan administrator hanya karena dapat mengelola perjalanan. |
| Administrator teknis | Mengelola akun teknis/kredensial, memeriksa layanan, log dan last_seen, serta menjalankan retensi/penghapusan sesuai kebijakan. | Akses teknis dibatasi kepada pihak yang diberi kewenangan; tidak memerlukan dashboard pengelolaan versi model khusus. |

### 1.2 Objek dan arah perjalanan

- Objek pilot: **satu kendaraan travel**. Identitas unit dan pihak yang memberi izin dicatat setelah ditetapkan: [isi kode internal kendaraan dan pihak pemberi izin].
- Arah pengujian: **Tanjung Karang → Hajimena → Kotabumi**.
- Titik awal adalah Tanjung Karang; target ETA antara adalah Hajimena dan target ETA akhir adalah Kotabumi.
- Titik naik penumpang dibatasi pada agen Tanjung Karang, Hajimena, dan Kotabumi sesuai operasional travel. Ketentuan ini tidak menambah arah uji selain arah di atas.
- Penumpang boleh turun di titik lain. Prototipe belum menyediakan ETA untuk setiap titik turun; target ETA tetap Hajimena dan Kotabumi.
- Satu kendaraan hanya memiliki satu perjalanan aktif. Kedatangan di Hajimena tidak otomatis menyelesaikan perjalanan menuju Kotabumi.
- Pengujian armada fisik banyak kendaraan belum menjadi lingkup pilot. Simulasi beban harus disebut simulasi.

### 1.3 Referensi lokasi

Koordinat berikut berasal dari tautan Google Maps yang diberikan dalam perencanaan. Koordinat merupakan referensi awal dan **belum diverifikasi di lapangan**. Nama pada tabel mengikuti tautan yang diberikan dan tidak menyatakan kemitraan atau izin operasional sudah diperoleh.

| Fungsi | Referensi titik pada tautan | Latitude | Longitude | Status |
| --- | --- | --- | --- | --- |
| Awal | Karona Travel, Tanjung Karang | -5.4092744 | 105.2577497 | Referensi awal; belum diverifikasi di lapangan |
| Target ETA antara | Karona Shuttle Bus Travel, Hajimena | -5.3619361 | 105.2253941 | Referensi awal; belum diverifikasi di lapangan |
| Target ETA akhir | Karona Kotabumi | -4.8351362 | 104.8962439 | Referensi awal; belum diverifikasi di lapangan |

Lokasi acuan, aturan mencatat kedatangan, dan waktu tiba aktual dipastikan sebelum pengumpulan lokal PM_13. Jika titik berubah, catat versi/perubahannya agar label dataset tidak memakai target yang berbeda tanpa penjelasan.

### 1.4 Daftar izin dan koordinasi sebelum kegiatan lapangan

| Hal yang perlu dipastikan | Rencana penanggung jawab | Status dan bukti |
| --- | --- | --- |
| Persetujuan agen/pemilik dan pengemudi untuk membawa atau menempatkan perangkat pada satu kendaraan | Maulana bersama pihak travel | Belum dikonfirmasi; isi pihak pemberi izin, tanggal, dan bukti sesuai kenyataan |
| Jadwal, arah perjalanan, serta posisi perangkat/antena yang diperbolehkan | Maulana dan Ariel | Belum ditetapkan |
| Izin pencatatan lokasi, waktu tiba, dan dokumentasi yang diperlukan | Maulana bersama pihak terkait | Belum dikonfirmasi |
| Persetujuan calon peserta UAT dan dokumentasi sesi | Maulana bersama peserta yang bersedia | Belum dilaksanakan; jumlah/peran dikonfirmasi sebelum UAT |
| Kebutuhan administrasi kampus atau izin lokasi apabila dipersyaratkan pihak terkait | Maulana | Perlu dikonfirmasi; tidak dianggap otomatis wajib atau sudah diperoleh |

PM_02 mencatat kebutuhan izin, PIC, dan rencananya. Izin lapangan yang diperlukan harus benar-benar tersedia sebelum PM_13/PM_18 dilaksanakan.

## 2. Cakupan dan batas prototipe

### 2.1 Fungsi yang direncanakan

1. Pembacaan koordinat, waktu, kecepatan, serta validitas GPS.
2. Pengiriman berkala melalui SIM800L/GSM/GPRS dan MQTT.
3. Buffer terbatas, retry, ACK aplikasi setelah simpan, deduplikasi, serta penanganan data terlambat.
4. Penyimpanan dan API perjalanan, posisi, status data, jarak dengan metode yang dijelaskan, serta riwayat operator.
5. Dashboard penumpang dan panel operator dengan akses berbeda.
6. ETA dua target, perbandingan Random Forest Regressor/Gradient Boosting Regressor dengan baseline, serta fallback/unavailable sesuai kelayakan data.
7. Autentikasi/otorisasi, log teknis, pemantauan layanan, serta retensi/penghapusan.
8. Ekspor sederhana untuk pihak berwenang sebagai kebutuhan **Should**, jika dipilih dan memungkinkan.

**Must** berarti kebutuhan wajib dalam lingkup prototipe. **Should** berarti kebutuhan yang diupayakan setelah pekerjaan wajib; status belum diterapkannya tetap dilaporkan. Riwayat operator FR-19 dan retensi FR-16 merupakan Must; ekspor FR-17 merupakan Should.

### 2.2 Perangkat dan daya

- Rencana perangkat: ESP32, GPS GY-NEO6M beserta antena, SIM800L beserta antena, regulator bila diperlukan, serta komponen sambungan dan pelindung.
- Powerbank nominal **20.000 mAh** menjadi sumber daya pengujian.
- Tipe papan SIM800L, masukan daya, level UART, tipe regulator, dan kemampuan suplai masih diperiksa terhadap papan aktual pada PM_04. Spesifikasi rancangan pada SRS belum menjadi hasil pengukuran perangkat.
- Kapasitas nominal powerbank tidak dianggap otomatis membuktikan durasi operasi. Ketahanan minimal empat jam dan satu perjalanan diperiksa kemudian.

### 2.3 Di luar prototipe awal

- Pemesanan tiket dan pembayaran.
- Pemilihan titik naik bebas oleh penumpang dan ETA ke setiap titik turun. Titik naik tetap pada tiga agen; kebebasan turun merupakan operasional travel, bukan fitur pemesanan titik pada prototipe.
- Chat, aplikasi seluler native, serta optimasi rute otomatis.
- Pengelolaan armada fisik banyak kendaraan sebagai penerapan operasional penuh.
- Audit aktivitas pengguna yang lengkap dan dashboard pengelolaan versi model.
- Pemasangan permanen mengambil daya dari aki kendaraan; penggunaan powerbank tetap menjadi acuan pilot.

### 2.4 Keputusan tampilan dashboard

Susunan layar, warna, navigasi, dan komponen visual ditentukan melalui PM_11 bersama PIC frontend. Perubahan visual tidak otomatis mengubah kebutuhan informasi. Perubahan fitur atau hak akses ditinjau pada PM_02 dan diperbarui pada SRS/kartu terdampak.

### 2.5 Acuan layanan dan anggaran

Frontend statis direncanakan pada Cloudflare Pages. Broker MQTT, backend/API, basis data, dan layanan ETA berjalan pada VPS sesuai rancangan PM_03/PM_16; Cloudflare Pages tidak dianggap menyediakan mesin VPS atau broker MQTT. RAB acuan tetap **Rp1.676.400** dari proposal Revisi Harga Aktual. Pembaruan jumlah perjalanan dan peserta pada dokumen ini belum merupakan perhitungan ulang biaya atau bukti pengeluaran aktual.

## 3. Parameter waktu dan status data

| Parameter atau istilah | Definisi rencana |
| --- | --- |
| Interval telemetri | Ditetapkan nominal 10 detik antarjadwal pengiriman perangkat. Pembacaan GPS tetap berjalan; penjadwalan pengiriman tidak menghentikan pembacaan selama 10 detik. Ini belum merupakan janji data terlihat di dashboard setiap tepat 10 detik. |
| Polling dashboard | Nominal 5 detik antarpermintaan pembaruan dari frontend ke API. |
| observed_at | Waktu pengamatan data yang sah; dipertahankan saat retry dan tidak diganti dengan waktu penerimaan. |
| received_at | Waktu backend menerima pesan; dicatat terpisah dari observed_at. |
| Usia posisi | Selisih waktu saat informasi disajikan terhadap observed_at posisi valid terbaru. Reload atau pengiriman ulang data lama tidak membuat posisi lama menjadi segar. |
| Stale | Usia data lebih dari 30 detik ditandai terlambat. |
| Tanpa pembaruan | Tidak ada posisi baru selama lebih dari 60 detik ditandai tanpa pembaruan/offline sesuai kontrak. Ini tidak otomatis membuktikan penyebabnya adalah jaringan seluler mati. |
| last_seen | Penanda waktu aktivitas penerimaan perangkat di server, dipisahkan dari usia posisi agar backlog tidak menyamarkan data lokasi lama. |
| GPS tidak valid | Kondisi posisi tidak layak dipakai sebagai posisi baru/masukan ETA. Posisi valid terakhir dapat tetap ditampilkan dengan waktu serta status yang benar. |
| UTC dan waktu tampilan | Penyimpanan/pertukaran waktu menggunakan UTC; tampilan pengguna memakai zona waktu yang diberi label, misalnya WIB untuk koridor uji. |

Aturan detail field, kondisi batas tepat 30/60 detik, serta prioritas status saat beberapa kondisi terjadi diselaraskan pada kontrak PM_03 dan diperiksa pada TC-F07. Status GPS dan status koneksi/data tidak disatukan menjadi satu klaim penyebab gangguan.

## 4. Kebutuhan fungsional dan keterlacakan

ID, kebutuhan, prioritas, dan kode verifikasi mengikuti SRS/Bab 6 proposal, dengan penjelasan target tetap yang diperjelas melalui MEET_02. Kolom kartu menghubungkan kebutuhan dengan pekerjaan implementasi. Pemeriksaan komponen dilakukan pada kartunya, integrasi pada PM_17, serta penerimaan terkait pada PM_18. Penyesuaian jumlah perjalanan dan UAT dijelaskan pada bagian 6–7 dan harus diteruskan ke proposal/kartu terkait; kode kasus uji tidak menyatakan kasus tersebut sudah dijalankan.

| ID | Kebutuhan sesuai SRS | Prioritas | Kartu pelaksana | Kasus uji Bab 6 |
| --- | --- | --- | --- | --- |
| FR-01 | Perangkat ESP32 membaca koordinat, waktu, kecepatan, dan indikator validitas posisi dari GPS GY-NEO6M. | Must | PM_04, PM_05 | TC-F01 |
| FR-02 | Perangkat memberikan identitas unik pada setiap pesan telemetri serta menyimpan sementara data yang belum terkirim ketika koneksi terputus. | Must | PM_07, PM_09 | TC-I02 |
| FR-03 | Perangkat mengirimkan data telemetri secara berkala melalui jaringan GSM/GPRS menggunakan SIM800L EVB 5 V dan protokol MQTT, serta melakukan pengiriman ulang ketika koneksi pulih. | Must | PM_06, PM_07, PM_09 | TC-I01 |
| FR-04 | Backend memverifikasi identitas perangkat, memvalidasi struktur dan nilai telemetri, serta menangani pesan tidak valid tanpa menghentikan layanan penerima. | Must | PM_06, PM_08 | TC-S01 |
| FR-05 | Backend menyimpan data telemetri beserta waktu pengambilan dan penerimaan, mencegah penyimpanan pesan ganda, serta memastikan data lama yang terlambat diterima tidak menggantikan posisi terbaru kendaraan. | Must | PM_08, PM_09 | TC-I03 |
| FR-06 | Agen/operator dapat mengelola kendaraan, pengaitan operasional perangkat, rute, dan target sesuai kewenangannya. Kredensial perangkat serta akun teknis dikelola administrator teknis. | Must | PM_10, PM_12 | TC-F02 |
| FR-07 | Agen/operator dapat memulai, memperbarui status, dan mengakhiri perjalanan. Sistem membatasi satu perjalanan aktif pada kendaraan yang diuji. | Must | PM_10, PM_12 | TC-F03 |
| FR-08 | Penumpang dapat mengakses informasi perjalanan aktif melalui tautan atau kode perjalanan tanpa memerlukan akun operator. | Must | PM_10, PM_12 | TC-F04 |
| FR-09 | Dashboard menampilkan posisi terakhir kendaraan pada peta, status perjalanan, dan waktu pembaruan data. | Must | PM_10, PM_12 | TC-F05 |
| FR-10 | Sistem menghasilkan estimasi sisa waktu perjalanan dan waktu kedatangan menuju agen Hajimena sebagai target antara tetap pada arah pengujian. | Must | PM_13, PM_14, PM_15 | TC-ML02 |
| FR-11 | Sistem menghasilkan estimasi sisa waktu perjalanan dan waktu kedatangan menuju agen Kotabumi sebagai target akhir tetap pada arah pengujian. | Must | PM_13, PM_14, PM_15 | TC-ML03 |
| FR-12 | Dashboard menampilkan status perjalanan, meliputi belum berangkat, dalam perjalanan, tiba pada target, dan selesai, sesuai perubahan status yang tercatat. | Must | PM_10, PM_12 | TC-F06 |
| FR-13 | Dashboard menampilkan penanda apabila data lokasi belum tersedia, GPS tidak valid, data terlambat, atau kendaraan tidak mengirimkan pembaruan, sehingga informasi lama tidak dianggap sebagai posisi terkini. | Must | PM_10, PM_12 | TC-F07 |
| FR-14 | Layanan ETA memeriksa validitas data masukan dan ketersediaan model. Jika model tidak dapat digunakan, sistem menampilkan estimasi cadangan apabila data pendukung memenuhi syarat; jika tidak, ETA dinyatakan belum tersedia. | Must | PM_15 | TC-ML04 |
| FR-15 | Sistem menyediakan log teknis untuk mencatat kesalahan penerimaan data, gangguan komunikasi, kegagalan pengolahan, dan masalah layanan yang diperlukan dalam penelusuran gangguan. | Must | PM_08, PM_16 | TC-I05 |
| FR-16 | Administrator teknis dapat menjalankan mekanisme pengelolaan dan penghapusan data sesuai kebijakan retensi yang ditetapkan untuk prototipe. | Must | PM_16 | TC-S04 |
| FR-17 | Tim yang memiliki kewenangan dapat mengekspor data perjalanan dalam format sederhana untuk kebutuhan pengujian dan evaluasi model ETA, dengan pembatasan informasi sensitif sesuai kebutuhan. | Should | PM_10 bila dipilih; dokumentasi PM_19 | TC-F08 |
| FR-18 | Sistem menerapkan autentikasi dan pembatasan hak akses yang membedakan agen/operator, administrator teknis, dan akses informasi perjalanan bagi penumpang. | Must | PM_06, PM_10, PM_12, PM_16 | TC-S02 |
| FR-19 | Agen/operator dapat melihat riwayat perjalanan kendaraan yang telah tersimpan untuk mendukung pemantauan dan evaluasi operasional. | Must | PM_10, PM_12 | TC-F09 |

## 5. Kebutuhan mutu dan target penerimaan

Tabel berikut merupakan kriteria rencana SRS beserta penyesuaian UAT berdasarkan MEET_02. Belum ada nilai hasil aktual. Persetujuan atas target berbeda dari keberhasilan mencapai target; hasil pengukuran baru dilaporkan pada kartu implementasi/pengujian. UAT satu orang tidak menggantikan simulasi beban 20 pengguna pada NFR-02.

| ID | Aspek | Kriteria rencana sesuai SRS | Kartu terkait | Kasus uji Bab 6 |
| --- | --- | --- | --- | --- |
| NFR-01 | Kesegaran data | Pada kondisi jaringan stabil dengan interval pengiriman telemetri nominal 10 detik, minimal 95% pembaruan lokasi harus ditampilkan pada dashboard dalam waktu ≤30 detik sejak pengambilan data GPS. Data yang berusia lebih dari 30 detik ditandai sebagai stale, sedangkan tidak adanya pembaruan selama lebih dari 60 detik ditandai sebagai offline atau tidak ada pembaruan. | PM_07, PM_10, PM_12, PM_18 | TC-F07, TC-P01 |
| NFR-02 | Kinerja | Persentil ke-95 (p95) waktu respons API dashboard harus ≤2 detik pada simulasi 20 pengguna yang mengakses sistem secara bersamaan dalam lingkungan server pilot. | PM_10, PM_16, PM_18 | TC-P02, TC-P05 |
| NFR-03 | Ketersediaan | Layanan web dan API harus memiliki tingkat ketersediaan minimal 95% selama periode pengujian 24 jam, tidak termasuk pemeliharaan terjadwal. Ketersediaan server diukur secara terpisah dari konektivitas perangkat kendaraan. | PM_16, PM_18 | TC-P03 |
| NFR-04 | Keandalan | Pada simulasi pemutusan jaringan selama 5 menit dengan kapasitas buffer yang mencukupi, minimal 95% pesan telemetri yang dihasilkan harus berhasil tersimpan pada backend paling lambat 10 menit setelah koneksi dipulihkan. | PM_09 | TC-I02 |
| NFR-05 | Keamanan | Dashboard dan API harus menggunakan HTTPS. Akses operator dan administrator teknis dilindungi melalui autentikasi dan pembatasan hak akses berdasarkan peran. Setiap perangkat memiliki kredensial tersendiri yang tidak disimpan dalam repositori publik. Komunikasi MQTT melalui jaringan publik harus menggunakan kanal terenkripsi yang telah diverifikasi, seperti TLS atau terowongan privat terenkripsi, serta autentikasi perangkat. Apabila perlindungan tersebut belum dapat diterapkan, persyaratan keamanan dinyatakan belum terpenuhi dan penggunaan dibatasi pada lingkungan pengujian terkendali hingga tersedia solusi yang sesuai. | PM_06, PM_07, PM_10, PM_16, PM_17 | TC-S01, TC-S02, TC-S03 |
| NFR-06 | Privasi | Penumpang hanya dapat mengakses informasi perjalanan aktif melalui tautan atau kode yang tidak mudah ditebak. Riwayat lokasi mentah tidak tersedia pada antarmuka publik. Data GPS mentah memiliki batas retensi internal maksimal 90 hari setelah perjalanan, kecuali dihapus lebih awal atau telah diolah menjadi data evaluasi yang tidak lagi dapat mengidentifikasi individu sesuai kebijakan proyek. | PM_10, PM_16, PM_17 | TC-F04, TC-F09, TC-S02, TC-S04 |
| NFR-07 | Kompatibilitas | Dashboard harus berfungsi pada minimal dua browser modern yang berbeda dan mendukung tampilan responsif pada perangkat dengan lebar layar mulai dari 360 piksel. | PM_11, PM_12, PM_18 | TC-P06 |
| NFR-08 | Kemudahan pemeliharaan | Layanan backend harus menyediakan pemeriksaan kesehatan layanan (health check), konfigurasi berbasis variabel lingkungan, dan log teknis yang memuat waktu kejadian, komponen terkait, serta jenis kesalahan. | PM_08, PM_16, PM_17 | TC-I05 |
| NFR-09 | Kemudahan penggunaan | UAT awal melibatkan satu calon pengguna dengan tugas sesuai peran yang ditetapkan sebelum sesi. Penyelesaian setiap tugas, bantuan yang diberikan, masukan, dan skor SUS dicatat per individu. Target tugas sebelumnya ≥80% peserta berarti satu dari satu peserta harus menyelesaikan seluruh tugas inti tanpa bantuan; acuan skor SUS ≥68 dicatat sebagai target individu pada skala 0–100. Hasil satu peserta tidak dinyatakan mewakili seluruh operator/penumpang atau sebagai rata-rata kelompok. | PM_11, PM_12, PM_18 | TC-U01 |
| NFR-10 | Portabilitas | Layanan backend harus dapat dijalankan dan dipindahkan ke lingkungan server Linux lain menggunakan konfigurasi deployment yang terdokumentasi, seperti Docker Compose, tanpa memerlukan perubahan kode yang bergantung pada server tertentu. | PM_16 | TC-P06 |
| NFR-11 | Integritas data | Pesan dengan identitas telemetri yang sama hanya boleh menghasilkan satu catatan penyimpanan. Data yang diterima secara tidak berurutan tidak boleh menggantikan posisi terbaru apabila memiliki waktu pengamatan yang lebih lama. | PM_08, PM_09 | TC-I03 |
| NFR-12 | Pemantauan teknis | Administrator teknis harus dapat memeriksa status layanan, waktu terakhir data perangkat diterima (last_seen), serta catatan kesalahan melalui fasilitas teknis yang tersedia. Pemantauan tidak mensyaratkan penggunaan dashboard observabilitas khusus. | PM_16, PM_17 | TC-I05 |
| NFR-13 | Kestabilan catu daya | Perangkat ESP32, GPS GY-NEO6M, dan SIM800L EVB (varian papan dengan input catu daya 5 V) harus dapat beroperasi secara bersamaan menggunakan powerbank berkapasitas nominal 20.000 mAh tanpa mengalami restart akibat gangguan catu daya selama pengujian kontinu minimal 4 jam. Selain itu, perangkat harus diuji selama satu perjalanan aktual sesuai durasi perjalanan yang dilaksanakan. Tegangan masukan dan kemampuan suplai arus harus diperiksa, khususnya ketika modul seluler melakukan transmisi data. | PM_04, PM_18 | TC-P04 |
| NFR-14 | Validitas keluaran ETA | Pada seluruh skenario pengujian dengan masukan valid, keluaran ETA harus memiliki durasi tidak negatif dan waktu kedatangan yang konsisten dengan waktu acuan. Apabila data masukan atau model tidak memenuhi persyaratan, sistem harus menghasilkan estimasi cadangan yang valid atau menyatakan ETA belum tersedia. Validitas keluaran ETA diperiksa secara terpisah dari akurasi model prediksi. | PM_15, PM_17 | TC-I04, TC-ML04 |
| NFR-15 | Akurasi prediksi ETA | Pada data pengujian lokal yang dipisahkan berdasarkan perjalanan, model ETA ditargetkan memiliki Mean Absolute Error (MAE) ≤5 menit untuk titik jemput atau agen dan MAE ≤10 menit untuk tujuan akhir. Selain itu, model ditargetkan mampu menurunkan nilai MAE minimal 10% dibandingkan baseline terbaik yang telah ditetapkan. Evaluasi akurasi dilakukan menggunakan metrik MAE dan Root Mean Squared Error (RMSE) berdasarkan waktu kedatangan aktual. | PM_13, PM_14, PM_18 | TC-ML01, TC-ML02, TC-ML03 |

### 5.1 Ringkasan target dengan bahasa sederhana

- **Lokasi:** pada jaringan stabil, setidaknya 95 dari 100 pembaruan yang diukur terlihat paling lambat 30 detik setelah pengamatan.
- **API:** p95 ≤2 detik pada simulasi 20 pengguna; waktu respons ini berbeda dari keterlambatan lokasi sejak GPS mengukur.
- **Layanan:** tersedia ≥95% selama pemantauan 24 jam sesuai aturan pemeliharaan, dengan gangguan seluler dicatat terpisah.
- **Pemulihan:** setelah jaringan sengaja diputus lima menit, ≥95% pesan unik yang dihasilkan tersimpan paling lambat 10 menit setelah pulih jika buffer mencukupi.
- **Daya:** bekerja kontinu minimal empat jam dan selama satu perjalanan aktual tanpa restart akibat suplai.
- **ETA:** rata-rata kesalahan absolut ≤5 menit ke Hajimena dan ≤10 menit ke Kotabumi; MAE turun ≥10% dari baseline pembanding yang sah. RMSE dan ukuran sampel tetap dilaporkan.
- **UAT awal:** satu calon pengguna mencoba seluruh tugas inti sesuai peran; keberhasilan tanpa bantuan dicatat per tugas dan skor SUS dicatat sebagai skor individu, dengan acuan target ≥68/100. Satu peserta berarti target keberhasilan peserta hanya terpenuhi jika peserta itu menyelesaikan seluruh tugas inti tanpa bantuan. Hasil tetap terbatas pada peserta/peran tersebut.

Target di atas dibahas tim sebelum penerimaan. Bila hasil akhirnya gagal, catat gagal serta perbaikannya; jangan mengganti target setelah melihat hasil hanya agar terlihat lulus.

## 6. Rencana data lokal dan evaluasi ETA

### 6.1 Jumlah perjalanan uji dan keputusan data yang masih terbuka

- **Keputusan rencana:** tiga perjalanan uji lapangan pada arah Tanjung Karang → Hajimena → Kotabumi, sebagaimana dilaporkan pengguna untuk MEET_02.
- Setiap perjalanan mencatat identitas trip, koordinat/waktu/validitas GPS, gangguan koneksi, serta waktu tiba aktual di Hajimena dan Kotabumi.
- Satu trip adalah satu perjalanan pada arah yang ditetapkan; banyak snapshot GPS dalam satu trip tidak dihitung sebagai banyak perjalanan independen.
- Rencana lama 15 perjalanan dengan pembagian 9 latih/3 validasi/3 uji tidak digunakan sebagai rencana yang disepakati. Tiga perjalanan baru ini tidak otomatis dibagi menjadi 1/1/1 atau dianggap cukup untuk melatih dan menguji model.
- **Keputusan tertunda:** sumber data pelatihan, kecukupan data, pembagian berdasarkan trip, baseline, dan protokol evaluasi ETA. PIC: Sendi; dibahas bersama tim pada PM_13/PM_14 sebelum pelatihan serta evaluasi akhir.
- Jika ketiga perjalanan dipakai sebagai uji akhir independen, data ketiganya tidak dipakai untuk melatih, menyetel, atau memilih model. Penggunaan lain harus dicatat, dan data yang sudah dipakai mengembangkan model tidak diklaim sebagai uji akhir independen.
- Seluruh snapshot satu trip masuk kelompok yang sama. Daftar trip dan aturan praproses dibekukan sebelum evaluasi akhir setelah protokol disepakati.
- Kualitas/kecukupan ditinjau pada PM_13. Tiga perjalanan mendukung laporan uji awal yang terbatas; target akurasi ETA belum dianggap terbukti atau otomatis tercapai.

### 6.2 Label dan pencegahan kebocoran data

1. Catat waktu tiba aktual untuk setiap pasangan trip dan target.
2. Label sisa waktu = actual_arrival_at − observed_at pada trip/target yang sama.
3. Pengamatan setelah target tercapai tidak dipakai sebagai contoh sisa waktu menuju target itu.
4. Trip tanpa waktu tiba yang sah tidak diberi label rekaan.
5. Fitur hanya menggunakan informasi yang sudah tersedia saat prediksi, bukan waktu tiba aktual atau informasi masa depan.
6. Parameter praproses dipelajari dari data latih yang diizinkan. Penalaan/pemilihan model memakai data pengembangan/validasi, bukan uji akhir.
7. Pisahkan hasil Porto, fixture/simulasi, replay, serta data lokal. Pemakaian ulang trip uji tidak disebut sampel lapangan independen baru.

### 6.3 Model, baseline, dan penyajian ETA

Random Forest Regressor dan Gradient Boosting Regressor dibandingkan dengan baseline yang dapat dibentuk secara sah dari data pengembangan. Identitas baseline pembanding, aturan pemilihan, serta cara menghitung perbaikan ditetapkan sebelum uji akhir. Pemilihan akhir model mengikuti PM_14; PM_02 tidak menetapkan model menang tanpa evaluasi.

Model yang tersedia menghasilkan ETA dua target melalui PM_15. Jika model atau masukan tidak layak, fallback hanya dipakai jika syarat jarak rute/kecepatan terpenuhi; selain itu ETA unavailable. Angka nol bukan perintah otomatis menyelesaikan trip.

## 7. Rencana UAT awal

- **Keputusan jumlah:** satu calon pengguna untuk evaluasi awal terbatas; rencana lama enam peserta (dua operator/empat penumpang) diganti.
- **Peran peserta:** belum ditetapkan. Arinal menyiapkan tugas dan Maulana mengoordinasikan peserta/persetujuan sebelum sesi PM_18. Satu peserta tidak otomatis mewakili kedua peran operator dan penumpang.
- Peserta berasal dari calon pengguna sesuai peran yang diuji. Nama dan identitas pribadi tidak perlu dimasukkan ke repositori publik.
- Bila peserta penumpang, tugas mencakup membuka trip aktif, menemukan lokasi/status data, dan membaca ETA target.
- Bila peserta operator, tugas mencakup login, menyiapkan/memulai trip, memantau kendaraan, serta mencatat tiba atau mengakhiri trip sesuai kewenangan.
- Catat berhasil/gagal dan bantuan pada setiap tugas. Target keberhasilan peserta ≥80% yang sebelumnya direncanakan berarti satu dari satu peserta harus menyelesaikan seluruh tugas inti yang ditugaskan tanpa bantuan. Jangan menyajikan 1/1 sebagai bukti mewakili populasi pengguna.
- SUS tetap memakai 10 butir dan aturan penilaian Bab 6/Lampiran E–F. Laporkan skor individu pada skala 0–100 dengan acuan target ≥68, bukan rata-rata beberapa peserta, bukan persentase keberhasilan tugas.
- Masukan kualitatif, kendala, dan keterbatasan satu peserta dilaporkan. Fungsi untuk peran yang tidak diwakili peserta tetap diperiksa melalui pengujian fungsional, tanpa mengklaim UAT peran tersebut telah dilakukan.
- Tanggal sesi, persetujuan peserta, formulir, dan instrumen bahasa dilengkapi sebelum/saat PM_18.
- **Status hasil UAT:** belum dilaksanakan. Satu peserta UAT berbeda dari simulasi beban API 20 pengguna.

## 8. Data, privasi, retensi, ekspor, dan cadangan

1. Penumpang hanya memperoleh informasi yang diizinkan pada trip aktif melalui kode yang sulit ditebak; akses kode dinonaktifkan ketika trip selesai.
2. Riwayat perjalanan tersedia bagi operator berwenang. GPS historis mentah tidak dibuka kepada publik.
3. GPS mentah disimpan maksimal **90 hari setelah perjalanan** sesuai keputusan rencana yang dilaporkan pada MEET_02. Angka ini merupakan kebijakan internal proyek, bukan klaim ketentuan hukum umum atau kewajiban menguji selama 90 hari.
4. Administrator teknis dapat menjalankan mekanisme penghapusan yang didokumentasikan dan diverifikasi pada PM_16/PM_17 dengan data uji berumur.
5. Dataset turunan, ekspor, log, dan cadangan dikelola agar data mentah tetap mengikuti kebijakan retensi. Jika data evaluasi dipertahankan, minimalkan identitas dan catat tujuan, akses, serta masa simpan yang disepakati.
6. Ekspor sederhana FR-17 hanya untuk pihak berwenang dan berstatus Should. Kata sandi, token, dan kredensial tidak masuk ekspor publik.
7. Mekanisme pencadangan/restore dan pencegahan munculnya kembali data yang sudah harus dihapus ditentukan pada PM_16.
8. **Status keputusan kebijakan:** dilaporkan disepakati pada MEET_02. **Status penerapan/pengujian:** belum dibuktikan; persetujuan kebijakan tidak berarti penghapusan/cadangan sudah berjalan.

## 9. Pembagian tanggung jawab dan jadwal

Pembagian berikut mengikuti peran pada proposal/MEET_01 dan tindak lanjut MEET_02. Perubahan pembagian aktual tetap dicatat pada kartu terkait.

| Anggota | Peran rencana | Tanggung jawab utama |
| --- | --- | --- |
| Maulana Rizki Ramadhani | Project Manager dan System Analyst | Kebutuhan/batasan, Kanban/jadwal, keputusan tim, izin/koordinasi, serta review penerimaan. |
| Ariel Ivan Permana | Embedded dan IoT | Perangkat, daya, GPS, GSM/MQTT perangkat, buffer, serta bukti komponen. |
| Kristian Dwi Putra | Backend dan Infrastructure | Broker, subscriber/backend, basis data, API, akses, server, retensi, serta deployment/pemulihan. |
| Muhammad Arinal Haq | Frontend dan UI/UX | Rancangan dashboard, implementasi antarmuka, integrasi API, dan pemeriksaan alur pengguna. |
| Sendi Aryadita | Data dan Machine Learning | Dataset, label/fitur, pembagian trip, baseline/model, evaluasi, serta artefak integrasi. |

- Jadwal relatif PM_02: **M1–M2** dari rencana implementasi 16 minggu.
- Tanggal mulai proyek yang disepakati: **belum ditetapkan dalam informasi yang diterima**.
- Tenggat proyek yang disepakati: **belum ditetapkan dalam informasi yang diterima**.
- Tanggal pelaksanaan MEET_02: **belum diisi; jangan diganti dengan tanggal pembaruan dokumen**.
- Reviewer akhir dan tanggal review PM_02: **belum dicatat**.
- PIC penetapan tanggal mulai/deadline: **Maulana**, sebelum PM_02 diajukan ke In review.
- Pengujian lapangan/alat mengikuti kesiapan komponen dan izin; tanggal rencana tidak diubah menjadi catatan seolah sudah dilaksanakan.

| PIC | Tindak lanjut | Tenggat berdasarkan tahap |
| --- | --- | --- |
| Maulana | Memperbarui PM_02/proposal/Kanban dan menetapkan jadwal kalender serta reviewer | Sebelum PM_02 diajukan ke In review |
| Ariel | Menyiapkan perangkat, pengukuran awal, dan lembar perjalanan | Sebelum pengujian pengiriman/perjalanan sesuai dependensi |
| Kristian | Menyiapkan penerimaan/penyimpanan data, broker, API, dan lingkungan layanan | Sebelum pengujian komponen/jalur data terkait |
| Sendi | Menetapkan sumber dan strategi data pelatihan/evaluasi ETA bersama tim | Sebelum pelatihan dan pembekuan evaluasi akhir PM_13/PM_14 |
| Arinal | Menyiapkan rancangan dashboard dan tugas UAT sesuai peran peserta | Sebelum implementasi terkait dan sesi UAT |

## 10. Rekap keputusan MEET_02 dan tindak lanjut

Rekap berikut berdasarkan keputusan yang dilaporkan pengguna dan isi MEET_02 yang ditunjukkan. Rekap tidak mengarang tanggal, kehadiran, persetujuan setiap anggota, atau hasil uji. Tautan meeting menjadi lokasi catatan keputusan; persetujuan atas versi akhir dokumen dan bukti review dicatat setelah benar-benar tersedia.

| ID keputusan | Hal yang ditinjau | Acuan | Keputusan rencana/status aktual | PIC serta tenggat tindak lanjut |
| --- | --- | --- | --- | --- |
| K-01 | Kendaraan, arah, target, dan kebutuhan izin | Bagian 1 | Satu kendaraan; arah Tanjung Karang → Hajimena → Kotabumi; koordinat referensi belum diverifikasi dan izin aktual belum dikonfirmasi | Maulana/Ariel; sebelum lapangan |
| K-02 | Pengguna, akses, fungsi, titik naik/turun, dan batas | Bagian 1–2 dan FR-01–FR-19 | Akses tiga peran; naik hanya di tiga agen; turun boleh di titik lain; ETA hanya Hajimena/Kotabumi; powerbank menjadi daya pilot | Maulana/Arinal/Kristian; sebelum implementasi terkait |
| K-03 | Parameter waktu dan target mutu | Bagian 3 dan 5 | Pengiriman 10 detik dan polling 5 detik; target pada agenda MEET_02 dicatat sebagai rencana, bukan hasil lulus | PIC komponen; sebelum uji penerimaan |
| K-04 | Jumlah perjalanan dan strategi data | Bagian 6 | Tiga perjalanan uji lapangan disepakati mengganti 15 trip/9-3-3. Sumber/pembagian data latih dan protokol evaluasi ETA masih terbuka | Sendi bersama tim; sebelum pelatihan/evaluasi akhir PM_13/PM_14 |
| K-05 | Jumlah/peran UAT dan instrumen | Bagian 7 | Satu calon pengguna untuk UAT awal terbatas; peran peserta dan tanggal sesi belum ditetapkan; skor SUS individu | Arinal/Maulana; sebelum sesi PM_18 |
| K-06 | Retensi, ekspor, penghapusan, dan cadangan | Bagian 8 | GPS mentah maksimal 90 hari disepakati sebagai kebijakan; penerapan belum dibuktikan; ekspor tetap Should | Kristian; sebelum pengujian retensi/deployment terkait |
| K-07 | Pembagian kerja, tanggal mulai, deadline, dan reviewer | Bagian 9 | Peran dan tindak lanjut dicatat; tanggal mulai/deadline dan reviewer akhir belum dicatat | Maulana; sebelum PM_02 In review |

Simpan alasan perubahan jumlah perjalanan/UAT sesuai kesepakatan sebenarnya; alasan khusus belum diberikan dan tidak direka. Selaraskan proposal/SRS serta PM_13, PM_14, PM_18, dan kartu terdampak. Perubahan UAT tidak menurunkan jumlah pengguna simulasi beban API.

### 10.1 Catatan review dan persetujuan

| Anggota yang benar-benar meninjau | Tanggal | Hasil review atau masukan | Persetujuan atau revisi yang diminta | Tautan bukti |
| --- | --- | --- | --- | --- |
| Review versi akhir PM_02 belum dicatat | Belum dicatat | Cocokkan versi 0.2 dengan keputusan meeting dan jadwal | Isi persetujuan/revisi hanya sesudah review nyata | [MEET_02](https://github.com/kristiandwiputra/PM-TRAVEL/issues/22) |

Ringkasan keputusan terbuka: sumber/pembagian data pelatihan dan protokol evaluasi ETA (Sendi, sebelum pelatihan/evaluasi akhir); peran peserta UAT (Arinal/Maulana, sebelum UAT); tanggal mulai/deadline/reviewer (Maulana, sebelum PM_02 In review).  
Versi dokumen yang telah mendapat review akhir: **belum dicatat**. Keputusan meeting tidak otomatis menjadi bukti bahwa seluruh anggota sudah membaca versi 0.2 ini.  
Catatan keputusan: [MEET_02](https://github.com/kristiandwiputra/PM-TRAVEL/issues/22). Masukkan tanggal meeting dan bukti review/persetujuan aktual ketika tersedia.

## 11. Panduan mencentang 12 butir PM_02

Nomor mengikuti urutan checklist pada issue PM_02. Tabel ini menjelaskan bukti yang diperlukan; bukan perintah mencentang semua sebelum pekerjaan dilakukan.

| Butir | Bagian dokumen | Kapan boleh dicentang |
| --- | --- | --- |
| 1. Kendaraan, arah, dan daftar izin | 1.2 dan 1.4 | Rencana satu kendaraan/arah serta kebutuhan izin sudah ditetapkan dan dicatat; rincian yang masih terbuka diberi PIC/tenggat. Perolehan izin lapangan aktual dipastikan sebelum pelaksanaan. |
| 2. Titik awal dan dua target ETA | 1.3 | Referensi titik/koordinat sudah tersimpan dan dibaca, dengan status belum diverifikasi lapangan dinyatakan jelas. |
| 3. Hak akses tiap peran | 1.1 dan 8 | Pembagian akses telah ditetapkan serta ditinjau tim. |
| 4. Pemetaan kebutuhan ke kartu dan kasus uji | 4 dan 5 | Matriks FR/NFR, prioritas, kartu, dan TC tersedia serta diperiksa kecocokannya dengan SRS/Bab 6. Kasus uji belum harus dijalankan. |
| 5. Interval dan usia data | 3 | Parameter awal dan definisi waktunya sudah dicatat serta dipahami; tidak perlu menunggu hasil ukur. |
| 6. Target freshness, API, dan ketersediaan | 5 | Target ditinjau tim dan keputusan dicatat; pencapaian target dibuktikan kemudian. |
| 7. Target pemulihan, daya, dan ETA | 5 dan 6 | Target serta syarat pengukurannya ditinjau dan keputusan dicatat. |
| 8. Rencana tiga perjalanan dan tindak lanjut data ETA | 6 dan K-04 | Rencana tiga perjalanan uji dicatat; rencana 15/9-3-3 diganti. Strategi data latih/evaluasi yang masih terbuka memiliki PIC dan tenggat tahap. Tidak menunggu tiga perjalanan dilaksanakan. |
| 9. Rencana satu peserta UAT awal | 7 dan K-05 | Jumlah satu peserta serta keterbatasannya dicatat; tugas/skor memakai penilaian individu dan penetapan peran memiliki PIC/tenggat sebelum sesi. Tidak menunggu UAT dilaksanakan. |
| 10. Powerbank dan batas fitur | 2 | Sumber daya pilot dan fitur di luar lingkup telah ditegaskan serta dicatat. |
| 11. Retensi dan pengelolaan data | 8 dan K-06 | Kebijakan rencana telah ditinjau/disepakati; implementasi penghapusan dibuktikan pada kartu teknis. |
| 12. Persetujuan, keputusan terbuka, dan tanggal | 9–10 | Review nyata, keputusan tim, tanggal mulai/deadline, dan tindak lanjut sudah dicatat serta perubahan diteruskan ke kartu terkait. |

Setelah isi dan bukti siap, PM_02 dapat diajukan ke In review. Pindah ke Done setelah keputusan perencanaan dan review selesai; hal ini tidak berarti pengujian teknis proyek sudah lulus. Jika keputusan penting belum dibuat, butir terkait tetap belum dicentang.

## 12. Bukti pekerjaan

- Dokumen kebutuhan dan matriks: file ini pada `docs/PM_02_Kebutuhan_dan_Batasan.md` setelah di-commit/push.
- Catatan keputusan: [MEET_02](https://github.com/kristiandwiputra/PM-TRAVEL/issues/22). Tanggal serta review akhir dokumen tetap perlu dilengkapi sesuai kenyataan.
- Commit draf awal yang sudah di-push: [189e757](https://github.com/kristiandwiputra/PM-TRAVEL/commit/189e757). Commit ini membuktikan versi awal, bukan pembaruan versi 0.2.
- Commit pembaruan versi 0.2: belum tersedia; tambahkan tautan commit sebenarnya setelah file ini di-push.
- Bukti masukan/persetujuan akhir anggota: belum dilampirkan pada versi dokumen ini; gunakan catatan/komentar sebenarnya, jangan membuat tautan komentar rekaan.

### 12.1 Ringkasan perubahan yang perlu diteruskan

- PM_02: ubah butir perjalanan menjadi tiga perjalanan dan butir UAT menjadi satu peserta awal; perjelas titik naik tetap, titik turun, dan target ETA.
- PM_13/PM_14: hapus pembagian 9/3/3 sebagai keputusan final; tentukan sumber data serta evaluasi independen sebelum pelatihan/uji akhir.
- PM_18: gunakan tiga perjalanan dan UAT satu peserta dengan pelaporan terbatas; pertahankan pengujian teknis dan simulasi beban sesuai targetnya.
- PM_19/proposal: selaraskan bagian metode, jadwal, instrumen, dan jumlah peserta/perjalanan. RAB dan harga jual tidak diubah hanya karena pembaruan kebutuhan ini; perubahan biaya nyata dihitung bila ada.
- Pembaruan file ini tidak mengubah GitHub atau proposal Word secara otomatis. Status implementasi dan pengujian tetap belum diuji.

## 13. Istilah singkat

- **Trip:** satu perjalanan kendaraan pada arah yang disepakati.
- **Snapshot:** satu catatan pengamatan pada suatu waktu; banyak snapshot dalam satu trip bukan banyak trip terpisah.
- **ETA:** perkiraan sisa waktu atau waktu tiba menuju target tertentu.
- **Baseline:** cara perkiraan sederhana yang menjadi pembanding model.
- **MAE:** rata-rata besar kesalahan prediksi terhadap waktu aktual; makin kecil makin baik.
- **RMSE:** ukuran kesalahan yang memberi pengaruh lebih besar pada kesalahan besar.
- **p95:** batas waktu yang mencakup sekitar 95% respons yang diukur.
- **Buffer:** antrean sementara pesan saat jalur penyimpanan/pengiriman belum berhasil.
- **SUS:** kuesioner penilaian kegunaan sistem dengan skor 0–100.
