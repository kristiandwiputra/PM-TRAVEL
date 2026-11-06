# PM_06 — Catatan Keterbatasan dan Kebutuhan Integrasi MQTT

## 1. Hasil Pengujian

Pengujian awal PM-TRAVEL menggunakan HiveMQ Public berhasil menunjukkan pengiriman data GPS dari ESP32 melalui modul SIM800L ke broker MQTT. Data yang diterima melalui MQTTX mencakup identitas kendaraan, latitude, longitude, kecepatan, arah, jumlah satelit, timestamp, dan status validitas GPS.

Mosquitto lokal juga telah dikonfigurasi sebagai lingkungan pengujian MQTT pada `127.0.0.1:1884`, menggunakan autentikasi pengguna dan Access Control List (ACL).

Pengujian melalui MQTTX telah menunjukkan keberhasilan komunikasi publish-subscribe telemetry, pengiriman dan penerimaan ACK, pembatasan akses antarperangkat, serta pengujian QoS dan retained message. Pengujian sesi, TLS, dan reconnect juga telah dilaksanakan pada tahap pengujian lokal.

## 2. Keterbatasan Pengujian

Meskipun komunikasi MQTT telah berhasil diuji, terdapat beberapa keterbatasan:

1. Pengujian HiveMQ Public membuktikan komunikasi ESP32, SIM800L, dan GPS melalui jaringan seluler, tetapi belum membuktikan koneksi perangkat langsung ke Mosquitto pada VPS.
2. Pengujian MQTTX pada Mosquitto lokal belum membuktikan kemampuan modem SIM800L menggunakan konfigurasi autentikasi dan keamanan yang sama.
3. Pengujian MQTT belum membuktikan bahwa backend FastAPI berhasil menerima, memvalidasi, dan menyimpan telemetry ke PostgreSQL/PostGIS.
4. Keberhasilan pengiriman pesan MQTT belum membuktikan ketahanan penyimpanan data maupun ketepatan estimasi waktu kedatangan (ETA).

## 3. Kebutuhan Integrasi Berikutnya

Tahap pengembangan berikutnya meliputi:

1. Mengintegrasikan subscriber MQTT dengan backend FastAPI.
2. Melakukan validasi dan penyimpanan telemetry ke PostgreSQL/PostGIS.
3. Mengintegrasikan backend dengan dashboard PM-TRAVEL.
4. Menguji koneksi perangkat ESP32/SIM800L ke broker Mosquitto pada lingkungan server.
5. Memvalidasi kembali autentikasi, TLS, dan reconnect dalam lingkungan deployment.

## 4. Rencana Deployment

Sesuai arsitektur PM-TRAVEL, broker utama pada tahap deployment akan menggunakan Eclipse Mosquitto yang berjalan pada VPS. HiveMQ Public hanya digunakan untuk pengujian awal komunikasi perangkat.

**Kesimpulan:** Pengujian PM_06 telah memberikan bukti awal keberhasilan komunikasi MQTT serta pengaturan akses pada broker lokal. Integrasi backend, database, dan pengujian perangkat langsung ke broker server dilanjutkan pada tahap berikutnya.