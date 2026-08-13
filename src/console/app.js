import {
  rgbToHsv,
  sampleColorRuleFromRgba,
} from "../detection/colorSegmentation.js";
import { ConsoleAudioEngine } from "./audioEngine.js";
import { EntryGate } from "./entryGate.js";
import {
  MAPPING_MODES,
  activeColorRules,
  normalizeProfile,
} from "./profile.js";
import {
  SampleStore,
  buildShowPackage,
  readShowPackage,
} from "./sampleStore.js";
import { selectSoundSlot } from "./soundSelector.js";
import { ConsoleRecognitionSession } from "./recognitionSession.js";
import {
  loadStoredProfile,
  saveStoredProfile,
} from "./profileStorage.js";
import {
  canTriggerCalibratedRecognition,
  evaluateShowModeReadiness,
} from "./showModeGuard.js";

const PROCESS_WIDTH = 360;
const DETECTION_INTERVAL_MS = 78;
const MAX_EVENT_LOG = 7;

const els = {
  body: document.body,
  systemStatus: document.querySelector("#systemStatus"),
  cameraVideo: document.querySelector("#cameraVideo"),
  stageCanvas: document.querySelector("#stageCanvas"),
  processCanvas: document.querySelector("#processCanvas"),
  stageViewport: document.querySelector("#stageViewport"),
  stageIdle: document.querySelector("#stageIdle"),
  samplingHint: document.querySelector("#samplingHint"),
  liveBanner: document.querySelector("#liveBanner"),
  runtimeStateLabel: document.querySelector("#runtimeStateLabel"),
  runtimeStateDetail: document.querySelector("#runtimeStateDetail"),
  objectCount: document.querySelector("#objectCount"),
  triggerCount: document.querySelector("#triggerCount"),
  triggerLog: document.querySelector("#triggerLog"),
  cameraCheck: document.querySelector("#cameraCheck"),
  audioCheck: document.querySelector("#audioCheck"),
  profileCheck: document.querySelector("#profileCheck"),
  sceneCheck: document.querySelector("#sceneCheck"),
  cameraCheckText: document.querySelector("#cameraCheckText"),
  audioCheckText: document.querySelector("#audioCheckText"),
  profileCheckText: document.querySelector("#profileCheckText"),
  sceneCheckText: document.querySelector("#sceneCheckText"),
  startCamera: document.querySelector("#startCameraButton"),
  armAudio: document.querySelector("#armAudioButton"),
  captureBackground: document.querySelector("#captureBackgroundButton"),
  mappingMode: document.querySelector("#mappingModeSelect"),
  mappingModeHelp: document.querySelector("#mappingModeHelp"),
  profileName: document.querySelector("#profileNameInput"),
  minArea: document.querySelector("#minAreaInput"),
  minAreaValue: document.querySelector("#minAreaValue"),
  settleDelay: document.querySelector("#settleDelayInput"),
  settleDelayValue: document.querySelector("#settleDelayValue"),
  masterGain: document.querySelector("#masterGainInput"),
  masterGainValue: document.querySelector("#masterGainValue"),
  mirror: document.querySelector("#mirrorInput"),
  slotList: document.querySelector("#slotList"),
  importProfile: document.querySelector("#profileImportInput"),
  exportProfile: document.querySelector("#exportProfileButton"),
  enterShowMode: document.querySelector("#enterShowModeButton"),
  showModePanel: document.querySelector("#showModePanel"),
  showProfileName: document.querySelector("#showProfileName"),
  liveToggle: document.querySelector("#liveToggleButton"),
  runtimeReset: document.querySelector("#runtimeResetButton"),
  showMasterGain: document.querySelector("#showMasterGainInput"),
  showMasterGainValue: document.querySelector("#showMasterGainValue"),
  showSettleDelay: document.querySelector("#showSettleDelayInput"),
  showSettleDelayValue: document.querySelector("#showSettleDelayValue"),
  exitShowMode: document.querySelector("#exitShowModeButton"),
  toast: document.querySelector("#toast"),
};

const stageContext = els.stageCanvas.getContext("2d");
const processContext = els.processCanvas.getContext("2d", { willReadFrequently: true });
const audio = new ConsoleAudioEngine();
const sampleStore = new SampleStore();
const entryGate = new EntryGate();

