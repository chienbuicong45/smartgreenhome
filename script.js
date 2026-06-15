const firebaseConfig = {
  apiKey: "AIzaSyCQk8ufIlcl0NYEbW7z1COLHW5mLRlx2R0",
  authDomain: "greenhouse-f6569.firebaseapp.com",
  projectId: "greenhouse-f6569",
  storageBucket: "greenhouse-f6569.firebasestorage.app",
  messagingSenderId: "498827540428",
  appId: "1:498827540428:web:2824ce5fa61fb1672f4f69",
  measurementId: "G-MZRGJLD3PP",
};

const firestorePath = {
  collection: "greenhouse_readings",
  document: "current",
};

const authView = document.querySelector("#authView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const emailInput = document.querySelector("#emailInput");
const passwordInput = document.querySelector("#passwordInput");
const passwordToggle = document.querySelector("#passwordToggle");
const authMessage = document.querySelector("#authMessage");
const logoutButton = document.querySelector("#logoutButton");
const temperatureValue = document.querySelector("#temperatureValue");
const humidityValue = document.querySelector("#humidityValue");
const healthValue = document.querySelector("#healthValue");
const temperatureBar = document.querySelector("#temperatureBar");
const humidityBar = document.querySelector("#humidityBar");
const healthBar = document.querySelector("#healthBar");
const temperatureStatus = document.querySelector("#temperatureStatus");
const humidityStatus = document.querySelector("#humidityStatus");
const healthStatus = document.querySelector("#healthStatus");
const connectionText = document.querySelector("#connectionText");
const eventLog = document.querySelector("#eventLog");
const chart = document.querySelector("#environmentChart");
const context = chart.getContext("2d");

const maxPoints = 60;
const readings = [];

let auth = null;
let db = null;
let authApi = null;
let firestoreApi = null;
let unsubscribeReadings = null;
let latestReading = null;
let latestReadingReceivedAt = 0;
let chartIntervalId = null;

function getFirebaseErrorText(error) {
  const code = error?.code || "unknown";
  const message = error?.message || "Không có mô tả lỗi";

  if (code === "auth/unauthorized-domain") {
    return "Domain hiện tại chưa được thêm vào Firebase Authentication > Settings > Authorized domains.";
  }

  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "Email hoặc mật khẩu không đúng.";
  }

  if (code === "permission-denied") {
    return "Firestore rules chưa cho tài khoản này đọc dữ liệu.";
  }

  return `${code}: ${message}`;
}

function showAuthView(message = "") {
  authView.hidden = false;
  dashboardView.hidden = true;
  authMessage.textContent = message;
  stopReadingFirestore();
  stopChartPlayback();
}

function showDashboardView() {
  authView.hidden = true;
  dashboardView.hidden = false;
  requestAnimationFrame(resizeCanvas);
}

function hidePassword() {
  passwordInput.type = "password";
  passwordToggle.classList.remove("is-visible");
  passwordToggle.setAttribute("aria-label", "Hiện mật khẩu");
  passwordToggle.setAttribute("aria-pressed", "false");
}

async function setupFirebase() {
  authMessage.textContent = "Đang kết nối Firebase...";

  try {
    const [{ initializeApp }, firestoreModule, authModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
    ]);

    firestoreApi = firestoreModule;
    authApi = authModule;

    const app = initializeApp(firebaseConfig);
    db = firestoreApi.getFirestore(app);
    auth = authApi.getAuth(app);

    authApi.onAuthStateChanged(auth, (user) => {
      if (!user) {
        showAuthView("Vui lòng đăng nhập để xem dữ liệu.");
        return;
      }

      showDashboardView();
      readings.splice(0, readings.length);
      eventLog.innerHTML = "";
      connectionText.textContent = "Đang kết nối Firestore";
      addEvent(`Đã đăng nhập: ${user.email}`);
      listenToReadings();
    });
  } catch (error) {
    console.error(error);
    showAuthView(`Không thể tải Firebase. Kiểm tra kết nối mạng hoặc chặn CDN. ${getFirebaseErrorText(error)}`);
  }
}

