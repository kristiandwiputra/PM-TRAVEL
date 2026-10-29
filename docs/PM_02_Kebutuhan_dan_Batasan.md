# PM_02 Kebutuhan dan Batasan Prototipe PM-TRAVEL

**Versi:** 0.1 untuk review tim  
**Tanggal penyusunan draf:** 29 Oktober 2026  
**PIC perencanaan sesuai proposal:** Maulana Rizki Ramadhani  
**Status:** Draf untuk ditinjau; belum menjadi catatan persetujuan tim.  
**Acuan:** Proposal PM-TRAVEL Revisi Harga Aktual, Bab 1, Bab 4, dan Bab 6; Kanban PM_01–PM_19.  
**Catatan review:** [MEET_02 — Penyepakatan kebutuhan dan rencana kerja proyek](https://github.com/kristiandwiputra/PM-TRAVEL/issues/22).

Dokumen ini menyatukan kebutuhan dan batasan agar anggota tim mempunyai acuan yang sama saat membangun prototipe. Seluruh kriteria pengujian di sini merupakan target rencana. Pengujian perangkat, jaringan, sistem, model lokal, dan UAT belum dilaksanakan. Kolom hasil pengujian tidak diisi sebagai berhasil sebelum ada pengukuran.

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
- Titik jemput bebas yang dipilih penumpang.
- Chat, aplikasi seluler native, serta optimasi rute otomatis.
- Pengelolaan armada fisik banyak kendaraan sebagai penerapan operasional penuh.
- Audit aktivitas pengguna yang lengkap dan dashboard pengelolaan versi model.
- Pemasangan permanen mengambil daya dari aki kendaraan; penggunaan powerbank tetap menjadi acuan pilot.

### 2.4 Keputusan tampilan dashboard

Susunan layar, warna, navigasi, dan komponen visual ditentukan melalui PM_11 bersama PIC frontend. Perubahan visual tidak otomatis mengubah kebutuhan informasi. Perubahan fitur atau hak akses ditinjau pada PM_02 dan diperbarui pada SRS/kartu terdampak.

## 3. Parameter waktu dan status data

| Parameter atau istilah | Definisi rencana |
| --- | --- |
| Interval telemetri | Nominal 10 detik antarjadwal pengiriman perangkat. Ini belum merupakan janji data terlihat di dashboard setiap tepat 10 detik. |
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

ID, kebutuhan, prioritas, dan kode verifikasi mengikuti SRS/Bab 6 proposal. Kolom kartu menghubungkan kebutuhan dengan pekerjaan implementasi. Pemeriksaan komponen dilakukan pada kartunya, integrasi pada PM_17, serta penerimaan terkait pada PM_18.

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
| FR-10 | Sistem menghasilkan estimasi sisa waktu perjalanan dan waktu kedatangan menuju satu agen atau titik jemput tetap yang telah ditentukan. | Must | PM_13, PM_14, PM_15 | TC-ML02 |
| FR-11 | Sistem menghasilkan estimasi sisa waktu perjalanan dan waktu kedatangan menuju tujuan akhir yang telah ditentukan. | Must | PM_13, PM_14, PM_15 | TC-ML03 |
| FR-12 | Dashboard menampilkan status perjalanan, meliputi belum berangkat, dalam perjalanan, tiba pada target, dan selesai, sesuai perubahan status yang tercatat. | Must | PM_10, PM_12 | TC-F06 |
| FR-13 | Dashboard menampilkan penanda apabila data lokasi belum tersedia, GPS tidak valid, data terlambat, atau kendaraan tidak mengirimkan pembaruan, sehingga informasi lama tidak dianggap sebagai posisi terkini. | Must | PM_10, PM_12 | TC-F07 |
| FR-14 | Layanan ETA memeriksa validitas data masukan dan ketersediaan model. Jika model tidak dapat digunakan, sistem menampilkan estimasi cadangan apabila data pendukung memenuhi syarat; jika tidak, ETA dinyatakan belum tersedia. | Must | PM_15 | TC-ML04 |
| FR-15 | Sistem menyediakan log teknis untuk mencatat kesalahan penerimaan data, gangguan komunikasi, kegagalan pengolahan, dan masalah layanan yang diperlukan dalam penelusuran gangguan. | Must | PM_08, PM_16 | TC-I05 |
| FR-16 | Administrator teknis dapat menjalankan mekanisme pengelolaan dan penghapusan data sesuai kebijakan retensi yang ditetapkan untuk prototipe. | Must | PM_16 | TC-S04 |
| FR-17 | Tim yang memiliki kewenangan dapat mengekspor data perjalanan dalam format sederhana untuk kebutuhan pengujian dan evaluasi model ETA, dengan pembatasan informasi sensitif sesuai kebutuhan. | Should | PM_10 bila dipilih; dokumentasi PM_19 | TC-F08 |
| FR-18 | Sistem menerapkan autentikasi dan pembatasan hak akses yang membedakan agen/operator, administrator teknis, dan akses informasi perjalanan bagi penumpang. | Must | PM_06, PM_10, PM_12, PM_16 | TC-S02 |
| FR-19 | Agen/operator dapat melihat riwayat perjalanan kendaraan yang telah tersimpan untuk mendukung pemantauan dan evaluasi operasional. | Must | PM_10, PM_12 | TC-F09 |

## 5. Kebutuhan mutu dan target penerimaan

Tabel berikut merupakan kriteria rencana SRS. Belum ada nilai hasil aktual. Persetujuan atas target berbeda dari keberhasilan mencapai target; hasil pengukuran baru dilaporkan pada kartu implementasi/pengujian.

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
| NFR-09 | Kemudahan penggunaan | Pengujian kegunaan sistem menargetkan rata-rata skor System Usability Scale (SUS) ≥68 dan minimal 80% peserta mampu menyelesaikan tugas inti tanpa bantuan. | PM_11, PM_12, PM_18 | TC-U01 |
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
- **UAT:** ≥80% peserta menyelesaikan seluruh tugas inti sesuai peran tanpa bantuan dan rata-rata SUS ≥68 pada skala 0–100.

Target di atas dibahas tim sebelum penerimaan. Bila hasil akhirnya gagal, catat gagal serta perbaikannya; jangan mengganti target setelah melihat hasil hanya agar terlihat lulus.

## 6. Rencana data lokal dan evaluasi ETA

### 6.1 Jumlah dan pembagian perjalanan

- Usulan awal: **15 trip lokal**, yaitu 9 latih, 3 validasi, dan 3 uji.
- **Status jumlah/pembagian:** belum ada catatan kesepakatan tim yang diisi pada draf ini; putuskan melalui MEET_02.
- Satu trip adalah satu perjalanan pada arah yang ditetapkan; banyak snapshot GPS dalam satu trip tidak dihitung sebagai banyak perjalanan independen.
- Seluruh snapshot satu trip masuk kelompok yang sama. Daftar trip dan aturan praproses dibekukan sebelum evaluasi akhir.
- Usulan jumlah ini belum menjamin data cukup untuk model yang akurat. Kualitas/kecukupan ditinjau pada PM_13; jika kurang, perubahan disepakati dan dampak jadwal dicatat.

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

## 7. Rencana UAT

- Usulan: **6 calon pengguna**, yaitu 2 operator dan 4 penumpang.
- **Status jumlah/peran:** perlu ditinjau dan diputuskan tim melalui MEET_02. Nama peserta tidak perlu dimasukkan ke repositori publik.
- Peserta berasal dari calon pengguna; anggota pengembang tidak menggantikan seluruh calon pengguna.
- Tugas penumpang: membuka trip aktif, menemukan lokasi/status data, dan membaca ETA target.
- Tugas operator: membuka/menyiapkan trip, memantau kendaraan, serta mencatat tiba atau mengakhiri trip sesuai peran.
- Peserta yang menyelesaikan seluruh tugas inti yang ditugaskan tanpa bantuan dihitung berhasil. Rasio keberhasilan = jumlah peserta berhasil dibagi peserta yang mengikuti tugas.
- SUS menggunakan 10 butir dan cara penilaian pada Bab 6/Lampiran E–F. Skor 68 adalah skor pada skala 0–100, bukan persentase keberhasilan tugas.
- Waktu pelaksanaan, persetujuan peserta, formulir, instrumen bahasa yang digunakan, dan jumlah aktual dilengkapi sebelum/saat PM_18.
- **Status hasil UAT:** belum dilaksanakan.

## 8. Data, privasi, retensi, ekspor, dan cadangan

1. Penumpang hanya memperoleh informasi yang diizinkan pada trip aktif melalui kode yang sulit ditebak; akses kode dinonaktifkan ketika trip selesai.
2. Riwayat perjalanan tersedia bagi operator berwenang. GPS historis mentah tidak dibuka kepada publik.
3. GPS mentah disimpan maksimal **90 hari setelah perjalanan** sesuai kebijakan internal proyek. Angka ini merupakan kebijakan rencana yang ditinjau tim, bukan klaim ketentuan hukum umum.
4. Administrator teknis dapat menjalankan mekanisme penghapusan yang didokumentasikan dan diverifikasi pada PM_16/PM_17 dengan data uji berumur.
5. Dataset turunan, ekspor, log, dan cadangan dikelola agar data mentah tetap mengikuti kebijakan retensi. Jika data evaluasi dipertahankan, minimalkan identitas dan catat tujuan, akses, serta masa simpan yang disepakati.
6. Ekspor sederhana FR-17 hanya untuk pihak berwenang dan berstatus Should. Kata sandi, token, dan kredensial tidak masuk ekspor publik.
7. Mekanisme pencadangan/restore dan pencegahan munculnya kembali data yang sudah harus dihapus ditentukan pada PM_16.
8. **Status persetujuan kebijakan:** menunggu review MEET_02. **Status penerapan/pengujian:** belum dibuktikan.

## 9. Pembagian tanggung jawab dan jadwal

Pembagian berikut mengikuti proposal sebagai acuan perencanaan; kesepakatan aktual dapat memperbaruinya.

| Anggota | Peran rencana | Tanggung jawab utama |
| --- | --- | --- |
| Maulana Rizki Ramadhani | Project Manager dan System Analyst | Kebutuhan/batasan, Kanban/jadwal, keputusan tim, izin/koordinasi, serta review penerimaan. |
| Ariel Ivan Permana | Embedded dan IoT | Perangkat, daya, GPS, GSM/MQTT perangkat, buffer, serta bukti komponen. |
| Kristian Dwi Putra | Backend dan Infrastructure | Broker, subscriber/backend, basis data, API, akses, server, retensi, serta deployment/pemulihan. |
| Muhammad Arinal Haq | Frontend dan UI/UX | Rancangan dashboard, implementasi antarmuka, integrasi API, dan pemeriksaan alur pengguna. |
| Sendi Aryadita | Data dan Machine Learning | Dataset, label/fitur, pembagian trip, baseline/model, evaluasi, serta artefak integrasi. |

- Jadwal relatif PM_02: **M1–M2** dari rencana implementasi 16 minggu.
- Tanggal mulai proyek yang disepakati: **[isi tanggal sebenarnya]**.
- Tenggat proyek yang disepakati: **[isi tanggal sebenarnya]**.
- Tanggal review PM_02/MEET_02: **[isi tanggal sebenarnya]**.
- Reviewer dan tenggat tindak lanjut: **[isi nama serta tanggal sebenarnya]**.
- Pengujian lapangan/alat mengikuti kesiapan komponen dan izin; tanggal rencana tidak diubah menjadi catatan seolah sudah dilaksanakan.

## 10. Keputusan yang perlu ditulis saat MEET_02

Isi bagian ini setelah pembahasan. Menyimpan dokumen atau membuat kartu meeting belum berarti tim sudah menyepakati isinya.

| ID keputusan | Hal yang perlu ditinjau | Usulan atau acuan awal | Keputusan aktual dan alasan | PIC serta tenggat tindak lanjut |
| --- | --- | --- | --- | --- |
| K-01 | Kendaraan, arah, target, dan kebutuhan izin | Satu kendaraan; Tanjung Karang–Hajimena–Kotabumi; koordinat masih referensi awal | Belum dicatat | [isi] |
| K-02 | Pengguna, akses, fungsi, dan batas prototipe | Bagian 1–2 dan FR-01–FR-19 | Belum dicatat | [isi] |
| K-03 | Parameter waktu dan target mutu | Bagian 3 dan NFR-01–NFR-15 | Belum dicatat | [isi] |
| K-04 | Jumlah dan pembagian dataset lokal | Usulan 15 trip, 9/3/3; tinjau kelayakan jadwal dan mutu | Belum disepakati | [isi] |
| K-05 | Jumlah/peran UAT dan instrumen | Usulan 6 calon pengguna, 2 operator/4 penumpang | Belum disepakati | [isi] |
| K-06 | Retensi, ekspor, penghapusan, dan cadangan | GPS mentah maksimal 90 hari; akses dibatasi; ekspor Should | Belum dicatat | [isi] |
| K-07 | Pembagian kerja, tanggal mulai, deadline, dan reviewer | Pembagian peran proposal dan jadwal relatif 16 minggu | Belum ditetapkan pada draf | [isi] |

Jika usulan diterima, tulis bahwa tim menerima usulan tersebut dengan tanggal dan pihak yang meninjau. Jika berubah, tulis nilai/keputusan pengganti serta alasannya, lalu selaraskan dokumen ini, proposal/SRS, dan kartu terdampak.

### 10.1 Catatan review dan persetujuan

| Anggota yang benar-benar meninjau | Tanggal | Hasil review atau masukan | Persetujuan atau revisi yang diminta | Tautan bukti |
| --- | --- | --- | --- | --- |
| [isi] | [isi] | [isi] | Belum ada persetujuan yang dicatat | [isi] |

Ringkasan keputusan terbuka: [isi setelah review, termasuk PIC/tenggat].  
Versi yang disetujui: [isi hanya setelah benar-benar disetujui].  
Tautan catatan review/notulen MEET_02 yang telah diisi: [isi].

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
| 8. Rencana trip dan pembagian 9/3/3 | 6 dan K-04 | Tim telah meninjau usulan lalu mencatat menerima atau merevisinya. Tidak menunggu 15 trip benar-benar dikumpulkan. |
| 9. Rencana peserta UAT dan kriteria | 7 dan K-05 | Tim telah meninjau jumlah/peran serta target lalu mencatat keputusan. Tidak menunggu UAT dilaksanakan. |
| 10. Powerbank dan batas fitur | 2 | Sumber daya pilot dan fitur di luar lingkup telah ditegaskan serta dicatat. |
| 11. Retensi dan pengelolaan data | 8 dan K-06 | Kebijakan rencana telah ditinjau/disepakati; implementasi penghapusan dibuktikan pada kartu teknis. |
| 12. Persetujuan, keputusan terbuka, dan tanggal | 9–10 | Review nyata, keputusan tim, tanggal mulai/deadline, dan tindak lanjut sudah dicatat serta perubahan diteruskan ke kartu terkait. |

Setelah isi dan bukti siap, PM_02 dapat diajukan ke In review. Pindah ke Done setelah keputusan perencanaan dan review selesai; hal ini tidak berarti pengujian teknis proyek sudah lulus. Jika keputusan penting belum dibuat, butir terkait tetap belum dicentang.

## 12. Bukti pekerjaan

- Dokumen kebutuhan dan matriks: file ini pada `docs/PM_02_Kebutuhan_dan_Batasan.md` setelah di-commit/push.
- Catatan keputusan/review: [MEET_02](https://github.com/kristiandwiputra/PM-TRAVEL/issues/22), diisi setelah pembahasan; saat ini tautan tersebut menunjuk kartu rencana, bukan bukti persetujuan selesai.
- Commit dokumen PM_02: [isi tautan commit sebenarnya setelah push].
- Bukti masukan/persetujuan anggota: [isi tautan catatan atau komentar sebenarnya].

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
