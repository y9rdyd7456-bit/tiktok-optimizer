const input = document.querySelector("#videoInput");
const result = document.querySelector("#result");
const preview = document.querySelector("#preview");
const resolution = document.querySelector("#resolution");
const fps = document.querySelector("#fps");
const duration = document.querySelector("#duration");
const size = document.querySelector("#size");
const profileName = document.querySelector("#profileName");
const profileText = document.querySelector("#profileText");
const status = document.querySelector("#status");
const prepareBtn = document.querySelector("#prepareBtn");

let currentFile = null;

function formatBytes(bytes){
  const units=["B","KB","MB","GB"];
  let i=0,n=bytes;
  while(n>=1024 && i<units.length-1){n/=1024;i++}
  return `${n.toFixed(i?1:0)} ${units[i]}`;
}
function formatTime(seconds){
  if(!Number.isFinite(seconds)) return "—";
  const m=Math.floor(seconds/60), s=Math.floor(seconds%60);
  return `${m}:${String(s).padStart(2,"0")}`;
}

input.addEventListener("change", () => {
  const file = input.files?.[0];
  if(!file) return;
  currentFile = file;
  const url = URL.createObjectURL(file);
  preview.src = url;
  result.classList.remove("hidden");
  status.textContent = "Analizando…";

  preview.onloadedmetadata = () => {
    const w = preview.videoWidth, h = preview.videoHeight;
    resolution.textContent = `${w} × ${h}`;
    duration.textContent = formatTime(preview.duration);
    size.textContent = formatBytes(file.size);

    // HTML video metadata does not reliably expose FPS on all browsers.
    // We therefore report it as unknown rather than inventing a value.
    fps.textContent = "No disponible";
    const vertical = h > w;
    const is4k = Math.max(w,h) >= 2160;
    profileName.textContent = vertical ? "TikTok vertical · 4K" : "TikTok · 4K/16:9";
    profileText.textContent =
      `${is4k ? "El video tiene resolución 4K o superior." : "El video no es 4K."} ` +
      `${vertical ? "Está orientado verticalmente." : "Está en formato horizontal."} ` +
      "La siguiente versión realizará la exportación manteniendo 60 FPS cuando sea posible.";
    status.textContent = "Análisis completado. El archivo permanece en tu dispositivo.";
  };
});

prepareBtn.addEventListener("click", () => {
  if(!currentFile) return;
  status.textContent =
    "Prototipo v0.1: análisis listo. La compresión real se añadirá en la siguiente versión con FFmpeg/WebCodecs.";
});