const state = {
  profile: loadStoredProfile(localStorage),
  recognitionSession: null,
  recognitionStatus: "needs-calibration",
  stream: null,
  cameraReady: false,
  live: false,
  mode: "configure",
  samplingSlotId: null,
  lastProcessFrame: null,
  pads: [],
  events: [],
  triggerCount: 0,
  sampleRecords: {},
  lastDetectionAt: -Infinity,
  animationFrame: 0,
  wakeLock: null,
  toastTimer: 0,
};

initialize();

async function initialize() {
  rebuildRecognitionSession();
  wireEvents();
  renderAll();
  await restoreSampleRecords();
  registerServiceWorker();
  setRuntimeState("idle", "准备中", "请先完成设备检查");
}

function wireEvents() {
  els.startCamera.addEventListener("click", startCamera);
  els.armAudio.addEventListener("click", armAudio);
  els.captureBackground.addEventListener("click", captureBackground);
  els.mappingMode.addEventListener("change", () => {
    state.profile.mappingMode = els.mappingMode.value;
    commitProfile({ resetTracking: true });
  });
  els.profileName.addEventListener("change", () => {
    state.profile.name = els.profileName.value;
    commitProfile();
  });
  els.minArea.addEventListener("input", () => {
    state.profile.recognition.minArea = Number(els.minArea.value);
    commitProfile({ resetTracking: true, renderSlots: false });
  });
  els.settleDelay.addEventListener("input", () => updateSettleDelay(els.settleDelay.value));
  els.showSettleDelay.addEventListener("input", () => updateSettleDelay(els.showSettleDelay.value));
  els.masterGain.addEventListener("input", () => updateMasterGain(els.masterGain.value));
  els.showMasterGain.addEventListener("input", () => updateMasterGain(els.showMasterGain.value));
  els.mirror.addEventListener("change", () => {
    state.profile.camera.mirror = els.mirror.checked;
    state.recognitionSession.clearBackground();
    state.recognitionStatus = "needs-calibration";
    commitProfile({ resetTracking: true, renderSlots: false });
    showToast("镜像方式已改变，请重新捕捉空场。", "error");
  });
  els.slotList.addEventListener("click", handleSlotClick);
  els.slotList.addEventListener("input", handleSlotInput);
  els.slotList.addEventListener("change", handleSlotChange);
  els.stageCanvas.addEventListener("pointerdown", handleStagePointerDown);
  els.importProfile.addEventListener("change", importProfilePackage);
  els.exportProfile.addEventListener("click", exportProfilePackage);
  els.enterShowMode.addEventListener("click", enterShowMode);
  els.exitShowMode.addEventListener("click", exitShowMode);
  els.liveToggle.addEventListener("click", toggleLive);
  els.runtimeReset.addEventListener("click", resetRuntime);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("beforeunload", stopCameraTracks);
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setRuntimeState("fault", "摄像头不可用", "请使用最新版 Chrome 或 Edge");
    showToast("当前浏览器不支持摄像头访问。", "error");
    return false;
  }

  els.startCamera.disabled = true;
  els.startCamera.textContent = "正在连接…";
  stopCameraTracks();
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: { ideal: "environment" },
      },
    });
    els.cameraVideo.srcObject = state.stream;
    await els.cameraVideo.play();
    await waitForVideoDimensions(els.cameraVideo);
    resizeCanvases();
    state.cameraReady = true;
    state.lastProcessFrame = null;
    state.recognitionSession.clearBackground();
    state.recognitionStatus = "needs-calibration";
    els.stageIdle.hidden = true;
    rebuildRecognitionSession();
    startFrameLoop();
    syncSystemChecks();
    setRuntimeState(state.live ? "live" : "ready", state.live ? "正在运行" : "设备就绪", "摄像头画面已连接");
    showToast("摄像头已连接。请清空画面并捕捉空场。", "success");
    return true;
  } catch (error) {
    state.cameraReady = false;
    syncSystemChecks();
    setRuntimeState("fault", "摄像头连接失败", cameraErrorMessage(error));
    showToast(cameraErrorMessage(error), "error");
    return false;
  } finally {
    els.startCamera.disabled = false;
    els.startCamera.textContent = state.cameraReady ? "更换 / 重连摄像头" : "连接 / 更换摄像头";
  }
}

