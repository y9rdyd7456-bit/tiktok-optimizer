import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import {
  fetchFile,
  toBlobURL
} from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";

const $ = (s) => document.querySelector(s);

const input = $("#videoInput");
const result = $("#result");
const preview = $("#preview");
const outputPreview = $("#outputPreview");

const resolution = $("#resolution");
const fps = $("#fps");
const duration = $("#duration");
const size = $("#size");

const profileName = $("#profileName");
const profileText = $("#profileText");
const status = $("#status");

const prepareBtn = $("#prepareBtn");
const quality = $("#quality");
const fpsMode = $("#fpsMode");

const progressWrap = $("#progressWrap");
const progress = $("#progress");
const progressText = $("#progressText");
const progressPct = $("#progressPct");

const downloadArea = $("#downloadArea");
const downloadBtn = $("#downloadBtn");
const originalSize = $("#originalSize");
const outputSize = $("#outputSize");
const savings = $("#savings");

const ffmpeg = new FFmpeg();

let currentFile = null;
let inputUrl = null;
let outputUrl = null;

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let value = bytes;

  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }

  return `${value.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "—";

  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);

  return `${min}:${String(sec).padStart(2, "0")}`;
}

function setProgress(value, message) {
  const safe = Math.max(0, Math.min(100, value));

  progress.value = safe;
  progressPct.textContent = `${Math.round(safe)}%`;
  progressText.textContent = message;
}

function showStatus(message) {
  status.textContent = message;
}

/* -----------------------------
   LOGS REALES DE FFMPEG
----------------------------- */

ffmpeg.on("log", ({ message }) => {
  console.log("[FFmpeg]", message);

  if (
    message.includes("Input #0") ||
    message.includes("Output #0") ||
    message.includes("Stream mapping") ||
    message.includes("frame=")
  ) {
    showStatus(message);
  }
});

/* -----------------------------
   PROGRESO DE CODIFICACIÓN
----------------------------- */

ffmpeg.on("progress", ({ progress: value }) => {
  const percent = 10 + value * 85;

  setProgress(
    percent,
    "Comprimiendo video…"
  );
});

/* -----------------------------
   PERFIL
----------------------------- */

function getProfile(width, height) {
  const vertical = height > width;
  const fourK = Math.max(width, height) >= 2160;

  if (vertical && fourK) {
    return [
      "TikTok vertical · 4K",
      "Video vertical en resolución 4K o superior."
    ];
  }

  if (vertical) {
    return [
      "TikTok vertical",
      "Video vertical listo para optimización."
    ];
  }

  return [
    "TikTok · horizontal",
    "Video horizontal. No se recortará automáticamente."
  ];
}

/* -----------------------------
   SELECCIÓN DE VIDEO
----------------------------- */

input.addEventListener("change", () => {

  const file = input.files?.[0];

  if (!file) return;

  currentFile = file;

  if (inputUrl) {
    URL.revokeObjectURL(inputUrl);
  }

  inputUrl = URL.createObjectURL(file);

  preview.src = inputUrl;

  result.classList.remove("hidden");
  downloadArea.classList.add("hidden");
  progressWrap.classList.add("hidden");

  prepareBtn.disabled = true;

  showStatus("Analizando video…");

  preview.onloadedmetadata = () => {

    resolution.textContent =
      `${preview.videoWidth} × ${preview.videoHeight}`;

    duration.textContent =
      formatTime(preview.duration);

    size.textContent =
      formatBytes(file.size);

    fps.textContent =
      "No disponible";

    const [name, description] =
      getProfile(
        preview.videoWidth,
        preview.videoHeight
      );

    profileName.textContent = name;

    profileText.textContent =
      `${description} Los FPS exactos no están disponibles de forma fiable mediante el elemento de video del navegador.`;

    originalSize.textContent =
      formatBytes(file.size);

    showStatus(
      "Video listo. Pulsa Optimizar video."
    );

    prepareBtn.disabled = false;
  };
});

/* -----------------------------
   CARGAR FFMPEG
----------------------------- */

let ffmpegLoaded = false;

async function loadFFmpeg() {

  if (ffmpegLoaded) {
    return;
  }

  setProgress(
    1,
    "Preparando motor de video…"
  );

  showStatus(
    "Descargando FFmpeg (~31 MB). Esta carga ocurre una sola vez."
  );

  const baseURL =
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

  try {

    setProgress(
      2,
      "Descargando motor FFmpeg…"
    );

    const coreURL = await toBlobURL(
      `${baseURL}/ffmpeg-core.js`,
      "text/javascript"
    );

    setProgress(
      4,
      "Descargando componente WebAssembly…"
    );

    const wasmURL = await toBlobURL(
      `${baseURL}/ffmpeg-core.wasm`,
      "application/wasm"
    );

    setProgress(
      7,
      "Inicializando FFmpeg…"
    );

    showStatus(
      "Inicializando motor de video…"
    );

    await ffmpeg.load({
      coreURL,
      wasmURL
    });

    ffmpegLoaded = true;

    setProgress(
      10,
      "Motor listo."
    );

    showStatus(
      "✅ FFmpeg está listo. Comenzando procesamiento."
    );

  } catch (error) {

    console.error(
      "FFmpeg load error:",
      error
    );

    throw new Error(
      `No se pudo iniciar FFmpeg: ${error.message || error}`
    );
  }
}

/* -----------------------------
   OPTIMIZAR VIDEO
----------------------------- */

prepareBtn.addEventListener("click", async () => {

  if (!currentFile) return;

  prepareBtn.disabled = true;

  downloadArea.classList.add("hidden");
  progressWrap.classList.remove("hidden");

  setProgress(
    0,
    "Preparando…"
  );

  try {

    /* 1. CARGAR MOTOR */

    await loadFFmpeg();

    /* 2. CARGAR VIDEO */

    const extension =
      currentFile.name
        .toLowerCase()
        .endsWith(".mov")
        ? "mov"
        : "mp4";

    const inputName =
      `input.${extension}`;

    const outputName =
      "tiktok-optimized.mp4";

    setProgress(
      11,
      "Cargando video en memoria…"
    );

    await ffmpeg.writeFile(
      inputName,
      await fetchFile(currentFile)
    );

    /* 3. CONFIGURACIÓN */

    const args = [
      "-i",
      inputName,

      "-c:v",
      "libx264",

      "-preset",
      "veryfast",

      "-crf",
      quality.value,

      "-pix_fmt",
      "yuv420p",

      "-c:a",
      "aac",

      "-b:a",
      "192k",

      "-movflags",
      "+faststart"
    ];

    if (fpsMode.value !== "source") {
      args.push(
        "-r",
        fpsMode.value
      );
    }

    args.push(
      outputName
    );

    /* 4. CODIFICAR */

    setProgress(
      15,
      "Comprimiendo video…"
    );

    showStatus(
      "FFmpeg está codificando el video. No cierres esta página."
    );

    await ffmpeg.exec(args);

    /* 5. LEER RESULTADO */

    setProgress(
      96,
      "Preparando resultado…"
    );

    const data =
      await ffmpeg.readFile(
        outputName
      );

    const blob =
      new Blob(
        [data.buffer],
        { type: "video/mp4" }
      );

    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
    }

    outputUrl =
      URL.createObjectURL(blob);

    outputPreview.src =
      outputUrl;

    downloadBtn.href =
      outputUrl;

    outputSize.textContent =
      formatBytes(blob.size);

    const saving =
      ((currentFile.size - blob.size) /
      currentFile.size) * 100;

    savings.textContent =
      saving > 0
        ? `${saving.toFixed(1)}%`
        : "0%";

    downloadArea.classList.remove(
      "hidden"
    );

    setProgress(
      100,
      "¡Optimización terminada!"
    );

    showStatus(
      "✅ Video optimizado correctamente."
    );

  } catch (error) {

    console.error(
      "Processing error:",
      error
    );

    setProgress(
      0,
      "Error"
    );

    showStatus(
      `❌ ${error.message || "No se pudo procesar el video."}`
    );

  } finally {

    prepareBtn.disabled = false;
  }
});
