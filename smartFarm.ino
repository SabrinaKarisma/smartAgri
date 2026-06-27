#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h> 
#include <Adafruit_SSD1306.h>
#include <Adafruit_GFX.h>

const char* ssid = "Wi-Fi USM";
const char* password = "";

const char* serverUrl = "https://script.google.com/macros/s/AKfycbzZ4FEnN4o4SHkTn_fc2CPLULpmPYibM38WYUSPn6tM1obvKZt_8GORQGaD3C4XY0ga1w/exec";

#define DHTPIN 27
#define DHTTYPE DHT22
#define SOIL_PIN 39
#define SERVO_PIN 33
#define LED_PIN 17
#define OLED_SCL 22
#define OLED_SDA 21

DHT dht(DHTPIN, DHTTYPE);
Servo servo;                
Adafruit_SSD1306 display(128, 64, &Wire, -1);

float temperature = 0;
float humidity = 0;
float soilMoisture = 0;
String systemStatus = "IDLE";
bool wateringInProgress = false;
bool manualCommand = false;
unsigned long lastSensorRead = 0;
const unsigned long sensorInterval = 10000;

const int dryValue = 4095;   
const int wetValue = 1500;   

void setup() {
  Serial.begin(115200);
  
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  
  WiFi.begin(ssid, password);
  Serial.print("Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" Connected!");
  
  dht.begin();
  
  servo.attach(SERVO_PIN);
  servo.write(90);
  delay(500);
  
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED failed");
    for(;;);
  }
  display.clearDisplay();
  display.display();
  
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
  soilMoisture = readSoilMoisture();
  displayStatus("BOOTING");
  delay(1000);
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
        wateringSequence();
      } else {
        systemStatus = "IDLE";
      }
    }
    sendSensorData();
    displayStatus(systemStatus);
  }
  
  static unsigned long lastCommandCheck = 0;
  if (currentMillis - lastCommandCheck >= 5000) {
    lastCommandCheck = currentMillis;
    readCommand();
    if (manualCommand && !wateringInProgress) {
      systemStatus = "MANUAL";
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