function listenToReadings() {
  stopReadingFirestore();
  stopChartPlayback();

  const readingRef = firestoreApi.doc(db, firestorePath.collection, firestorePath.document);

  unsubscribeReadings = firestoreApi.onSnapshot(
    readingRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        connectionText.textContent = "Firestore sẵn sàng - chưa có dữ liệu";
        addEvent(`Chưa có collection "${firestorePath.collection}" với document "${firestorePath.document}"`, "warning");
        return;
      }

      const latest = normalizeReading(snapshot.data());
      if (!latest) {
        addEvent("Dữ liệu Firestore thiếu temperature hoặc humidity", "warning");
        return;
      }

      latestReading = latest;
      latestReadingReceivedAt = Date.now();
      pushReading(latest);
      startChartPlayback();
      addEvent(`Đã kết nối document "${firestorePath.document}"`);
    },
    (error) => {
      console.error(error);
      connectionText.textContent = "Lỗi đọc Firestore";
      addEvent(`Không đọc được dữ liệu Firestore: ${getFirebaseErrorText(error)}`, "danger");
    },
  );
}

function normalizeReading(data) {
  const temperature = Number(data.temperature);
  const humidity = Number(data.humidity);

  if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) {
    return null;
  }

  return {
    time: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
    temperature: Number(temperature.toFixed(1)),
    humidity: Math.round(humidity),
  };
}

function startChartPlayback() {
  if (chartIntervalId) return;

  chartIntervalId = setInterval(() => {
    if (!latestReading || Date.now() - latestReadingReceivedAt < 1800) return;

    pushReading({
      ...latestReading,
      time: new Date(),
    });
  }, 2000);
}

function stopChartPlayback() {
  clearInterval(chartIntervalId);
  chartIntervalId = null;
  latestReading = null;
}

