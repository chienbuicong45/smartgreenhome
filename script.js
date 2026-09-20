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
  historyCollection: "greenhouse_history",
  settingsCollection: "greenhouse_settings",
  settingsDocument: "shared",
};

const emailJsConfig = Object.freeze({
  serviceId: "service_tjcinlf",
  templateId: "template_puyrylj",
  publicKey: "C-uAY1RMcz_M-MEnv",
  endpoint: "https://api.emailjs.com/api/v1.0/email/send",
});

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
const temperatureBar = document.querySelector("#temperatureBar");
const humidityBar = document.querySelector("#humidityBar");
const temperatureStatus = document.querySelector("#temperatureStatus");
const humidityStatus = document.querySelector("#humidityStatus");
const connectionText = document.querySelector("#connectionText");
const connectionStatus = connectionText.closest(".status-pill");
const eventLog = document.querySelector("#eventLog");
const loginHistoryLog = document.querySelector("#loginHistoryLog");
const chart = document.querySelector("#environmentChart");
const context = chart.getContext("2d");
const realtimeChartTitle = document.querySelector("#realtimeChartTitle");
const realtimeChartStatus = document.querySelector("#realtimeChartStatus");
const chartRangeSelect = document.querySelector("#chartRangeSelect");
const realtimeDataTableBody = document.querySelector("#realtimeDataTableBody");
const historyFromDate = document.querySelector("#historyFromDate");
const historyToDate = document.querySelector("#historyToDate");
const applyHistoryRangeButton = document.querySelector("#applyHistoryRangeButton");
const showAllHistoryButton = document.querySelector("#showAllHistoryButton");
const exportCsvButton = document.querySelector("#exportCsvButton");
const historyStatus = document.querySelector("#historyStatus");
const historyChart = document.querySelector("#historyChart");
const historyContext = historyChart.getContext("2d");
const realtimeTooltip = document.querySelector("#realtimeTooltip");
const historyTooltip = document.querySelector("#historyTooltip");
const temperatureHistoryMin = document.querySelector("#temperatureHistoryMin");
const temperatureHistoryMax = document.querySelector("#temperatureHistoryMax");
const temperatureHistoryAverage = document.querySelector("#temperatureHistoryAverage");
const humidityHistoryMin = document.querySelector("#humidityHistoryMin");
const humidityHistoryMax = document.querySelector("#humidityHistoryMax");
const humidityHistoryAverage = document.querySelector("#humidityHistoryAverage");
const thresholdForm = document.querySelector("#thresholdForm");
const temperatureMinInput = document.querySelector("#temperatureMinInput");
const temperatureMaxInput = document.querySelector("#temperatureMaxInput");
const humidityMinInput = document.querySelector("#humidityMinInput");
const humidityMaxInput = document.querySelector("#humidityMaxInput");
const thresholdMessage = document.querySelector("#thresholdMessage");
const resetThresholdsButton = document.querySelector("#resetThresholdsButton");
const emailNotificationForm = document.querySelector("#emailNotificationForm");
const notificationEmailInput = document.querySelector("#notificationEmailInput");
const emailNotificationEnabledInput = document.querySelector("#emailNotificationEnabledInput");
const emailNotificationMessage = document.querySelector("#emailNotificationMessage");
const cameraPreview = document.querySelector("#cameraPreview");
const cameraCanvas = document.querySelector("#cameraCanvas");
const cameraPlaceholder = document.querySelector("#cameraPlaceholder");
const cameraStatus = document.querySelector("#cameraStatus");
const startCameraButton = document.querySelector("#startCameraButton");
const stopCameraButton = document.querySelector("#stopCameraButton");
const captureButton = document.querySelector("#captureButton");
const imageGallery = document.querySelector("#imageGallery");
const galleryEmptyState = document.querySelector("#galleryEmptyState");

const expectedReadingIntervalMs = 2000;
const connectionCheckIntervalMs = 1000;
const deviceStaleAfterMs = 15000;
const thresholdStorageKey = "greenhouse-alert-thresholds";
const emailNotificationStorageKey = "greenhouse-email-notifications";
const loginHistoryStorageKey = "greenhouse-login-history";
const emailLastSentStorageKey = "greenhouse-email-last-sent";
const emailNotificationCooldown = 15 * 60 * 1000;
const defaultThresholds = Object.freeze({
  temperatureMin: 24,
  temperatureMax: 32,
  humidityMin: 55,
  humidityMax: 82,
});
const readings = [];
let historyReadings = [];
let activeHistoryRange = null;
let alertThresholds = loadThresholds();
let emailNotificationSettings = loadEmailNotificationSettings();
const lastEmailSentAt = loadEmailLastSentAt();

let auth = null;
let db = null;
let authApi = null;
let firestoreApi = null;
let unsubscribeReadings = null;
let unsubscribeHistory = null;
let unsubscribeSettings = null;
let unsubscribeWebcamImages = null;
let latestReading = null;
let latestReadingReceivedAt = 0;
let connectionMonitorIntervalId = null;
let resizeFrameId = null;
let chartRangeSeconds = Number(chartRangeSelect.value);
let deviceIsOffline = false;
let cameraIsActive = false;
let computerCameraStreamUrl = "";
let cameraRefreshTimeoutId = null;

function setCameraStatus(message, state = "") {
  cameraStatus.textContent = message;
  cameraStatus.classList.toggle("is-live", state === "live");
  cameraStatus.classList.toggle("is-error", state === "error");
}

