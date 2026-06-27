#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h> 
#include <Adafruit_SH110X.h>
#include <Adafruit_GFX.h>

const char* ssid = "Wi-Fi USM";
const char* password = "";

const char *serverUrl = "https://script.google.com/macros/s/AKfycbz91aDAZ9DVny5nqCW3q93D5hafNU3VCegEAPcq0u_ikJYgPnpt2rMWl-Hd0HFYZsYKfw/exec";

#define DHTPIN 27
#define DHTTYPE DHT22
#define SOIL_PIN 39
#define SERVO_PIN 33
#define LED_PIN 17
#define OLED_SCL 22
#define OLED_SDA 21

DHT dht(DHTPIN, DHTTYPE);
Servo servo;                
Adafruit_SH1106G display = Adafruit_SH1106G(128, 64, &Wire);

float temperature = 0;
float humidity = 0;
float soilMoisture = 0;
String systemStatus = "IDLE";
bool wateringInProgress = false;
bool manualCommand = false;
unsigned long lastSensorRead = 0;
const unsigned long sensorInterval = 300000;

const int dryValue = 4095;
const int wetValue = 1500;

void setup() {
  Serial.begin(115200);

  if(!display.begin(0x3C, true)) { 
    Serial.println("OLED ERROR");
    for (;;)
      ;
  }
  display.clearDisplay();
  display.display();
  displayStatus("BOOTING");
  delay(100);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); 
  delay(50);

  WiFi.begin(ssid, password);
  Serial.print("Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" Connected!");
  delay(100);

  dht.begin(); delay(100);

  servo.attach(SERVO_PIN);
  servo.write(90);
  delay(500);

  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
  soilMoisture = readSoilMoisture();
  delay(1000);
  displayStatus("OKE");
}

void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - lastSensorRead >= sensorInterval) {
    lastSensorRead = currentMillis;

    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      temperature = t;
      humidity = h;
    }
    soilMoisture = readSoilMoisture();

    if (!wateringInProgress && systemStatus != "MANUAL") {
      if (soilMoisture < 30.0 || temperature > 33.0) {
        systemStatus = "AUTO";
        displayStatus(systemStatus);
        sendSensorData(); 
        wateringSequence();
        systemStatus = "IDLE";
        displayStatus(systemStatus);
      } else {
        systemStatus = "IDLE";
        displayStatus(systemStatus);
        sendSensorData(); 
      }
    }
  }

  static unsigned long lastCommandCheck = 0;
  if (currentMillis - lastCommandCheck >= 5000) {
    lastCommandCheck = currentMillis;
    readCommand();
    if (manualCommand && !wateringInProgress) {
      systemStatus = "MANUAL";
      
      float t = dht.readTemperature();
      float h = dht.readHumidity();
      if (!isnan(t) && !isnan(h)) {
        temperature = t;
        humidity = h;
      }
      soilMoisture = readSoilMoisture();

      displayStatus(systemStatus);
      sendSensorData(); 
      
      wateringSequence();
      
      manualCommand = false;
      systemStatus = "IDLE";
      displayStatus(systemStatus);
    }
  }

  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(1000);
  }
  delay(100);
}