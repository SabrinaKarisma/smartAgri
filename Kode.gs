var SPREADSHEET_ID = '1My0cPM7gQzttwIwPEFtNf_uS7XyEm5kweEaYrZOnTeo';

var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
var monitoringSheet = ss.getSheetByName("Monitoring");
var commandSheet = ss.getSheetByName("Command");

function doGet(e) {
  if (e && e.parameter && e.parameter.setManual) {
    var val = e.parameter.setManual.toLowerCase() === 'true';
    commandSheet.getRange("A2").setValue(val);
    return ContentService.createTextOutput(JSON.stringify({ success: true, manualWatering: val }))
           .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Endpoint untuk dibaca oleh ESP32
  if (e && e.parameter && e.parameter.command) {
    var data = commandSheet.getRange("A2").getValue();
    var manual = (data === true || data === "TRUE" || data === "true");
    
    // PENTING: Reset status manual ke false setelah dibaca ESP agar tidak terjadi loop siram terus menerus
    if (manual) {
      commandSheet.getRange("A2").setValue(false);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ manualWatering: manual }))
           .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Endpoint untuk menghapus history data
  if (e && e.parameter && e.parameter.clear) {
    var val = e.parameter.clear.toLowerCase() === 'true';
    if (val) {
      var lastRow = monitoringSheet.getLastRow();
      if (lastRow > 1) {
        monitoringSheet.getRange(2, 1, lastRow - 1, 5).clearContent();
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Data cleared" }))
             .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  if (e && e.parameter && e.parameter.latest) {
    return getLatest();
  }
  if (e && e.parameter && e.parameter.history) {
    return getHistory();
  }
  return ContentService.createTextOutput("API Smart Watering Aktif!");
}

function doPost(e) {
  try {
    var json = JSON.parse(e.postData.contents);
    if (json.command === 'manual') {
      commandSheet.getRange("A2").setValue(true);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
             .setMimeType(ContentService.MimeType.JSON);
    }
    var temp = json.temperature;
    var hum = json.humidity;
    var soil = json.soil;
    var status = json.status || "IDLE";
    var timestamp = new Date();
    monitoringSheet.appendRow([timestamp, temp, hum, soil, status]);
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
           .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
           .setMimeType(ContentService.MimeType.JSON);
  }
}

function getLatest() {
  var lastRow = monitoringSheet.getLastRow();
  if (lastRow < 2) {
    return ContentService.createTextOutput(JSON.stringify({ error: "No data" }))
           .setMimeType(ContentService.MimeType.JSON);
  }
  var row = monitoringSheet.getRange(lastRow, 1, 1, 5).getValues()[0];
  return ContentService.createTextOutput(JSON.stringify({
    timestamp: row[0],
    temperature: row[1],
    humidity: row[2],
    soil: row[3],
    status: row[4]
  })).setMimeType(ContentService.MimeType.JSON);
}

function getHistory() {
  var lastRow = monitoringSheet.getLastRow();
  if (lastRow < 2) {
    return ContentService.createTextOutput(JSON.stringify([]))
           .setMimeType(ContentService.MimeType.JSON);
  }
  var startRow = Math.max(2, lastRow - 99);
  var numRows = lastRow - startRow + 1;
  var range = monitoringSheet.getRange(startRow, 1, numRows, 5);
  var values = range.getValues();
  var data = [];
  for (var i = 0; i < values.length; i++) {
    data.push({
      timestamp: values[i][0],
      temperature: values[i][1],
      humidity: values[i][2],
      soil: values[i][3],
      status: values[i][4]
    });
  }
  return ContentService.createTextOutput(JSON.stringify(data))
         .setMimeType(ContentService.MimeType.JSON);
}