async function startCamera() {
  if (!computerCameraStreamUrl) {
    setCameraStatus("Chưa có địa chỉ webcam máy tính", "error");
    return;
  }
  startCameraButton.disabled = true;
  setCameraStatus("Đang kết nối webcam máy tính...");
  cameraPreview.onload = () => {
    cameraIsActive = true;
    cameraPreview.classList.add("is-active");
    cameraPlaceholder.hidden = true;
    captureButton.disabled = false;
    stopCameraButton.disabled = false;
    setCameraStatus("Đang xem webcam máy tính", "live");
    clearTimeout(cameraRefreshTimeoutId);
  };
  cameraPreview.onerror = () => {
    cameraIsActive = false;
    cameraPreview.classList.remove("is-active");
    cameraPlaceholder.hidden = false;
    startCameraButton.disabled = false;
    captureButton.disabled = true;
    stopCameraButton.disabled = true;
    setCameraStatus("Không kết nối được chương trình webcam trên máy tính", "error");
    clearTimeout(cameraRefreshTimeoutId);
    cameraRefreshTimeoutId = setTimeout(loadComputerCameraFrame, 1200);
  };
  function loadComputerCameraFrame() {
    const separator = computerCameraStreamUrl.includes("?") ? "&" : "?";
    cameraPreview.src = `${computerCameraStreamUrl}${separator}t=${Date.now()}`;
  }
  clearTimeout(cameraRefreshTimeoutId);
  loadComputerCameraFrame();
}

function stopCamera() {
  clearTimeout(cameraRefreshTimeoutId);
  cameraRefreshTimeoutId = null;
  cameraIsActive = false;
  cameraPreview.removeAttribute("src");
  cameraPreview.classList.remove("is-active");
  cameraPlaceholder.hidden = false;
  startCameraButton.disabled = false;
  captureButton.disabled = true;
  stopCameraButton.disabled = true;
  setCameraStatus("Camera đã tắt");
}

function stopWebcamImageFirestore() {
  if (!unsubscribeWebcamImages) return;
  unsubscribeWebcamImages();
  unsubscribeWebcamImages = null;
}

function listenToWebcamImages() {
  stopWebcamImageFirestore();
  const imagesQuery = firestoreApi.query(
    firestoreApi.collection(db, "webcam_images"),
    firestoreApi.orderBy("capturedAt", "desc"),
    firestoreApi.limit(30),
  );
  unsubscribeWebcamImages = firestoreApi.onSnapshot(
    imagesQuery,
    (snapshot) => {
      imageGallery.querySelectorAll(".gallery-item").forEach((item) => item.remove());
      snapshot.docs.forEach((imageDocument) => {
        const image = imageDocument.data();
        if (typeof image.imageDataUrl === "string" && image.imageDataUrl) {
          addGalleryImage(
            image.imageDataUrl,
            image.label || "Ảnh webcam",
            imageDocument.id,
          );
        }
      });
      galleryEmptyState.hidden = snapshot.docs.length > 0;
    },
    (error) => {
      console.error("Không tải được thư viện ảnh webcam:", error);
      setCameraStatus("Không tải được thư viện ảnh từ Firestore", "error");
    },
  );
}

function addGalleryImage(source, label, documentId = "") {
  galleryEmptyState.hidden = true;
  const figure = document.createElement("figure");
  const image = document.createElement("img");
  const removeButton = document.createElement("button");
  figure.className = "gallery-item";
  image.src = source;
  image.alt = label;
  removeButton.type = "button";
  removeButton.textContent = "×";
  removeButton.setAttribute("aria-label", "Xóa " + label);
  removeButton.addEventListener("click", async () => {
    try {
      if (documentId) {
        await firestoreApi.deleteDoc(
          firestoreApi.doc(db, "webcam_images", documentId),
        );
      } else {
        figure.remove();
      }
    } catch (error) {
      console.error(error);
      setCameraStatus("Không xóa được ảnh trên Firestore", "error");
    }
  });
  figure.append(image, removeButton);
  imageGallery.append(figure);
}

async function captureCameraImage() {
  if (!cameraIsActive || !computerCameraStreamUrl || !auth?.currentUser) return;

  captureButton.disabled = true;
  setCameraStatus("Đang lưu khung hình lên Firestore...");
  try {
    const snapshotUrl = computerCameraStreamUrl.replace(
      /\/stream(?:\.mjpg)?(?:\?.*)?$/,
      "/snapshot.jpg",
    );
    const separator = snapshotUrl.includes("?") ? "&" : "?";
    const response = await fetch(snapshotUrl + separator + "t=" + Date.now(), {
      cache: "no-store",
      mode: "cors",
    });
    if (!response.ok) throw new Error("HTTP " + response.status);

    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    if (dataUrl.length > 900000) {
      throw new Error("Ảnh vượt giới hạn an toàn của một tài liệu Firestore");
    }

    const capturedAt = new Date();
    const label = "Webcam máy tính lúc " + capturedAt.toLocaleString("vi-VN");
    await firestoreApi.addDoc(
      firestoreApi.collection(db, "webcam_images"),
      {
        imageDataUrl: dataUrl,
        imageMimeType: blob.type || "image/jpeg",
        label,
        capturedAt: firestoreApi.serverTimestamp(),
        capturedBy: auth.currentUser.email || "",
      },
    );
    setCameraStatus(
      "Đã lưu ảnh lên Firestore lúc " + capturedAt.toLocaleTimeString("vi-VN"),
      "live",
    );
  } catch (error) {
    console.error(error);
    setCameraStatus("Không lưu được ảnh lên Firestore. Hãy thử lại.", "error");
  } finally {
    captureButton.disabled = !cameraIsActive;
  }
}

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
  if (cameraIsActive) stopCamera();
  stopReadingFirestore();
  stopHistoryFirestore();
  stopSettingsFirestore();
  stopConnectionMonitor();
}

function showDashboardView() {
  authView.hidden = true;
  dashboardView.hidden = false;
  requestAnimationFrame(resizeCanvas);
  listenToWebcamImages();
}

function setConnectionState(state, message) {
  connectionText.textContent = message;
  connectionStatus.classList.toggle("is-connecting", state === "connecting");
  connectionStatus.classList.toggle("is-offline", state === "offline");
  connectionStatus.classList.toggle("is-error", state === "error");
}

function hidePassword() {
  passwordInput.type = "password";
  passwordToggle.classList.remove("is-visible");
  passwordToggle.setAttribute("aria-label", "Hiện mật khẩu");
  passwordToggle.setAttribute("aria-pressed", "false");
}