async function armAudio() {
  els.armAudio.disabled = true;
  els.armAudio.textContent = "正在启用…";
  try {
    await audio.arm();
    audio.setMasterGain(state.profile.masterGain);
    await loadAllSamplesIntoAudio();
    syncSystemChecks();
    els.armAudio.textContent = "声音已启用";
    showToast("声音已启用。未上传的槽位会使用内置音色。", "success");
    return true;
  } catch (error) {
    setRuntimeState("fault", "声音启用失败", error.message || "请检查浏览器声音权限");
    showToast(error.message || "声音启用失败", "error");
    els.armAudio.textContent = "重新启用声音";
    return false;
  } finally {
    els.armAudio.disabled = false;
    syncSystemChecks();
  }
}

function startFrameLoop() {
  if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
  const loop = (now) => {
    if (!state.cameraReady || els.cameraVideo.readyState < 2) return;
    drawCameraFrame(stageContext, els.stageCanvas.width, els.stageCanvas.height);
    if (now - state.lastDetectionAt >= DETECTION_INTERVAL_MS) {
      processDetectionFrame(now);
      state.lastDetectionAt = now;
    }
    drawPadOutlines();
    state.animationFrame = requestAnimationFrame(loop);
  };
  state.animationFrame = requestAnimationFrame(loop);
}

function processDetectionFrame(now) {
  drawCameraFrame(processContext, els.processCanvas.width, els.processCanvas.height);
  const frame = processContext.getImageData(0, 0, els.processCanvas.width, els.processCanvas.height);
  state.lastProcessFrame = frame;
  const result = state.recognitionSession.process(
    frame.data,
    els.processCanvas.width,
    els.processCanvas.height,
    now,
  );
  const previousStatus = state.recognitionStatus;
  state.recognitionStatus = result.status;
  state.pads = result.pads;
  if (result.status === "background-mismatch" && previousStatus !== result.status) {
    entryGate.reset();
    setRuntimeState("fault", "需要重拍空场", "灯光、机位或背景变化过大");
    showToast("背景变化过大：请清空画面后重新捕捉空场。", "error");
  }
  if (previousStatus !== result.status) syncSystemChecks();
  if (state.live && !canTriggerCalibratedRecognition({ live: true, result })) {
    state.live = false;
    void releaseWakeLock();
    entryGate.reset();
    syncLiveButton();
    if (result.status !== "background-mismatch") {
      setRuntimeState("fault", "识别已暂停", "请清空画面并重新捕捉空场");
      showToast("空场标定已失效，声音已暂停。请重新捕捉空场。", "error");
    }
  }
  const entries = entryGate.update(state.pads, {
    timeMs: now,
    stableMode: state.mode === "show",
    settleDelayMs: state.profile.recognition.settleDelayMs,
    frameWidth: els.processCanvas.width,
    frameHeight: els.processCanvas.height,
  });
  if (state.mode === "show") state.pads = entryGate.lockIdentities(state.pads);
  els.objectCount.textContent = String(state.pads.length);
  if (canTriggerCalibratedRecognition({ live: state.live, result })) triggerEntries(entries);
}

function captureBackground() {
  if (!state.cameraReady || !state.lastProcessFrame) {
    showToast("请先连接摄像头，等待画面出现后再捕捉空场。", "error");
    return;
  }
  state.recognitionSession.captureBackground(
    state.lastProcessFrame.data,
    els.processCanvas.width,
    els.processCanvas.height,
  );
  state.recognitionStatus = "ok";
  state.pads = [];
  entryGate.reset();
  syncSystemChecks();
  setRuntimeState(state.live ? "live" : "ready", state.live ? "正在运行" : "空场已捕捉", "可以逐色取样或开始演示");
  showToast("空场已捕捉。现在可以把彩色物件放入画面。", "success");
}

function triggerEntries(entries) {
  let didTrigger = false;
  for (const pad of entries) {
    const slot = selectSoundSlot({ profile: state.profile, pad });
    if (!slot || !audio.trigger(slot, 0.92)) continue;
    didTrigger = true;
    state.triggerCount += 1;
    state.events.unshift({
      id: `${Date.now()}-${state.triggerCount}`,
      label: slot.label,
      color: slot.colorHex,
      source: slot.soundName || `内置 ${slot.fallbackVoice}`,
    });
  }
  if (!didTrigger) return;
  state.events = state.events.slice(0, MAX_EVENT_LOG);
  els.stageViewport.classList.remove("is-triggered");
  void els.stageViewport.offsetWidth;
  els.stageViewport.classList.add("is-triggered");
  renderEventLog();
}

