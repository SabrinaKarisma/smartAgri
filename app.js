const API_BASE = 'https://script.google.com/macros/s/AKfycbz91aDAZ9DVny5nqCW3q93D5hafNU3VCegEAPcq0u_ikJYgPnpt2rMWl-Hd0HFYZsYKfw/exec';

const tempValue = document.getElementById('tempValue');
const humValue = document.getElementById('humValue');
const soilValue = document.getElementById('soilValue');
const statusValue = document.getElementById('statusValue');
const historyBody = document.getElementById('historyBody');
const waterBtn = document.getElementById('waterBtn');
const commandStatus = document.getElementById('commandStatus');
const downloadBtn = document.getElementById('downloadCsvBtn');

const ctxTemp = document.getElementById('tempChart').getContext('2d');
const ctxHum = document.getElementById('humChart').getContext('2d');
const ctxSoil = document.getElementById('soilChart').getContext('2d');

const colors = {
  temp: 'rgba(255, 99, 132, 0.8)',
  hum: 'rgba(54, 162, 235, 0.8)',
  soil: 'rgba(255, 206, 86, 0.8)'
};

const tempChart = new Chart(ctxTemp, {
  type: 'line',
  data: { labels: [], datasets: [{ label: 'Suhu (°C)', data: [], borderColor: colors.temp, backgroundColor: 'rgba(255,99,132,0.2)', fill: true, tension: 0.3 }] },
  options: { responsive: true, maintainAspectRatio: true }
});

const humChart = new Chart(ctxHum, {
  type: 'line',
  data: { labels: [], datasets: [{ label: 'Kelembapan Udara (%)', data: [], borderColor: colors.hum, backgroundColor: 'rgba(54,162,235,0.2)', fill: true, tension: 0.3 }] },
  options: { responsive: true, maintainAspectRatio: true }
});

const soilChart = new Chart(ctxSoil, {
  type: 'line',
  data: { labels: [], datasets: [{ label: 'Kelembapan Tanah (%)', data: [], borderColor: colors.soil, backgroundColor: 'rgba(255,206,86,0.2)', fill: true, tension: 0.3 }] },
  options: { responsive: true, maintainAspectRatio: true }
});

async function fetchLatest() {
  try {
    const res = await fetch(`${API_BASE}?latest=true`);
    const data = await res.json();
    if (data.error) {
      console.warn('No data');
      return;
    }
    tempValue.textContent = data.temperature + ' °C';
    humValue.textContent = data.humidity + ' %';
    soilValue.textContent = data.soil + ' %';
    statusValue.textContent = data.status || 'IDLE';

    const dataTime = new Date(data.timestamp).getTime();
    const now = Date.now();
    const diffMs = now - dataTime;
    const isConnected = diffMs < 360000;
    const connEl = document.getElementById('connectionStatus');
    if (connEl) {
       connEl.innerHTML = isConnected 
           ? '<span style="color: green;">🟢 ESP Connected</span>' 
           : '<span style="color: red;">🔴 ESP Disconnected</span>';
    }

  } catch (err) {
    console.error('Error fetching latest:', err);
  }
}

async function fetchHistory() {
  try {
    const res = await fetch(`${API_BASE}?history=true`);
    const history = await res.json();
    if (!Array.isArray(history) || history.length === 0) {
      historyBody.innerHTML = '<tr><td colspan="5">Tidak ada data</td></tr>';
      return;
    }

    // Update tabel
    let rows = '';
    history.slice().reverse().forEach(item => {
      const timestamp = new Date(item.timestamp).toLocaleString('id-ID');
      rows += `<tr>
        <td>${timestamp}</td>
        <td>${item.temperature}</td>
        <td>${item.humidity}</td>
        <td>${item.soil}</td>
        <td>${item.status}</td>
      </tr>`;
    });
    historyBody.innerHTML = rows;

    const dataPoints = history.slice(-50);
    const labels = dataPoints.map(d => new Date(d.timestamp).toLocaleTimeString('id-ID'));
    const tempData = dataPoints.map(d => d.temperature);
    const humData = dataPoints.map(d => d.humidity);
    const soilData = dataPoints.map(d => d.soil);

    tempChart.data.labels = labels;
    tempChart.data.datasets[0].data = tempData;
    tempChart.update();

    humChart.data.labels = labels;
    humChart.data.datasets[0].data = humData;
    humChart.update();

    soilChart.data.labels = labels;
    soilChart.data.datasets[0].data = soilData;
    soilChart.update();

  } catch (err) {
    console.error('Error fetching history:', err);
  }
}

async function sendManualWatering() {
  try {
    commandStatus.textContent = 'Mengirim perintah...';
    const commandRes = await fetch(`${API_BASE}?setManual=true`);
    const result = await commandRes.json();
    
    commandStatus.textContent = 'Perintah penyiraman dikirim!';
    refreshDashboard();
    setTimeout(() => { commandStatus.textContent = ''; }, 5000);
  } catch (err) {
    commandStatus.textContent = 'Gagal mengirim perintah';
    console.error(err);
  }
}

function exportCSV() {
  const rows = document.querySelectorAll('#historyBody tr');
  if (rows.length === 0 || rows[0].cells.length === 1) {
    alert('Tidak ada data untuk diexport.');
    return;
  }
  let csv = 'Timestamp,Suhu,Humidity,Soil,Status\n';
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length === 5) {
      const values = Array.from(cells).map(td => td.textContent.trim());
      csv += values.join(',') + '\n';
    }
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `data_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const deleteBtn = document.getElementById('deleteDataBtn');

if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
        try {
            const res = await fetch(`${API_BASE}?clear=true`);
            const result = await res.json();
            alert('Hapus data berhasil diproses server.');
            refreshDashboard();
        } catch (err) {
            console.error('Error deleting data:', err);
            alert('Gagal menghapus data');
        }
    });
}

function refreshDashboard() {
  fetchLatest();
  fetchHistory();
}

waterBtn.addEventListener('click', sendManualWatering);
downloadBtn.addEventListener('click', exportCSV);

refreshDashboard();
setInterval(refreshDashboard, 5000);