function togglePasswordVisibility() {
  const isPasswordHidden = passwordInput.type === "password";

  passwordInput.type = isPasswordHidden ? "text" : "password";
  passwordToggle.classList.toggle("is-visible", isPasswordHidden);
  passwordToggle.setAttribute("aria-label", isPasswordHidden ? "Ẩn mật khẩu" : "Hiện mật khẩu");
  passwordToggle.setAttribute("aria-pressed", String(isPasswordHidden));
  passwordInput.focus();
}

window.togglePasswordVisibility = togglePasswordVisibility;

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
      updateRealtimeDataPresentation("Đang chờ dữ liệu từ thiết bị...");
      eventLog.replaceChildren();
      renderLoginHistory();
      setConnectionState("connecting", "Đang kết nối Firestore");
      addEvent(`Đã đăng nhập: ${user.email}`);
      if (!emailNotificationSettings.email) {
        emailNotificationSettings.email = user.email || "";
        fillEmailNotificationForm();
      }
      listenToReadings();
      listenToSettings();
      loadAllHistory();
    });
  } catch (error) {
    console.error(error);
    showAuthView(`Không thể tải Firebase. Kiểm tra kết nối mạng hoặc chặn CDN. ${getFirebaseErrorText(error)}`);
  }
}

function listenToReadings() {
  stopReadingFirestore();
  stopConnectionMonitor();

  const readingRef = firestoreApi.doc(db, firestorePath.collection, firestorePath.document);

  unsubscribeReadings = firestoreApi.onSnapshot(
    readingRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        stopConnectionMonitor();
        setConnectionState("offline", "Thiết bị chưa có dữ liệu");
        readings.splice(0, readings.length);
        updateRealtimeDataPresentation("Chưa có dữ liệu để hiển thị.");
        drawChart();
        addEvent(`Chưa có collection "${firestorePath.collection}" với document "${firestorePath.document}"`, "warning");
        return;
      }

      const latest = normalizeReading(snapshot.data());
      if (!latest) {
        stopConnectionMonitor();
        setConnectionState("error", "Dữ liệu thiết bị không hợp lệ");
        readings.splice(0, readings.length);
        updateRealtimeDataPresentation("Dữ liệu nhận được không hợp lệ.");
        drawChart();
        addEvent("Dữ liệu Firestore thiếu temperature hoặc humidity", "warning");
        return;
      }

      latestReading = latest;
      latestReadingReceivedAt = latest.time.getTime();
      pushReading(latest);
      startConnectionMonitor();
      checkDeviceConnection();
      addEvent(`Đã kết nối document "${firestorePath.document}"`);
    },
    (error) => {
      console.error(error);
      stopConnectionMonitor();
      setConnectionState("error", "Lỗi đọc Firestore");
      readings.splice(0, readings.length);
      updateRealtimeDataPresentation("Không thể tải dữ liệu biểu đồ.");
      drawChart();
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
    time: data.recordedAt?.toDate
      ? data.recordedAt.toDate()
      : data.updatedAt?.toDate
        ? data.updatedAt.toDate()
        : new Date(),
    temperature: Number(temperature.toFixed(1)),
    humidity: Math.round(humidity),
  };
}

function formatHistoryDate(date) {
  return date.toLocaleDateString("vi-VN");
}

function historyDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadAllHistory() {
  loadHistoryRange(null);
}

function loadHistoryRange(range) {
  if (!db || !firestoreApi) return;
  stopHistoryFirestore();
  historyReadings = [];
  activeHistoryRange = range;
  updateHistoryStatistics();
  updateExportButtonState();
  historyStatus.textContent = range
    ? `Đang tải dữ liệu từ ${formatHistoryDate(range.start)} đến ${formatHistoryDate(range.end)}...`
    : "Đang kết nối toàn bộ dữ liệu lịch sử...";

  const historyRef = firestoreApi.collection(db, firestorePath.historyCollection);
  const constraints = [];
  if (range) {
    const endExclusive = new Date(range.end);
    endExclusive.setDate(endExclusive.getDate() + 1);
    constraints.push(
      firestoreApi.where("recordedAt", ">=", firestoreApi.Timestamp.fromDate(range.start)),
      firestoreApi.where("recordedAt", "<", firestoreApi.Timestamp.fromDate(endExclusive)),
    );
  }
  constraints.push(firestoreApi.orderBy("recordedAt", "asc"));
  const historyQuery = firestoreApi.query(historyRef, ...constraints);

  unsubscribeHistory = firestoreApi.onSnapshot(
    historyQuery,
    (snapshot) => {
      historyReadings = snapshot.docs.map((document) => normalizeReading(document.data())).filter(Boolean);
      const rangeLabel = activeHistoryRange
        ? `từ ${formatHistoryDate(activeHistoryRange.start)} đến ${formatHistoryDate(activeHistoryRange.end)}`
        : "trong toàn bộ lịch sử";
      historyStatus.textContent = historyReadings.length
        ? `${historyReadings.length} mẫu ${rangeLabel} - đang cập nhật`
        : `Chưa có dữ liệu ${rangeLabel} - đang theo dõi`;
      updateHistoryStatistics();
      updateExportButtonState();
      resizeHistoryCanvas();
    },
    (error) => {
      console.error(error);
      historyReadings = [];
      historyStatus.textContent = `Không theo dõi được lịch sử: ${getFirebaseErrorText(error)}`;
      updateHistoryStatistics();
      updateExportButtonState();
      resizeHistoryCanvas();
    },
  );
}

function applySelectedHistoryRange() {
  if (!historyFromDate.value || !historyToDate.value) {
    historyStatus.textContent = "Hãy chọn đầy đủ ngày bắt đầu và ngày kết thúc.";
    return;
  }
  const start = new Date(`${historyFromDate.value}T00:00:00`);
  const end = new Date(`${historyToDate.value}T00:00:00`);
  if (start > end) {
    historyStatus.textContent = "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.";
    return;
  }
  loadHistoryRange({ start, end });
}

