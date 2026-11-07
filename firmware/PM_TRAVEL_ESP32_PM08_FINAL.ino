/*
 * PM-TRAVEL — ESP32 / NEO-6M / SIM800L
 * Integrasi telemetri native PM_08 + ACK aplikasi.
 *
 * Broker di bawah adalah broker PUBLIK dan hanya untuk uji lokal.
 * Pesan koordinat tidak terenkripsi. Gunakan broker privat dengan
 * autentikasi dan transport aman sebelum pengujian lapangan/deployment.
 *
 * Buffer saat ini hanya SATU pesan di RAM. Antrian persisten adalah
 * pekerjaan PM_09, bukan bagian firmware ini.
 */

#define TINY_GSM_MODEM_SIM800
#define TINY_GSM_RX_BUFFER 1024

#include <Arduino.h>
#include <HardwareSerial.h>
#include <TinyGPS++.h>
#include <TinyGsmClient.h>
#include <ArduinoMqttClient.h>
#include <esp_system.h>

HardwareSerial sim800(1);
HardwareSerial gpsSerial(2);

const int SIM800_RX = 18;
const int SIM800_TX = 19;
const int GPS_RX = 16;
const int GPS_TX = 17;

TinyGPSPlus gpsParser;
TinyGsm modem(sim800);
TinyGsmClient gsmClient(modem);
MqttClient mqttClient(gsmClient);

const char DEVICE_ID[] = "PMT-001";
const char MQTT_HOST[] = "broker.hivemq.com"; // PUBLIK: khusus uji
const uint16_t MQTT_PORT = 1883;
const char MQTT_CLIENT_ID[] = "PMT-001-ESP32";
const char MQTT_TOPIC[] = "pmtravel/PMT-001/telemetry";
const char MQTT_ACK_TOPIC[] = "pmtravel/PMT-001/ack";

const char APN[] = "internet";
const char APN_USER[] = "";
const char APN_PASS[] = "";

// GPS NEO-6M dibaca kontinu setiap byte masuk (lihat loop).
// Status/latest fix diperiksa sekali per detik, tanpa delay(1000).
const unsigned long INTERVAL_MONITOR_GPS = 1000UL;
// Telemetri native ke MQTT setiap 10 detik, jika slot ACK tersedia.
const unsigned long INTERVAL_KIRIM = 10000UL;
const unsigned long INTERVAL_KONEKSI = 10000UL;
const unsigned long INTERVAL_ULANG_ACK = 20000UL;
const unsigned long MQTT_KEEPALIVE = 60000UL;
const unsigned long MAX_USIA_GPS = 5000UL;
const size_t MAX_PAYLOAD = 512;

unsigned long waktuKirimTerakhir = 0;
unsigned long waktuCekKoneksi = 0;
unsigned long waktuKirimPending = 0;
unsigned long waktuMonitorGPS = 0;

String bootId;
uint32_t sequenceId = 0;
bool adaPending = false;
String pendingMessageId;
String pendingPayload;

// Hanya untuk memproses ACK JSON sederhana yang dibuat backend PM_08.
String ambilStringJSON(const String &json, const char *key) {
  String needle = String("\"") + key + "\"";
  int posisi = json.indexOf(needle);
  if (posisi < 0) return "";

  int titikDua = json.indexOf(':', posisi + needle.length());
  if (titikDua < 0) return "";
  int petikAwal = json.indexOf('"', titikDua + 1);
  if (petikAwal < 0) return "";
  int petikAkhir = json.indexOf('"', petikAwal + 1);
  if (petikAkhir < 0) return "";
  return json.substring(petikAwal + 1, petikAkhir);
}

void terimaPesanMQTT(int messageSize) {
  String topic = mqttClient.messageTopic();
  String payload;

  // ACK backend normal < 512 byte; pesan lebih besar dibuang dengan aman.
  if (messageSize > (int)MAX_PAYLOAD) {
    while (mqttClient.available()) mqttClient.read();
    Serial.println("[ACK] Payload terlalu besar, diabaikan.");
    return;
  }

  payload.reserve(messageSize + 1);
  while (mqttClient.available()) payload += (char)mqttClient.read();
  if (topic != MQTT_ACK_TOPIC) return;

  String ackDevice = ambilStringJSON(payload, "device_id");
  String ackMessage = ambilStringJSON(payload, "message_id");
  String ackStatus = ambilStringJSON(payload, "status");

  if (adaPending && ackDevice == DEVICE_ID &&
      ackMessage == pendingMessageId &&
      (ackStatus == "stored" || ackStatus == "duplicate")) {
    Serial.print("[ACK BACKEND] Tersimpan | message_id=");
    Serial.print(ackMessage);
    Serial.print(" | status=");
    Serial.println(ackStatus);

    // Hapus pesan hanya setelah ACK aplikasi yang cocok diterima.
    adaPending = false;
    pendingMessageId = "";
    pendingPayload = "";
  } else {
    Serial.print("[ACK] Diabaikan (ID/status tidak cocok): ");
    Serial.println(payload);
  }
}

