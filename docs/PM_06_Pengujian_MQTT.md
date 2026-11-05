# PM_06 — Pengujian MQTT

## 1. Lingkungan Pengujian

- Sistem operasi: Windows 11
- MQTT Broker lokal: Eclipse Mosquitto 2.1.2
- Port pengujian awal: 1883
- Port pengujian autentikasi: 1884
- MQTT Client: MQTTX

## 2. Hasil Pengujian

- [x] Mosquitto berhasil diinstal dan dijalankan.
- [x] Publish dan subscribe lokal berhasil dengan QoS 1.
- [x] Kredensial perangkat dan backend berhasil dibuat.
- [x] File konfigurasi dan ACL berhasil divalidasi.
- [x] Broker pengujian port 1884 berhasil dijalankan.
- [x] Koneksi TCP ke port 1884 berhasil.
- [ ] Pengujian login kedua akun melalui MQTTX.
- [ ] Pengujian pembatasan akses ACL.
- [ ] Pengujian telemetri dan ACK sesuai kontrak.
- [ ] Pengujian koneksi salah dan akses tanpa izin.
- [ ] Pengujian TLS dan sertifikat.
- [ ] Pengujian reconnect.

## 3. Pengujian ESP32

ESP32 dan SIM800L sebelumnya berhasil mengirim
data GPS menggunakan broker publik HiveMQ.

Host: broker.hivemq.com
Port: 1883
Topik: pmtravel/PMT-001/test
QoS: 1

Pengujian tersebut terpisah dari konfigurasi
Mosquitto lokal dengan autentikasi dan ACL.

## 4. Keterbatasan

Pengujian MQTT belum membuktikan bahwa data
berhasil disimpan ke PostgreSQL atau bahwa ACK
aplikasi telah diterima oleh ESP32.

Integrasi akhir akan menggunakan VPS Biznet Gio.