function showAllHistory() {
  historyFromDate.value = "";
  historyToDate.value = "";
  loadAllHistory();
}
function updateHistoryStatistics() {
  const fields = [
    {
      key: "temperature",
      minElement: temperatureHistoryMin,
      maxElement: temperatureHistoryMax,
      averageElement: temperatureHistoryAverage,
      format: (value) => `${value.toFixed(1)}°C`,
    },
    {
      key: "humidity",
      minElement: humidityHistoryMin,
      maxElement: humidityHistoryMax,
      averageElement: humidityHistoryAverage,
      format: (value) => `${value.toFixed(1)}%`,
    },
  ];

  fields.forEach(({ key, minElement, maxElement, averageElement, format }) => {
    if (!historyReadings.length) {
      minElement.textContent = "--";
      maxElement.textContent = "--";
      averageElement.textContent = "--";
      return;
    }

    const values = historyReadings.map((reading) => reading[key]);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    minElement.textContent = format(Math.min(...values));
    maxElement.textContent = format(Math.max(...values));
    averageElement.textContent = format(average);
  });
}

function updateExportButtonState() {
  exportCsvButton.disabled = historyReadings.length === 0;
}

function escapeSpreadsheetValue(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function encodeUtf16Le(text) {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes[2 + index * 2] = code & 0xff;
    bytes[3 + index * 2] = code >> 8;
  }

  return bytes;
}

function formatSpreadsheetText(value) {
  return `="${String(value).replaceAll('"', '""')}"`;
}

function calculateFieldStatistics(field) {
  const values = historyReadings.map((reading) => reading[field]);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

function exportHistoryCsv() {
  if (!historyReadings.length) return;

  const temperatureStats = calculateFieldStatistics("temperature");
  const humidityStats = calculateFieldStatistics("humidity");
  const rows = [
    ["BÁO CÁO DỮ LIỆU NHÀ KÍNH"],
    [activeHistoryRange
      ? `Phạm vi báo cáo: ${formatHistoryDate(activeHistoryRange.start)} - ${formatHistoryDate(activeHistoryRange.end)}`
      : "Phạm vi báo cáo: Toàn bộ thời gian"],
    ["Số mẫu", historyReadings.length],
    [],
    ["Chỉ số", "Nhỏ nhất", "Lớn nhất", "Trung bình"],
    ["Nhiệt độ (°C)", temperatureStats.min.toFixed(1), temperatureStats.max.toFixed(1), temperatureStats.average.toFixed(1)],
    ["Độ ẩm (%)", humidityStats.min.toFixed(1), humidityStats.max.toFixed(1), humidityStats.average.toFixed(1)],
    [],
    ["Thời gian", "Nhiệt độ (°C)", "Độ ẩm (%)"],
    ...historyReadings.map((reading) => [
      formatSpreadsheetText(reading.time.toLocaleString("vi-VN")),
      reading.temperature.toFixed(1),
      reading.humidity,
    ]),
  ];
  const spreadsheetContent = rows
    .map((row) => row.map(escapeSpreadsheetValue).join("\t"))
    .join("\r\n");
  const blob = new Blob([encodeUtf16Le(spreadsheetContent)], { type: "text/tab-separated-values;charset=utf-16le" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  const rangeSuffix = activeHistoryRange
    ? `${historyDateValue(activeHistoryRange.start)}_${historyDateValue(activeHistoryRange.end)}`
    : "toan-thoi-gian";
  downloadLink.download = `bao-cao-nha-kinh-${rangeSuffix}.csv`;
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(url);
}

function checkDeviceConnection() {
  if (!latestReading || !latestReadingReceivedAt) return;

  const dataAge = Math.max(0, Date.now() - latestReadingReceivedAt);
  if (dataAge >= deviceStaleAfterMs) {
    if (!deviceIsOffline) {
      deviceIsOffline = true;
      const lastUpdateTime = latestReading.time.toLocaleTimeString("vi-VN");
      setConnectionState("offline", "Thiết bị ngoại tuyến");
      updateRealtimeDataPresentation(`Mất kết nối thiết bị. Mẫu cuối được nhận lúc ${lastUpdateTime}.`);
      addEvent("Thiết bị đã ngừng gửi dữ liệu", "danger");
    }
    return;
  }

  const wasOffline = deviceIsOffline;
  deviceIsOffline = false;
  setConnectionState("online", `Cập nhật ${latestReading.time.toLocaleTimeString("vi-VN")}`);
  updateRealtimeDataPresentation();
  if (wasOffline) addEvent("Thiết bị đã kết nối và gửi dữ liệu trở lại");
}

function startConnectionMonitor() {
  if (connectionMonitorIntervalId) return;
  connectionMonitorIntervalId = setInterval(checkDeviceConnection, connectionCheckIntervalMs);
}

function stopConnectionMonitor() {
  clearInterval(connectionMonitorIntervalId);
  connectionMonitorIntervalId = null;
  latestReading = null;
  latestReadingReceivedAt = 0;
  deviceIsOffline = false;
}

function stopReadingFirestore() {
  if (!unsubscribeReadings) return;
  unsubscribeReadings();
  unsubscribeReadings = null;
}

function stopHistoryFirestore() {
  if (!unsubscribeHistory) return;
  unsubscribeHistory();
  unsubscribeHistory = null;
}

function getSharedSettingsData() {
  return {
    ...alertThresholds,
    email: emailNotificationSettings.email,
    emailEnabled: emailNotificationSettings.enabled,
    cameraStreamUrl: computerCameraStreamUrl,
  };
}

async function saveSharedSettings() {
  if (!db || !firestoreApi) throw new Error("Firebase chưa sẵn sàng.");
  const settingsRef = firestoreApi.doc(
    db,
    firestorePath.settingsCollection,
    firestorePath.settingsDocument,
  );
  await firestoreApi.setDoc(
    settingsRef,
    {
      ...getSharedSettingsData(),
      updatedAt: firestoreApi.serverTimestamp(),
    },
    { merge: true },
  );
}

function applySharedSettings(data) {
  const nextThresholds = {
    temperatureMin: Number(data.temperatureMin),
    temperatureMax: Number(data.temperatureMax),
    humidityMin: Number(data.humidityMin),
    humidityMax: Number(data.humidityMax),
  };
  if (areValidThresholds(nextThresholds)) {
    alertThresholds = nextThresholds;
    fillThresholdForm();
    localStorage.setItem(thresholdStorageKey, JSON.stringify(nextThresholds));
  }

  emailNotificationSettings = {
    email: typeof data.email === "string" ? data.email : emailNotificationSettings.email,
    enabled: data.emailEnabled === true,
  };
  fillEmailNotificationForm();
  localStorage.setItem(emailNotificationStorageKey, JSON.stringify(emailNotificationSettings));
  if (typeof data.cameraStreamUrl === "string" && data.cameraStreamUrl.trim()) {
    const nextStreamUrl = data.cameraStreamUrl.trim();
    const streamChanged = nextStreamUrl !== computerCameraStreamUrl;
    computerCameraStreamUrl = nextStreamUrl;
    if (data.cameraOnline === true && (!cameraIsActive || streamChanged)) {
      void startCamera();
    } else if (data.cameraOnline === false) {
      if (cameraIsActive) stopCamera();
      setCameraStatus("Chương trình webcam trên máy tính đang tắt");
    }
  }
  if (latestReading) updateDashboard(latestReading);
}

function listenToSettings() {
  stopSettingsFirestore();
  const settingsRef = firestoreApi.doc(
    db,
    firestorePath.settingsCollection,
    firestorePath.settingsDocument,
  );
  unsubscribeSettings = firestoreApi.onSnapshot(
    settingsRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        void saveSharedSettings().catch((error) => {
          addEvent(`Không thể khởi tạo cấu hình chung: ${getFirebaseErrorText(error)}`, "danger");
        });
        return;
      }
      applySharedSettings(snapshot.data());
    },
    (error) => {
      addEvent(`Không thể đồng bộ cấu hình: ${getFirebaseErrorText(error)}`, "danger");
    },
  );
}

function stopSettingsFirestore() {
  if (!unsubscribeSettings) return;
  unsubscribeSettings();
  unsubscribeSettings = null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function areValidThresholds(value) {
  return value
    && Number.isFinite(value.temperatureMin)
    && Number.isFinite(value.temperatureMax)
    && Number.isFinite(value.humidityMin)
    && Number.isFinite(value.humidityMax)
    && value.temperatureMin < value.temperatureMax
    && value.temperatureMin >= -20
    && value.temperatureMax <= 80
    && value.humidityMin < value.humidityMax
    && value.humidityMin >= 0
    && value.humidityMax <= 100;
}

function loadThresholds() {
  try {
    const saved = JSON.parse(localStorage.getItem(thresholdStorageKey));
    return areValidThresholds(saved) ? saved : { ...defaultThresholds };
  } catch {
    return { ...defaultThresholds };
  }
}

function fillThresholdForm() {
  temperatureMinInput.value = alertThresholds.temperatureMin;
  temperatureMaxInput.value = alertThresholds.temperatureMax;
  humidityMinInput.value = alertThresholds.humidityMin;
  humidityMaxInput.value = alertThresholds.humidityMax;
}

function loadEmailNotificationSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(emailNotificationStorageKey));
    return {
      enabled: saved?.enabled === true,
      email: typeof saved?.email === "string" ? saved.email : "",
    };
  } catch {
    return { enabled: false, email: "" };
  }
}

