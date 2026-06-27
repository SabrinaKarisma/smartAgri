float readSoilMoisture() {
  int raw = analogRead(SOIL_PIN);
  float percent = map(raw, wetValue, dryValue, 100, 0);
  if (percent < 0) percent = 0;
  if (percent > 100) percent = 100;
  return percent;
}

void wateringSequence() {
  if (wateringInProgress) return;
  wateringInProgress = true;
  digitalWrite(LED_PIN, HIGH);
  
  int angles[] = {30, 60, 90, 120, 150};
  for (int i = 0; i < 5; i++) {
    servo.write(angles[i]);
    delay(2000);
  }
  servo.write(90);
  delay(500);
  
  digitalWrite(LED_PIN, LOW);
  wateringInProgress = false;
  systemStatus = "IDLE";
  displayStatus("IDLE");
}

void displayStatus(String status) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,0);
  display.println("Smart Watering");
  display.print("Temp: "); display.print(temperature); display.println(" C");
  display.print("Hum : "); display.print(humidity); display.println(" %");
  display.print("Soil: "); display.print(soilMoisture); display.println(" %");
  display.print("Status: "); display.println(status);
  display.print("WiFi : ");
  if (WiFi.status() == WL_CONNECTED) display.println("CONNECTED");
  else display.println("DISCONNECTED");
  display.display();
}

void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(serverUrl);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<200> doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["soil"] = soilMoisture;
  doc["status"] = systemStatus;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  if (httpResponseCode > 0) {
    Serial.println("Data sent successfully");
  } else {
    Serial.printf("Error sending: %d\n", httpResponseCode);
  }
  http.end();
}

void readCommand() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  String url = String(serverUrl) + "?command=true";
  http.begin(url);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  int httpCode = http.GET();
  if (httpCode > 0) {
    String payload = http.getString();
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, payload);
    if (!error) {
      bool manual = doc["manualWatering"] | false;
      if (manual && !wateringInProgress) {
        systemStatus = "MANUAL";
        manualCommand = true;
      }
    } else {
      Serial.print("Deserialize error: ");
      Serial.println(error.c_str());
    }
  }
  http.end();
}
