import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import {
  fetchFile,
  toBlobURL
} from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";

const $ = (selector) => document.querySelector(selector);

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
let metadata = {};

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

  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function setProgress(value, text) {
  const safeValue = Math.max(0, Math.min(100, value));

  progress.value = safeValue;
  progressPct.textContent = `${Math.round(safeValue)}%`;
  progressText.textContent = text;
}

function getProfile(width, height) {
  const vertical = height > width;
  const is4K = Math.max(width, height) >= 2160;

  if (vertical && is4K) {
    return [
      "TikTok vertical · 4K",
      "Tu video ya es vertical y tiene resolución 4K o superior."
    ];
  }

  if (vertical) {
    return [
      "TikTok vertical",
      "Tu video ya está en formato vertical."
    ];
  }

  return [
    "TikTok · horizontal",
    "El video es horizontal. Esta versión no recorta automáticamente."
  ];
}

/* --------------------------------
   VIDEO SELECCIONADO
-------------------------------- */

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

  status.textContent = "Analizando video…";

  preview.onloadedmetadata = () => {
    metadata = {
      width: preview.videoWidth,
      height: preview.videoHeight,
      duration: preview.duration
    };

    resolution.textContent =
      `${metadata.width} × ${metadata.height}`;

    duration.textContent =
      formatTime(metadata.duration);

    size.textContent =
      formatBytes(file.size);

    fps.textContent =
      "No disponible";

    const [name, description] =
      getProfile(metadata.width, metadata.height);

    profileName.textContent = name;

    profileText.textContent =
      `${description} El navegador no expone de forma fiable los FPS exactos en todos los dispositivos.`;

    originalSize.textContent =
      formatBytes(file.size);

    status.textContent =
      "Video listo. El archivo permanece en tu dispositivo.";

    prepareBtn.disabled = false;
  };
});

/* --------------------------------
   PROGRESO FFmpeg
-------------------------------- */

ffmpeg.on("progress", ({ progress: value }) => {
  setProgress(
    5 + value * 90,
    "Comprimiendo video…"
  );
});

/* --------------------------------
   CARGAR FFmpeg
-------------------------------- */

async function loadFFmpeg() {
  if (ffmpeg.loaded) {
    return;
  }

  setProgress(
    1,
    "Conectando con el motor de video…"
  );

  status.textContent =
    "Preparando FFmpeg WebAssembly. La primera carga puede tardar.";

  /*
    Usamos un CDN alternativo para evitar que una
    descarga bloqueada deje el progreso congelado.
  */

  const coreBase =
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";

  try {
    setProgress(
      2,
      "Descargando motor de video…"
    );

    const coreURL = await toBlobURL(
      `${coreBase}/ffmpeg-core.js`,
      "text/javascript"
    );

    setProgress(
      5,
      "Descargando componentes de video…"
    );

    const wasmURL = await toBlobURL(
      `${coreBase}/ffmpeg-core.wasm`,
      "application/wasm"
    );

    setProgress(
      8,
      "Iniciando motor…"
    );

    await ffmpeg.load({
      coreURL,
      wasmURL
    });

    setProgress(
      10,
      "Motor de video listo."
    );

    status.textContent =
      "FFmpeg está listo. Ahora comenzará la compresión.";

  } catch (error) {

    console.error(
      "Error cargando FFmpeg:",
      error
    );

    throw new Error(
      "No se pudo cargar FFmpeg WebAssembly. Revisa la conexión a Internet e inténtalo nuevamente."
    );
  }
}

/* --------------------------------
   OPTIMIZAR
-------------------------------- */

prepareBtn.addEventListener("click", async () => {

  if (!currentFile) {
    return;
  }

  prepareBtn.disabled = true;

  downloadArea.classList.add("hidden");
  progressWrap.classList.remove("hidden");

  setProgress(
    0,
    "Preparando…"
  );

  status.textContent =
    "Iniciando procesamiento local…";

  try {

    await loadFFmpeg();

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
      12,
      "Cargando video en memoria…"
    );

    await ffmpeg.writeFile(
      inputName,
      await fetchFile(currentFile)
    );

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

    args.push(outputName);

    status.textContent =
      "Comprimiendo localmente. En videos 4K/60 FPS puede tardar bastante.";

    setProgress(
      15,
      "Comprimiendo video…"
    );

    await ffmpeg.exec(args);

    setProgress(
      96,
      "Preparando archivo final…"
    );

    const data =
      await ffmpeg.readFile(outputName);

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

    downloadArea.classList.remove(
      "hidden"
    );

    outputSize.textContent =
      formatBytes(blob.size);

    const saved =
      ((currentFile.size - blob.size) /
        currentFile.size) * 100;

    savings.textContent =
      saved > 0
        ? `${saved.toFixed(1)}%`
        : "0%";

    setProgress(
      100,
      "Optimización terminada."
    );

    status.textContent =
      "Listo. El video optimizado se creó en tu dispositivo.";

  } catch (error) {

    console.error(
      "Error procesando video:",
      error
    );

    setProgress(
      0,
      "Error"
    );

    status.textContent =
      `No se pudo procesar el video: ${error.message}`;

  } finally {

    prepareBtn.disabled = false;
  }
});