function fillEmailNotificationForm() {
  notificationEmailInput.value = emailNotificationSettings.email;
  emailNotificationEnabledInput.checked = emailNotificationSettings.enabled;
}

function loadEmailLastSentAt() {
  try {
    const saved = JSON.parse(localStorage.getItem(emailLastSentStorageKey));
    const entries = Object.entries(saved || {}).filter(([, value]) => Number.isFinite(value));
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function rememberEmailSentAt(alertKey, sentAt) {
  lastEmailSentAt.set(alertKey, sentAt);
  try {
    localStorage.setItem(emailLastSentStorageKey, JSON.stringify(Object.fromEntries(lastEmailSentAt)));
  } catch {
    // The in-memory cooldown still applies for the current session.
  }
}

async function queueAlertEmail(alertKey, message, reading) {
  if (!emailNotificationSettings.enabled || !emailNotificationSettings.email) return;

  const now = Date.now();
  const previousSentAt = lastEmailSentAt.get(alertKey) || 0;
  if (now - previousSentAt < emailNotificationCooldown) return;
  rememberEmailSentAt(alertKey, now);

  try {
    const response = await fetch(emailJsConfig.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: emailJsConfig.serviceId,
        template_id: emailJsConfig.templateId,
        user_id: emailJsConfig.publicKey,
        template_params: {
          to_email: emailNotificationSettings.email,
          alert_message: message,
          temperature: reading.temperature,
          humidity: reading.humidity,
          recorded_at: reading.time.toLocaleString("vi-VN"),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `EmailJS HTTP ${response.status}`);
    }

    addEvent(`Đã gửi email cảnh báo tới ${emailNotificationSettings.email}`);
  } catch (error) {
    console.error(error);
    addEvent(`Không thể gửi email qua EmailJS: ${error?.message || "Lỗi không xác định"}`, "danger");
  }
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

function getConfiguredTemperatureStatus(value) {
  if (value < alertThresholds.temperatureMin) return ["Nhiệt độ thấp hơn ngưỡng cảnh báo", "warning"];
  if (value > alertThresholds.temperatureMax) return ["Nhiệt độ cao hơn ngưỡng cảnh báo", "danger"];
  return ["Trong ngưỡng đã cấu hình", "normal"];
}

function getConfiguredHumidityStatus(value) {
  if (value < alertThresholds.humidityMin) return ["Độ ẩm thấp hơn ngưỡng cảnh báo", "warning"];
  if (value > alertThresholds.humidityMax) return ["Độ ẩm cao hơn ngưỡng cảnh báo", "danger"];
  return ["Trong ngưỡng đã cấu hình", "normal"];
}

function updateDashboard(reading) {
  const [tempMessage, tempLevel] = getConfiguredTemperatureStatus(reading.temperature);
  const [humidityMessage, humidityLevel] = getConfiguredHumidityStatus(reading.humidity);

  temperatureValue.textContent = `${reading.temperature}°C`;
  humidityValue.textContent = `${reading.humidity}%`;
  temperatureBar.style.width = `${clamp((reading.temperature / 40) * 100, 0, 100)}%`;
  humidityBar.style.width = `${clamp(reading.humidity, 0, 100)}%`;
  temperatureStatus.textContent = tempMessage;
  humidityStatus.textContent = humidityMessage;
  setConnectionState("online", `Cập nhật ${reading.time.toLocaleTimeString("vi-VN")}`);

  if (tempLevel !== "normal") addEvent(tempMessage, tempLevel);
  if (humidityLevel !== "normal") addEvent(humidityMessage, humidityLevel);
  if (tempLevel !== "normal") void queueAlertEmail(`temperature-${tempLevel}`, tempMessage, reading);
  if (humidityLevel !== "normal") void queueAlertEmail(`humidity-${humidityLevel}`, humidityMessage, reading);
}

function addEvent(message, level = "normal") {
  const last = eventLog.firstElementChild;
  if (last && last.dataset.message === message) return;

  const item = document.createElement("li");
  const time = document.createElement("strong");
  item.className = level === "normal" ? "" : level;
  item.dataset.message = message;
  time.textContent = new Date().toLocaleTimeString("vi-VN");
  item.append(time, document.createTextNode(message));
  eventLog.prepend(item);

  while (eventLog.children.length > 6) {
    eventLog.lastElementChild.remove();
  }
}

function getRealtimeMaxPoints() {
  return Math.floor((chartRangeSeconds * 1000) / expectedReadingIntervalMs) + 1;
}

function trimRealtimeReadings() {
  const maxPoints = getRealtimeMaxPoints();
  while (readings.length > maxPoints) readings.shift();
}

function renderRealtimeDataTable() {
  realtimeDataTableBody.replaceChildren();

  if (!readings.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "Chưa có dữ liệu";
    row.append(cell);
    realtimeDataTableBody.append(row);
    return;
  }

  [...readings].reverse().forEach((reading) => {
    const row = document.createElement("tr");
    const timeCell = document.createElement("td");
    const temperatureCell = document.createElement("td");
    const humidityCell = document.createElement("td");
    timeCell.textContent = reading.time.toLocaleTimeString("vi-VN");
    temperatureCell.textContent = `${reading.temperature.toFixed(1)}°C`;
    humidityCell.textContent = `${reading.humidity}%`;
    row.append(timeCell, temperatureCell, humidityCell);
    realtimeDataTableBody.append(row);
  });
}

function updateRealtimeDataPresentation(message = "") {
  renderRealtimeDataTable();

  if (message) {
    realtimeChartStatus.textContent = message;
    realtimeChartStatus.hidden = false;
  } else if (readings.length === 0) {
    realtimeChartStatus.textContent = "Đang chờ dữ liệu từ thiết bị...";
    realtimeChartStatus.hidden = false;
  } else if (readings.length === 1) {
    realtimeChartStatus.textContent = "Đã nhận 1 mẫu, cần thêm dữ liệu để vẽ đường biểu đồ.";
    realtimeChartStatus.hidden = false;
  } else {
    realtimeChartStatus.hidden = true;
  }

  chart.setAttribute(
    "aria-label",
    readings.length
      ? `Biểu đồ gồm ${readings.length} mẫu trong ${chartRangeSeconds} giây gần nhất`
      : "Biểu đồ chưa có dữ liệu",
  );
}

function updateRealtimeChartRange() {
  chartRangeSeconds = Number(chartRangeSelect.value);
  realtimeChartTitle.textContent = `Dữ liệu ${chartRangeSeconds} giây gần nhất`;
  trimRealtimeReadings();
  updateRealtimeDataPresentation();
  drawChart();
}

function loadLoginHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(loginHistoryStorageKey));
    return Array.isArray(saved)
      ? saved.filter((entry) => typeof entry?.email === "string" && Number.isFinite(entry?.timestamp)).slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

function renderLoginHistory() {
  const history = loadLoginHistory();
  loginHistoryLog.replaceChildren();

  if (!history.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-log-item";
    emptyItem.textContent = "Chưa có lần đăng nhập nào được lưu trên thiết bị này.";
    loginHistoryLog.append(emptyItem);
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement("li");
    const time = document.createElement("strong");
    const email = document.createElement("span");
    time.textContent = new Date(entry.timestamp).toLocaleString("vi-VN");
    email.textContent = entry.email;
    item.append(time, email);
    loginHistoryLog.append(item);
  });
}

function rememberSuccessfulLogin(email) {
  const history = loadLoginHistory();
  history.unshift({ email, timestamp: Date.now() });

  try {
    localStorage.setItem(loginHistoryStorageKey, JSON.stringify(history.slice(0, 10)));
  } catch {
    // The login still succeeds when the browser blocks local storage.
  }

  renderLoginHistory();
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
  const rangeLabel = `${chartRangeSeconds} giây trước`;
  context.fillText(rangeLabel, padding.left, height - 8);
  const currentLabel = "Hiện tại";
  const currentLabelWidth = context.measureText(currentLabel).width;
  context.fillText(currentLabel, width - padding.right - currentLabelWidth, height - 8);
}

function drawLine({ color, points, min, max, padding, plotWidth, plotHeight }) {
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.beginPath();

  const maxPoints = getRealtimeMaxPoints();
  points.forEach((value, index) => {
    const x = padding.left + (plotWidth / Math.max(maxPoints - 1, 1)) * index;
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

function resizeHistoryCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = historyChart.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  historyChart.width = Math.floor(rect.width * ratio);
  historyChart.height = Math.floor(rect.height * ratio);
  historyContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawHistoryChart();
}

function drawHistoryChart() {
  const rect = historyChart.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const padding = { top: 20, right: 18, bottom: 36, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  historyContext.clearRect(0, 0, width, height);
  historyContext.strokeStyle = "#e2e9e3";
  historyContext.fillStyle = "#66736d";
  historyContext.font = "12px Inter, system-ui, sans-serif";
  historyContext.lineWidth = 1;

  for (let index = 0; index <= 4; index += 1) {
    const y = padding.top + (plotHeight / 4) * index;
    historyContext.beginPath();
    historyContext.moveTo(padding.left, y);
    historyContext.lineTo(width - padding.right, y);
    historyContext.stroke();
  }

  historyContext.fillText("40°C / 100%", 4, padding.top + 4);
  historyContext.fillText("18°C / 30%", 6, height - padding.bottom);
  if (!historyReadings.length) return;

  const firstTime = historyReadings[0].time.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const lastTime = historyReadings.at(-1).time.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  historyContext.fillText(firstTime, padding.left, height - 8);
  const lastTimeWidth = historyContext.measureText(lastTime).width;
  historyContext.fillText(lastTime, width - padding.right - lastTimeWidth, height - 8);

  drawHistoryLine("#d95f48", "temperature", 18, 40, padding, plotWidth, plotHeight);
  drawHistoryLine("#2d7fb8", "humidity", 30, 100, padding, plotWidth, plotHeight);
}

function drawHistoryLine(color, field, min, max, padding, plotWidth, plotHeight) {
  historyContext.strokeStyle = color;
  historyContext.fillStyle = color;
  historyContext.lineWidth = 2;
  historyContext.lineJoin = "round";
  historyContext.lineCap = "round";

  if (historyReadings.length === 1) {
    const normalized = (historyReadings[0][field] - min) / (max - min);
    const x = padding.left + plotWidth / 2;
    const y = padding.top + plotHeight - clamp(normalized, 0, 1) * plotHeight;

    historyContext.beginPath();
    historyContext.arc(x, y, 5, 0, Math.PI * 2);
    historyContext.fill();
    return;
  }

  historyContext.beginPath();

  const denominator = Math.max(historyReadings.length - 1, 1);
  historyReadings.forEach((reading, index) => {
    const x = padding.left + (plotWidth / denominator) * index;
    const normalized = (reading[field] - min) / (max - min);
    const y = padding.top + plotHeight - clamp(normalized, 0, 1) * plotHeight;

    if (index === 0) historyContext.moveTo(x, y);
    else historyContext.lineTo(x, y);
  });

  historyContext.stroke();
}

function showReadingTooltip(event, isHistory) {
  const targetChart = isHistory ? historyChart : chart;
  const tooltip = isHistory ? historyTooltip : realtimeTooltip;
  const source = isHistory ? historyReadings : readings;
  const rect = targetChart.getBoundingClientRect();

  if (!source.length || !rect.width || !rect.height) {
    tooltip.classList.remove("is-visible");
    return;
  }

  const padding = isHistory
    ? { top: 20, right: 18, bottom: 36, left: 42 }
    : { top: 20, right: 18, bottom: 32, left: 42 };
  const plotWidth = rect.width - padding.left - padding.right;
  const plotHeight = rect.height - padding.top - padding.bottom;
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const denominator = isHistory
    ? Math.max(source.length - 1, 1)
    : Math.max(getRealtimeMaxPoints() - 1, 1);
  const step = plotWidth / denominator;

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  source.forEach((reading, index) => {
    const pointX = isHistory && source.length === 1
      ? padding.left + plotWidth / 2
      : padding.left + step * index;
    const distance = Math.abs(pointerX - pointX);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  if (nearestDistance > Math.max(14, step / 2 + 4)) {
    tooltip.classList.remove("is-visible");
    return;
  }

  const reading = source[nearestIndex];
  const position = isHistory && source.length === 1
    ? 0
    : clamp((pointerX - padding.left) / step, 0, source.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(source.length - 1, Math.ceil(position));
  const progress = position - lowerIndex;
  const hoverTemperature = source[lowerIndex].temperature
    + (source[upperIndex].temperature - source[lowerIndex].temperature) * progress;
  const hoverHumidity = source[lowerIndex].humidity
    + (source[upperIndex].humidity - source[lowerIndex].humidity) * progress;
  const temperatureY = padding.top + plotHeight
    - clamp((hoverTemperature - 18) / (40 - 18), 0, 1) * plotHeight;
  const humidityY = padding.top + plotHeight
    - clamp((hoverHumidity - 30) / (100 - 30), 0, 1) * plotHeight;
  const isTemperature = Math.abs(pointerY - temperatureY) <= Math.abs(pointerY - humidityY);
  const pointY = isTemperature ? temperatureY : humidityY;

  if (Math.abs(pointerY - pointY) > 30) {
    tooltip.classList.remove("is-visible");
    return;
  }

  const label = isTemperature ? "Nhiệt độ" : "Độ ẩm";
  const value = isTemperature ? `${reading.temperature.toFixed(1)}°C` : `${reading.humidity}%`;
  const time = reading.time.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: isHistory ? undefined : "2-digit",
  });
  const cardRect = targetChart.closest(".chart-card, .history-card").getBoundingClientRect();
  const tooltipX = Math.min(cardRect.width - 80, Math.max(80, event.clientX - cardRect.left));
  const tooltipY = event.clientY - cardRect.top;

  tooltip.className = `chart-tooltip is-visible ${isTemperature ? "temperature-tooltip" : "humidity-tooltip"}`;
  tooltip.replaceChildren();
  const valueElement = document.createElement("strong");
  const timeElement = document.createElement("span");
  valueElement.textContent = `${label}: ${value}`;
  timeElement.textContent = time;
  tooltip.append(valueElement, timeElement);
  tooltip.style.left = `${tooltipX}px`;
  tooltip.style.top = `${tooltipY}px`;
}

function hideReadingTooltip(tooltip) {
  tooltip.classList.remove("is-visible");
}

function pushReading(reading) {
  readings.push(reading);
  trimRealtimeReadings();

  updateDashboard(reading);
  updateRealtimeDataPresentation();
  drawChart();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!authApi || !auth) {
    authMessage.textContent = "Firebase chưa sẵn sàng.";
    return;
  }

  authMessage.textContent = "Đang đăng nhập...";
  const loginButton = loginForm.querySelector("#loginButton");
  loginButton.disabled = true;

  try {
    const credential = await authApi.signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    rememberSuccessfulLogin(credential.user.email || emailInput.value.trim());
    loginForm.reset();
    hidePassword();
    authMessage.textContent = "";
  } catch (error) {
    console.error(error);
    authMessage.textContent = `Đăng nhập thất bại: ${getFirebaseErrorText(error)}`;
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  if (!authApi || !auth) return;
  logoutButton.disabled = true;

  try {
    await authApi.signOut(auth);
    readings.splice(0, readings.length);
    updateRealtimeDataPresentation("Đã xóa dữ liệu biểu đồ sau khi đăng xuất.");
    historyReadings = [];
    eventLog.replaceChildren();
    stopHistoryFirestore();
    stopConnectionMonitor();
  } catch (error) {
    console.error(error);
    addEvent(`Không thể đăng xuất: ${getFirebaseErrorText(error)}`, "danger");
  } finally {
    logoutButton.disabled = false;
  }
});

applyHistoryRangeButton.addEventListener("click", applySelectedHistoryRange);
showAllHistoryButton.addEventListener("click", showAllHistory);
exportCsvButton.addEventListener("click", exportHistoryCsv);
chartRangeSelect.addEventListener("change", updateRealtimeChartRange);
thresholdForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const nextThresholds = {
    temperatureMin: Number(temperatureMinInput.value),
    temperatureMax: Number(temperatureMaxInput.value),
    humidityMin: Number(humidityMinInput.value),
    humidityMax: Number(humidityMaxInput.value),
  };

  if (!thresholdForm.checkValidity()) {
    thresholdForm.reportValidity();
    return;
  }

  if (!areValidThresholds(nextThresholds)) {
    thresholdMessage.textContent = "Ngưỡng tối thiểu phải nhỏ hơn ngưỡng tối đa.";
    thresholdMessage.classList.add("error");
    return;
  }

  try {
    localStorage.setItem(thresholdStorageKey, JSON.stringify(nextThresholds));
  } catch {
    thresholdMessage.textContent = "Trình duyệt không cho phép lưu cấu hình.";
    thresholdMessage.classList.add("error");
    return;
  }

  alertThresholds = nextThresholds;
  try {
    await saveSharedSettings();
  } catch (error) {
    thresholdMessage.textContent = `Không thể đồng bộ cấu hình: ${getFirebaseErrorText(error)}`;
    thresholdMessage.classList.add("error");
    return;
  }
  thresholdMessage.textContent = "Đã lưu ngưỡng cảnh báo.";
  thresholdMessage.classList.remove("error");
  if (latestReading) updateDashboard(latestReading);
});

resetThresholdsButton.addEventListener("click", async () => {
  alertThresholds = { ...defaultThresholds };
  try {
    localStorage.removeItem(thresholdStorageKey);
  } catch {
    // The in-memory defaults still apply for the current session.
  }
  fillThresholdForm();
  try {
    await saveSharedSettings();
  } catch (error) {
    thresholdMessage.textContent = `Không thể đồng bộ cấu hình: ${getFirebaseErrorText(error)}`;
    thresholdMessage.classList.add("error");
    return;
  }
  thresholdMessage.textContent = "Đã khôi phục ngưỡng mặc định.";
  thresholdMessage.classList.remove("error");
  if (latestReading) updateDashboard(latestReading);
});
emailNotificationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!emailNotificationForm.checkValidity()) {
    emailNotificationForm.reportValidity();
    return;
  }

  const nextSettings = {
    enabled: emailNotificationEnabledInput.checked,
    email: notificationEmailInput.value.trim(),
  };

  try {
    localStorage.setItem(emailNotificationStorageKey, JSON.stringify(nextSettings));
  } catch {
    emailNotificationMessage.textContent = "Trình duyệt không cho phép lưu cấu hình.";
    emailNotificationMessage.classList.add("error");
    return;
  }

  emailNotificationSettings = nextSettings;
  try {
    await saveSharedSettings();
  } catch (error) {
    emailNotificationMessage.textContent = `Không thể đồng bộ cấu hình: ${getFirebaseErrorText(error)}`;
    emailNotificationMessage.classList.add("error");
    return;
  }
  lastEmailSentAt.clear();
  try {
    localStorage.removeItem(emailLastSentStorageKey);
  } catch {
    // A newly saved configuration still applies without persistent cooldown state.
  }
  emailNotificationMessage.textContent = nextSettings.enabled
    ? "Đã bật thông báo qua email."
    : "Đã tắt thông báo qua email.";
  emailNotificationMessage.classList.remove("error");
});
chart.addEventListener("pointermove", (event) => showReadingTooltip(event, false));
chart.addEventListener("pointerleave", () => hideReadingTooltip(realtimeTooltip));
historyChart.addEventListener("pointermove", (event) => showReadingTooltip(event, true));
historyChart.addEventListener("pointerleave", () => hideReadingTooltip(historyTooltip));
startCameraButton.addEventListener("click", startCamera);
stopCameraButton.addEventListener("click", stopCamera);
captureButton.addEventListener("click", captureCameraImage);

window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrameId);
  resizeFrameId = requestAnimationFrame(() => {
    resizeCanvas();
    resizeHistoryCanvas();
  });
});
window.addEventListener("beforeunload", () => {
  stopCamera();
  stopConnectionMonitor();
  stopReadingFirestore();
  stopHistoryFirestore();
  stopSettingsFirestore();
});

fillThresholdForm();
fillEmailNotificationForm();
setupFirebase();