bool gpsSiap() {
  return gpsParser.location.isValid() &&
         gpsParser.location.age() < MAX_USIA_GPS &&
         gpsParser.date.isValid() &&
         gpsParser.date.age() < MAX_USIA_GPS &&
         gpsParser.time.isValid() &&
         gpsParser.time.age() < MAX_USIA_GPS &&
         gpsParser.speed.isValid() &&
         gpsParser.speed.age() < MAX_USIA_GPS;
}

// Pemeriksaan GPS per 1 detik untuk monitoring Serial.
// Parser harus tetap menerima SEMUA byte NMEA secara kontinu di loop.
// Fungsi ini tidak membuat posisi baru dan tidak mengirim MQTT.
void monitorGPS1Detik() {
  if (millis() - waktuMonitorGPS < INTERVAL_MONITOR_GPS) return;
  waktuMonitorGPS = millis();

  if (!gpsSiap()) {
    Serial.println("[GPS 1s] Menunggu fix valid/waktu/kecepatan terbaru.");
    return;
  }

  Serial.print("[GPS 1s] VALID | lat=");
  Serial.print(gpsParser.location.lat(), 6);
  Serial.print(" | lon=");
  Serial.print(gpsParser.location.lng(), 6);
  Serial.print(" | km/jam=");
  Serial.print(gpsParser.speed.kmph(), 2);
  Serial.print(" | age_ms=");
  Serial.println(gpsParser.location.age());
}

String buatJSON(bool gpsValid, const String &messageId) {
  String json;
  json.reserve(420);

  json += "{\"device_id\":\"";
  json += DEVICE_ID;
  json += "\",\"boot_id\":\"";
  json += bootId;
  json += "\",\"sequence_id\":";
  json += String(sequenceId);
  json += ",\"message_id\":\"";
  json += messageId;
  json += "\",\"trip_id\":null,\"observed_at\":";

  if (gpsValid) {
    char waktuUTC[25];
    snprintf(waktuUTC, sizeof(waktuUTC),
             "%04u-%02u-%02uT%02u:%02u:%02uZ",
             (unsigned int)gpsParser.date.year(),
             (unsigned int)gpsParser.date.month(),
             (unsigned int)gpsParser.date.day(),
             (unsigned int)gpsParser.time.hour(),
             (unsigned int)gpsParser.time.minute(),
             (unsigned int)gpsParser.time.second());
    json += '"';
    json += waktuUTC;
    json += '"';
  } else {
    json += "null";
  }

  json += ",\"latitude\":";
  if (gpsValid) json += String(gpsParser.location.lat(), 6);
  else json += "null";

  json += ",\"longitude\":";
  if (gpsValid) json += String(gpsParser.location.lng(), 6);
  else json += "null";

  json += ",\"speed_kmh\":";
  if (gpsValid) json += String(gpsParser.speed.kmph(), 2);
  else json += "null";

  json += ",\"gps_valid\":";
  if (gpsValid) json += "true";
  else json += "false";

  json += ",\"satellites\":";
  if (gpsParser.satellites.isValid())
    json += String(gpsParser.satellites.value());
  else
    json += "null";

  json += ",\"hdop\":";
  if (gpsParser.hdop.isValid())
    json += String(gpsParser.hdop.hdop(), 2);
  else
    json += "null";

  json += "}";
  return json;
}