function drawCameraFrame(context, width, height) {
  context.save();
  context.clearRect(0, 0, width, height);
  if (state.profile.camera.mirror) {
    context.translate(width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(els.cameraVideo, 0, 0, width, height);
  context.restore();
}

function drawPadOutlines() {
  const scaleX = els.stageCanvas.width / els.processCanvas.width;
  const scaleY = els.stageCanvas.height / els.processCanvas.height;
  stageContext.save();
  stageContext.lineWidth = Math.max(2, els.stageCanvas.width / 420);
  stageContext.font = `700 ${Math.max(13, els.stageCanvas.width / 70)}px Bahnschrift, sans-serif`;
  stageContext.textBaseline = "middle";
  for (const pad of state.pads) {
    const slot = state.profile.slots.find((item) => item.colorRule.id === pad.ruleId || item.id === pad.instrument);
    const color = slot?.colorHex || "#eee9dd";
    const x = pad.bounds.x * scaleX;
    const y = pad.bounds.y * scaleY;
    const width = pad.bounds.width * scaleX;
    const height = pad.bounds.height * scaleY;
    stageContext.strokeStyle = color;
    stageContext.fillStyle = `${color}22`;
    stageContext.fillRect(x, y, width, height);
    stageContext.strokeRect(x, y, width, height);
    const label = slot?.label || "OBJECT";
    const labelWidth = stageContext.measureText(label).width + 18;
    const labelY = Math.max(0, y - 26);
    stageContext.fillStyle = color;
    stageContext.fillRect(x, labelY, labelWidth, 24);
    stageContext.fillStyle = "#171713";
    stageContext.fillText(label, x + 9, labelY + 12);
  }
  stageContext.restore();
}

function resizeCanvases() {
  const videoWidth = els.cameraVideo.videoWidth || 1280;
  const videoHeight = els.cameraVideo.videoHeight || 720;
  const stageWidth = Math.min(1280, videoWidth);
  const stageHeight = Math.round(stageWidth * videoHeight / videoWidth);
  els.stageCanvas.width = stageWidth;
  els.stageCanvas.height = stageHeight;
  els.processCanvas.width = PROCESS_WIDTH;
  els.processCanvas.height = Math.max(1, Math.round(PROCESS_WIDTH * videoHeight / videoWidth));
  els.stageViewport.style.aspectRatio = `${videoWidth} / ${videoHeight}`;
}

function handleSlotClick(event) {
  const button = event.target.closest("[data-action]");
  const card = event.target.closest("[data-slot-id]");
  if (!button || !card) return;
  const slot = findSlot(card.dataset.slotId);
  if (!slot) return;

  if (button.dataset.action === "sample") beginSampling(slot.id);
  if (button.dataset.action === "preview") previewSlot(slot);
  if (button.dataset.action === "clear-sound") clearSlotSound(slot);
}

function handleSlotInput(event) {
  const card = event.target.closest("[data-slot-id]");
  if (!card) return;
  const slot = findSlot(card.dataset.slotId);
  if (!slot) return;

  if (event.target.matches("[data-field='gain']")) {
    slot.gain = Number(event.target.value);
    card.querySelector("[data-output='gain']").textContent = formatPercent(slot.gain);
    saveProfile();
  }
}

async function handleSlotChange(event) {
  const card = event.target.closest("[data-slot-id]");
  if (!card) return;
  const slot = findSlot(card.dataset.slotId);
  if (!slot) return;

  if (event.target.matches("[data-field='enabled']")) {
    slot.enabled = event.target.checked;
    commitProfile({ resetTracking: true });
  } else if (event.target.matches("[data-field='label']")) {
    slot.label = event.target.value;
    slot.colorRule.label = slot.label;
    commitProfile();
  } else if (event.target.matches("[data-field='color']")) {
    applyHexColor(slot, event.target.value);
    commitProfile({ resetTracking: true });
  } else if (event.target.matches("[data-field='file']")) {
    const [file] = event.target.files;
    if (file) await setSlotSound(slot, file);
  }
}

function beginSampling(slotId) {
  if (!state.cameraReady || !state.lastProcessFrame) {
    showToast("请先连接摄像头，再进行镜头取色。", "error");
    return;
  }
  state.samplingSlotId = state.samplingSlotId === slotId ? null : slotId;
  els.body.classList.toggle("is-sampling", !!state.samplingSlotId);
  els.samplingHint.hidden = !state.samplingSlotId;
  renderSlots();
}

function handleStagePointerDown(event) {
  if (!state.samplingSlotId || !state.lastProcessFrame) return;
  const slot = findSlot(state.samplingSlotId);
  if (!slot) return;
  const rect = els.stageCanvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * els.processCanvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * els.processCanvas.height;
  const sample = sampleColorRuleFromRgba(
    state.lastProcessFrame.data,
    els.processCanvas.width,
    els.processCanvas.height,
    x,
    y,
    { instrument: slot.id, label: slot.label, radius: 10 },
  );
  slot.colorRule = {
    ...sample.rule,
    id: slot.colorRule.id,
    instrument: slot.id,
    label: slot.label,
  };
  slot.colorHex = rgbToHex(sample.rgb);
  state.samplingSlotId = null;
  els.body.classList.remove("is-sampling");
  els.samplingHint.hidden = true;
  commitProfile({ resetTracking: true });
  showToast(`${slot.label} 已从镜头重新取色。`, "success");
}

function applyHexColor(slot, hex) {
  const rgb = hexToRgb(hex);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  slot.colorHex = hex.toLowerCase();
  slot.colorRule.hueCenter = Math.round(hsv.h);
  slot.colorRule.hueRange = hsv.s < 0.34 ? 34 : 22;
  slot.colorRule.saturationCenter = hsv.s;
  slot.colorRule.valueCenter = hsv.v;
  slot.colorRule.minSaturation = Math.max(0.01, hsv.s - 0.18);
  slot.colorRule.maxSaturation = hsv.s < 0.3 ? Math.min(0.5, hsv.s + 0.2) : 1;
  slot.colorRule.minValue = Math.max(0.08, hsv.v - 0.26);
}

async function setSlotSound(slot, file) {
  if (!file.type.startsWith("audio/")) {
    showToast("请选择 WAV、MP3、M4A 或 OGG 音频文件。", "error");
    return;
  }
  const dataUrl = await fileToDataUrl(file);
  const record = { name: file.name, type: file.type, dataUrl };
  state.sampleRecords[slot.id] = record;
  slot.soundName = file.name;
  try {
    await sampleStore.set(slot.id, record);
  } catch (error) {
    showToast(`音效已用于本次会话，但本地保存失败：${error.message}`, "error");
  }
  if (audio.ready) await audio.loadSample(slot.id, dataUrl);
  commitProfile();
  showToast(`${slot.label} 已载入 ${file.name}`, "success");
}

async function clearSlotSound(slot) {
  delete state.sampleRecords[slot.id];
  slot.soundName = "";
  audio.removeSample(slot.id);
  try {
    await sampleStore.delete(slot.id);
  } catch {
    // The current session still clears correctly when persistent storage is unavailable.
  }
  commitProfile();
}

async function previewSlot(slot) {
  if (!audio.ready && !(await armAudio())) return;
  const record = state.sampleRecords[slot.id];
  if (record && !audio.buffers.has(slot.id)) await audio.loadSample(slot.id, record.dataUrl);
  audio.trigger(slot, 0.92);
}

async function restoreSampleRecords() {
  try {
    state.sampleRecords = await sampleStore.entries();
    for (const slot of state.profile.slots) {
      const record = state.sampleRecords[slot.id];
      if (record?.name) slot.soundName = record.name;
    }
    renderSlots();
    saveProfile();
  } catch {
    state.sampleRecords = {};
  }
}

async function loadAllSamplesIntoAudio() {
  for (const slot of state.profile.slots) audio.removeSample(slot.id);
  const results = await Promise.allSettled(Object.entries(state.sampleRecords).map(
    ([slotId, record]) => audio.loadSample(slotId, record.dataUrl),
  ));
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed) showToast(`${failed} 个上传音效无法解码，将使用内置音色。`, "error");
}

async function importProfilePackage(event) {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;
  try {
    const packageValue = readShowPackage(await file.text());
    if (!window.confirm(`导入“${packageValue.profile.name}”并替换当前配置？`)) return;
    state.profile = packageValue.profile;
    state.sampleRecords = packageValue.samples;
    try {
      await sampleStore.clear();
      await Promise.all(Object.entries(state.sampleRecords).map(
        ([slotId, record]) => sampleStore.set(slotId, record),
      ));
    } catch (error) {
      showToast(`配置已导入，但本地音效保存失败：${error.message}`, "error");
    }
    if (audio.ready) await loadAllSamplesIntoAudio();
    rebuildRecognitionSession({ clearBackground: true });
    state.recognitionStatus = "needs-calibration";
    saveProfile();
    renderAll();
    showToast(`已导入配置包：${state.profile.name}`, "success");
  } catch (error) {
    showToast(error.message || "配置包导入失败", "error");
  }
}

async function exportProfilePackage() {
  try {
    const packageValue = buildShowPackage(state.profile, state.sampleRecords);
    const blob = new Blob([JSON.stringify(packageValue, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileName(state.profile.name)}.ods-show.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("配置包已导出，换电脑时直接导入即可。", "success");
  } catch (error) {
    showToast(error.message || "配置包导出失败", "error");
  }
}

function enterShowMode() {
  if (activeColorRules(state.profile).length === 0) {
    showToast("至少需要启用一个颜色与声音槽位。", "error");
    return;
  }
  const readiness = evaluateShowModeReadiness({
    calibrated: state.recognitionSession.calibrated,
    recognitionStatus: state.recognitionStatus,
  });
  if (!readiness.allowed) {
    const message = readiness.reason === "recapture-background"
      ? "当前空场标定已经失效，请清空画面并重新捕捉空场。"
      : "请先连接摄像头，清空画面并点击“捕捉空场”。";
    showToast(message, "error");
    return;
  }
  entryGate.reset();
  entryGate.update(state.pads);
  state.mode = "show";
  state.live = false;
  els.body.classList.remove("is-config-mode");
  els.body.classList.add("is-show-mode");
  els.showProfileName.textContent = state.profile.name;
  syncLiveButton();
  setRuntimeState(state.cameraReady && audio.ready ? "ready" : "idle", "等待开始", deviceReadinessDetail());
}

async function exitShowMode() {
  state.live = false;
  state.mode = "configure";
  await releaseWakeLock();
  els.body.classList.add("is-config-mode");
  els.body.classList.remove("is-show-mode");
  syncLiveButton();
  setRuntimeState(state.cameraReady ? "ready" : "idle", state.cameraReady ? "设备就绪" : "准备中", deviceReadinessDetail());
}

async function toggleLive() {
  if (state.live) {
    state.live = false;
    await releaseWakeLock();
    syncLiveButton();
    setRuntimeState("paused", "已暂停", "识别继续，声音不会触发");
    return;
  }

  if (!state.cameraReady && !(await startCamera())) return;
  const readiness = evaluateShowModeReadiness({
    calibrated: state.recognitionSession.calibrated,
    recognitionStatus: state.recognitionStatus,
  });
  if (!readiness.allowed) {
    showToast("请先清空画面并捕捉空场，再开始运行。", "error");
    return;
  }
  if (!audio.ready && !(await armAudio())) return;
  entryGate.reset();
  entryGate.update(state.pads);
  state.live = true;
  await requestWakeLock();
  syncLiveButton();
  setRuntimeState("live", "正在运行", "新物件进入画面时播放一次");
}

function resetRuntime() {
  entryGate.reset();
  entryGate.update(state.pads);
  state.events = [];
  state.triggerCount = 0;
  renderEventLog();
  showToast("运行状态已复位；画面中现有物件不会立即重播。", "success");
}

function updateMasterGain(value) {
  state.profile.masterGain = Math.max(0, Math.min(1, Number(value)));
  audio.setMasterGain(state.profile.masterGain);
  saveProfile();
  syncPrimaryControls();
}

function updateSettleDelay(value) {
  state.profile.recognition.settleDelayMs = Number(value);
  commitProfile({ renderSlots: false });
}

function rebuildRecognitionSession({ clearBackground = false } = {}) {
  if (!state.recognitionSession) {
    state.recognitionSession = new ConsoleRecognitionSession(state.profile);
  } else {
    if (clearBackground) state.recognitionSession.clearBackground();
    state.recognitionSession.configure(state.profile);
  }
  entryGate.reset();
  state.pads = [];
}

function commitProfile({ resetTracking = false, renderSlots = true } = {}) {
  state.profile = normalizeProfile(state.profile);
  if (resetTracking) rebuildRecognitionSession();
  saveProfile();
  syncPrimaryControls();
  syncSystemChecks();
  if (renderSlots) renderSlotsList();
}

function renderAll() {
  syncPrimaryControls();
  syncSystemChecks();
  renderSlots();
  renderEventLog();
}

function syncPrimaryControls() {
  const profile = state.profile;
  els.mappingMode.value = profile.mappingMode;
  els.profileName.value = profile.name;
  els.minArea.value = String(profile.recognition.minArea);
  els.minAreaValue.textContent = String(profile.recognition.minArea);
  els.settleDelay.value = String(profile.recognition.settleDelayMs);
  els.settleDelayValue.textContent = `${profile.recognition.settleDelayMs}ms`;
  els.masterGain.value = String(profile.masterGain);
  els.masterGainValue.textContent = formatPercent(profile.masterGain);
  els.showMasterGain.value = String(profile.masterGain);
  els.showMasterGainValue.textContent = formatPercent(profile.masterGain);
  els.showSettleDelay.value = String(profile.recognition.settleDelayMs);
  els.showSettleDelayValue.textContent = `${profile.recognition.settleDelayMs}ms`;
  els.mirror.checked = profile.camera.mirror;
  els.showProfileName.textContent = profile.name;
  els.mappingModeHelp.textContent = profile.mappingMode === MAPPING_MODES.SAME_COLOR_RANDOM
    ? "只识别第一个启用槽位的颜色，每次从所有启用声音中随机选择。"
    : "10 种颜色固定对应 10 个声音，现场最容易控制。";
}

function syncSystemChecks() {
  const enabledSlots = state.profile.slots.filter((slot) => slot.enabled).length;
  els.cameraCheck.dataset.ready = String(state.cameraReady);
  els.audioCheck.dataset.ready = String(audio.ready);
  els.profileCheck.dataset.ready = String(enabledSlots > 0);
  const sceneReady = state.recognitionSession?.calibrated && state.recognitionStatus !== "background-mismatch";
  els.sceneCheck.dataset.ready = String(sceneReady);
  els.cameraCheckText.textContent = state.cameraReady ? cameraLabel() : "未连接";
  els.audioCheckText.textContent = audio.ready ? "已启用" : "未启用";
  els.profileCheckText.textContent = `${enabledSlots} 个槽位`;
  els.sceneCheckText.textContent = state.recognitionStatus === "background-mismatch"
    ? "需重新捕捉"
    : sceneReady ? "Lab 已标定" : "HSV 兼容识别";
  els.captureBackground.disabled = !state.cameraReady;
  els.captureBackground.textContent = sceneReady ? "重新捕捉空场" : "捕捉空场";
}

function renderSlots() {
  renderSlotsList();
  syncPrimaryControls();
}

function renderSlotsList() {
  const randomMode = state.profile.mappingMode === MAPPING_MODES.SAME_COLOR_RANDOM;
  const randomRecognitionSlotId = state.profile.slots.find((slot) => slot.enabled)?.id;
  els.slotList.innerHTML = state.profile.slots.map((slot, index) => {
    const record = state.sampleRecords[slot.id];
    const soundName = record?.name || slot.soundName || `内置 ${slot.fallbackVoice}`;
    const isSampling = state.samplingSlotId === slot.id;
    const randomSecondary = randomMode && slot.id !== randomRecognitionSlotId;
    return `
      <article class="slot-card${isSampling ? " is-sampling" : ""}${randomSecondary ? " is-random-secondary" : ""}"
        data-slot-id="${escapeHtml(slot.id)}" data-enabled="${slot.enabled}" style="--slot-color: ${slot.colorHex}">
        <div class="slot-card__swatch" title="点击直接选择颜色">
          <input data-field="color" type="color" value="${slot.colorHex}" aria-label="${escapeHtml(slot.label)}颜色" />
        </div>
        <div class="slot-card__main">
          <div class="slot-card__top">
            <input data-field="label" type="text" maxlength="48" value="${escapeHtml(slot.label)}" aria-label="槽位名称" />
            <label class="slot-enable">
              <input data-field="enabled" type="checkbox" ${slot.enabled ? "checked" : ""} /> 启用
            </label>
          </div>
          <div class="slot-card__sound">
            <span class="slot-card__sound-name" title="${escapeHtml(soundName)}">${escapeHtml(soundName)}</span>
            <label class="slot-card__gain">
              <input data-field="gain" type="range" min="0" max="1" step="0.01" value="${slot.gain}" aria-label="${escapeHtml(slot.label)}音量" />
              <output data-output="gain">${formatPercent(slot.gain)}</output>
            </label>
          </div>
        </div>
        <div class="slot-card__actions">
          <span class="slot-colour-actions"><button class="slot-action" data-action="sample" type="button">${isSampling ? "取消取色" : "镜头取色"}</button></span>
          <label class="slot-upload">上传音效<input class="visually-hidden" data-field="file" type="file" accept="audio/*" /></label>
          <button class="slot-action" data-action="preview" type="button">试听</button>
          ${record ? '<button class="slot-action" data-action="clear-sound" type="button">移除上传</button>' : ""}
        </div>
      </article>
    `;
  }).join("");
}

function renderEventLog() {
  els.triggerCount.textContent = String(state.triggerCount);
  if (state.events.length === 0) {
    els.triggerLog.innerHTML = '<li class="trigger-log__empty">还没有触发记录</li>';
    return;
  }
  els.triggerLog.innerHTML = state.events.map((event) => `
    <li style="--event-color: ${event.color}"><b>${escapeHtml(event.label)}</b>${escapeHtml(event.source)}</li>
  `).join("");
}

function setRuntimeState(kind, label, detail) {
  els.body.dataset.runtimeState = kind;
  els.runtimeStateLabel.textContent = label;
  els.runtimeStateDetail.textContent = detail;
  els.systemStatus.textContent = `${label} · ${detail}`;
}

function syncLiveButton() {
  const icon = els.liveToggle.querySelector(".show-action__icon");
  const label = els.liveToggle.querySelector("b");
  icon.textContent = state.live ? "Ⅱ" : "▶";
  label.textContent = state.live ? "暂停运行" : "开始运行";
}

function saveProfile() {
  saveStoredProfile(localStorage, state.profile);
}

function findSlot(slotId) {
  return state.profile.slots.find((slot) => slot.id === slotId);
}

function stopCameraTracks() {
  if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
  state.animationFrame = 0;
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  state.cameraReady = false;
}

async function requestWakeLock() {
  try {
    if (navigator.wakeLock?.request) state.wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    state.wakeLock = null;
  }
}

async function releaseWakeLock() {
  try {
    await state.wakeLock?.release();
  } catch {
    // Wake lock can already be released by the browser when the tab is hidden.
  }
  state.wakeLock = null;
}

async function handleVisibilityChange() {
  if (document.visibilityState === "visible" && state.live && !state.wakeLock) await requestWakeLock();
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function showToast(message, kind = "success") {
  clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.dataset.kind = kind;
  els.toast.hidden = false;
  state.toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 4200);
}

function cameraLabel() {
  return state.stream?.getVideoTracks?.()[0]?.label || "已连接";
}

function cameraErrorMessage(error) {
  if (error?.name === "NotAllowedError") return "摄像头权限被拒绝，请在浏览器地址栏中重新允许。";
  if (error?.name === "NotFoundError") return "没有找到可用摄像头，请检查连接。";
  if (error?.name === "NotReadableError") return "摄像头正被其他程序占用，请关闭后重试。";
  return error?.message || "摄像头连接失败，请检查设备与浏览器权限。";
}

function deviceReadinessDetail() {
  if (!state.cameraReady && !audio.ready) return "需要连接摄像头并启用声音";
  if (!state.cameraReady) return "需要连接摄像头";
  if (!audio.ready) return "需要启用声音";
  return "设备已就绪";
}

function waitForVideoDimensions(video) {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("摄像头画面启动超时")), 7000);
    video.addEventListener("loadedmetadata", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("音效文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function formatPercent(value) {
  return `${Math.round(Number(value) * 100)}%`;
}

function safeFileName(value) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "show-profile";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}