function stopReadingFirestore() {
  if (!unsubscribeReadings) return;
  unsubscribeReadings();
  unsubscribeReadings = null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getTemperatureStatus(value) {
  if (value < 24) return ["Hơi lạnh, cần kiểm tra nhiệt độ", "warning"];
  if (value > 32) return ["Nhiệt độ cao, cần theo dõi", "danger"];
  return ["Trong ngưỡng tối ưu", "normal"];
}

function getHumidityStatus(value) {
  if (value < 55) return ["Độ ẩm thấp, cần theo dõi", "warning"];
  if (value > 82) return ["Độ ẩm cao, cần theo dõi", "danger"];
  return ["Độ ẩm phù hợp", "normal"];
}

function calculateHealth(temperature, humidity) {
  const tempScore = 100 - Math.abs(temperature - 28) * 8;
  const humidityScore = 100 - Math.abs(humidity - 68) * 2;
  return Math.round(clamp((tempScore + humidityScore) / 2, 0, 100));
}

function updateDashboard(reading) {
  const [tempMessage, tempLevel] = getTemperatureStatus(reading.temperature);
  const [humidityMessage, humidityLevel] = getHumidityStatus(reading.humidity);
  const health = calculateHealth(reading.temperature, reading.humidity);

  temperatureValue.textContent = `${reading.temperature}°C`;
  humidityValue.textContent = `${reading.humidity}%`;
  healthValue.textContent = `${health}%`;
  temperatureBar.style.width = `${clamp((reading.temperature / 40) * 100, 0, 100)}%`;
  humidityBar.style.width = `${clamp(reading.humidity, 0, 100)}%`;
  healthBar.style.width = `${health}%`;
  temperatureStatus.textContent = tempMessage;
  humidityStatus.textContent = humidityMessage;
  healthStatus.textContent = health >= 75 ? "Môi trường ổn định" : "Cần theo dõi điều kiện";
  connectionText.textContent = `Cập nhật ${reading.time.toLocaleTimeString("vi-VN")}`;

  if (tempLevel !== "normal") addEvent(tempMessage, tempLevel);
  if (humidityLevel !== "normal") addEvent(humidityMessage, humidityLevel);
}

function addEvent(message, level = "normal") {
  const last = eventLog.firstElementChild;
  if (last && last.dataset.message === message) return;

  const item = document.createElement("li");
  item.className = level === "normal" ? "" : level;
  item.dataset.message = message;
  item.innerHTML = `<strong>${new Date().toLocaleTimeString("vi-VN")}</strong>${message}`;
  eventLog.prepend(item);

  while (eventLog.children.length > 6) {
    eventLog.lastElementChild.remove();
  }
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = chart.getBoundingClientRect();

  if (!rect.width || !rect.height) return;

  chart.width = Math.floor(rect.width * ratio);
  chart.height = Math.floor(rect.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawChart();
}

function drawChart() {
  const rect = chart.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const padding = { top: 20, right: 18, bottom: 32, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  context.clearRect(0, 0, width, height);
  drawGrid(width, height, padding, plotWidth, plotHeight);

  if (readings.length < 2) return;

  drawLine({
    color: "#d95f48",
    points: readings.map((item) => item.temperature),
    min: 18,
    max: 40,
    padding,
    plotWidth,
    plotHeight,
  });

  drawLine({
    color: "#2d7fb8",
    points: readings.map((item) => item.humidity),
    min: 30,
    max: 100,
    padding,
    plotWidth,
    plotHeight,
  });
}

function drawGrid(width, height, padding, plotWidth, plotHeight) {
  context.strokeStyle = "#e2e9e3";
  context.lineWidth = 1;
  context.fillStyle = "#66736d";
  context.font = "12px Inter, system-ui, sans-serif";

  for (let index = 0; index <= 4; index += 1) {
    const y = padding.top + (plotHeight / 4) * index;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
  }

  context.fillText("40°C / 100%", 4, padding.top + 4);
  context.fillText("18°C / 30%", 6, height - padding.bottom);
  context.fillText("60 giây", width - 68, height - 8);
}

function drawLine({ color, points, min, max, padding, plotWidth, plotHeight }) {
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.beginPath();

  points.forEach((value, index) => {
    const x = padding.left + (plotWidth / (maxPoints - 1)) * index;
    const normalized = (value - min) / (max - min);
    const y = padding.top + plotHeight - clamp(normalized, 0, 1) * plotHeight;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();
}

function pushReading(reading) {
  readings.push(reading);

  while (readings.length > maxPoints) {
    readings.shift();
  }

  updateDashboard(reading);
  drawChart();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!authApi || !auth) {
    authMessage.textContent = "Firebase chưa sẵn sàng.";
    return;
  }

  authMessage.textContent = "Đang đăng nhập...";

  try {
    await authApi.signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    loginForm.reset();
    hidePassword();
    authMessage.textContent = "";
  } catch (error) {
    console.error(error);
    authMessage.textContent = `Đăng nhập thất bại: ${getFirebaseErrorText(error)}`;
  }
});

passwordToggle.addEventListener("click", () => {
  const isPasswordHidden = passwordInput.type === "password";

  passwordInput.type = isPasswordHidden ? "text" : "password";
  passwordToggle.classList.toggle("is-visible", isPasswordHidden);
  passwordToggle.setAttribute("aria-label", isPasswordHidden ? "Ẩn mật khẩu" : "Hiện mật khẩu");
  passwordToggle.setAttribute("aria-pressed", String(isPasswordHidden));
});

logoutButton.addEventListener("click", async () => {
  if (!authApi || !auth) return;

  try {
    await authApi.signOut(auth);
    readings.splice(0, readings.length);
    eventLog.innerHTML = "";
    stopChartPlayback();
  } catch (error) {
    console.error(error);
    addEvent(`Không thể đăng xuất: ${getFirebaseErrorText(error)}`, "danger");
  }
});

window.addEventListener("resize", resizeCanvas);
window.addEventListener("beforeunload", () => {
  stopChartPlayback();
  stopReadingFirestore();
});

setupFirebase();