void cekKoneksi() {
  if (millis() - waktuCekKoneksi < INTERVAL_KONEKSI) return;
  waktuCekKoneksi = millis();

  if (!modem.isNetworkConnected()) {
    Serial.println("[SIM800L] Mencari jaringan...");
    if (!modem.waitForNetwork(10000L)) {
      Serial.println("[SIM800L] Jaringan belum tersedia.");
      return;
    }
  }

  if (!modem.isGprsConnected()) {
    Serial.println("[GPRS] Menghubungkan internet...");
    if (!modem.gprsConnect(APN, APN_USER, APN_PASS)) {
      Serial.println("[GPRS] Gagal menghubungkan internet.");
      return;
    }
  }

  if (!mqttClient.connected()) {
    Serial.println("[MQTT] Menghubungkan ke broker...");
    if (mqttClient.connect(MQTT_HOST, MQTT_PORT)) {
      Serial.println("[MQTT] Terhubung.");
      if (mqttClient.subscribe(MQTT_ACK_TOPIC, 1))
        Serial.println("[MQTT] Subscribe ACK berhasil.");
      else
        Serial.println("[MQTT] Subscribe ACK gagal.");
    } else {
      Serial.print("[MQTT] Gagal, kode: ");
      Serial.println(mqttClient.connectError());
    }
  }
}

void siapkanPesan() {
  if (adaPending) return;

  sequenceId++;
  pendingMessageId = String(DEVICE_ID) + "-" + bootId + "-" + String(sequenceId);
  pendingPayload = buatJSON(gpsSiap(), pendingMessageId);

  if (pendingPayload.length() > MAX_PAYLOAD) {
    Serial.println("[MQTT] JSON >512 byte, pesan dibatalkan.");
    pendingPayload = "";
    pendingMessageId = "";
    return;
  }

  adaPending = true;
  waktuKirimPending = millis() - INTERVAL_ULANG_ACK;
  Serial.print("[GPS] Pesan disiapkan: ");
  Serial.println(pendingPayload);
}

void kirimPending() {
  if (!adaPending || !mqttClient.connected()) return;
  if (millis() - waktuKirimPending < INTERVAL_ULANG_ACK) return;
  waktuKirimPending = millis();

  if (!mqttClient.beginMessage(MQTT_TOPIC,
                               (unsigned long)pendingPayload.length(),
                               false, 1)) {
    Serial.println("[MQTT] Gagal memulai publish.");
    return;
  }

  mqttClient.print(pendingPayload);
  if (mqttClient.endMessage()) {
    Serial.print("[MQTT] PUBACK broker diterima, menunggu ACK backend: ");
    Serial.println(pendingMessageId);
  } else {
    Serial.println("[MQTT] Publish gagal, akan diulang dengan ID sama.");
  }
}

void setup() {
  Serial.begin(115200);
  sim800.begin(115200, SERIAL_8N1, SIM800_RX, SIM800_TX);
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  delay(1500);

  uint64_t chipId = ESP.getEfuseMac();
  char bootBuffer[32];
  snprintf(bootBuffer, sizeof(bootBuffer), "B%08lX%08lX",
           (unsigned long)(chipId & 0xFFFFFFFFUL),
           (unsigned long)esp_random());
  bootId = String(bootBuffer);

  mqttClient.setId(MQTT_CLIENT_ID);
  mqttClient.setKeepAliveInterval(MQTT_KEEPALIVE);
  mqttClient.setConnectionTimeout(15000UL);
  mqttClient.onMessage(terimaPesanMQTT);

  // Agar pengecekan koneksi pertama berlangsung segera.
  waktuCekKoneksi = millis() - INTERVAL_KONEKSI;

  Serial.println("=== PM-TRAVEL PM_08 — NATIVE TELEMETRY ===");
  Serial.println("[PERINGATAN] Broker publik: gunakan hanya untuk uji.");
  Serial.println("Monitor GPS: 1 detik; kirim MQTT: 10 detik; ulang ACK: 20 detik.");
  Serial.println("[SIM800L] Inisialisasi modem...");
  modem.restart();
  Serial.print("[SIM800L] Modem: ");
  Serial.println(modem.getModemInfo());
}

void loop() {
  // Jangan diganti dengan delay(1000): setiap byte GPS harus segera diproses.
  while (gpsSerial.available()) gpsParser.encode(gpsSerial.read());
  monitorGPS1Detik();

  if (mqttClient.connected()) mqttClient.poll();
  cekKoneksi();

  if (millis() - waktuKirimTerakhir >= INTERVAL_KIRIM) {
    waktuKirimTerakhir = millis();
    siapkanPesan();
  }

  kirimPending();
  delay(2);
}
