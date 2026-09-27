import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import { fetchFile, toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";

const $=s=>document.querySelector(s);
const input=$("#videoInput"), result=$("#result"), preview=$("#preview"), outputPreview=$("#outputPreview");
const resolution=$("#resolution"), fps=$("#fps"), duration=$("#duration"), size=$("#size");
const profileName=$("#profileName"), profileText=$("#profileText"), status=$("#status");
const prepareBtn=$("#prepareBtn"), quality=$("#quality"), fpsMode=$("#fpsMode");
const progressWrap=$("#progressWrap"), progress=$("#progress"), progressText=$("#progressText"), progressPct=$("#progressPct");
const downloadArea=$("#downloadArea"), downloadBtn=$("#downloadBtn"), originalSize=$("#originalSize"), outputSize=$("#outputSize"), savings=$("#savings");

const ffmpeg=new FFmpeg();
let currentFile=null,inputUrl=null,outputUrl=null,metadata={};

function formatBytes(bytes){const u=["B","KB","MB","GB"];let i=0,n=bytes;while(n>=1024&&i<u.length-1){n/=1024;i++}return `${n.toFixed(i?1:0)} ${u[i]}`}
function formatTime(s){if(!Number.isFinite(s))return"—";return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`}
function setProgress(p,msg){p=Math.max(0,Math.min(100,p));progress.value=p;progressPct.textContent=`${Math.round(p)}%`;if(msg)progressText.textContent=msg}
function profile(w,h){const v=h>w,k=Math.max(w,h)>=2160;return v&&k
 ?["TikTok vertical · 4K","Tu video ya es vertical y tiene resolución 4K o superior. Buscaremos reducir tamaño evitando bajar la resolución."]
 :v?["TikTok vertical","Tu video ya está en vertical. Conservaremos sus dimensiones y optimizaremos la compresión."]
 :["TikTok · horizontal","El video es horizontal. Esta versión no recorta automáticamente; optimiza principalmente tamaño y compatibilidad."]}

input.addEventListener("change",()=>{
 const file=input.files?.[0];if(!file)return;currentFile=file;
 if(inputUrl)URL.revokeObjectURL(inputUrl);inputUrl=URL.createObjectURL(file);preview.src=inputUrl;
 result.classList.remove("hidden");downloadArea.classList.add("hidden");progressWrap.classList.add("hidden");prepareBtn.disabled=true;status.textContent="Analizando…";
 preview.onloadedmetadata=()=>{
  metadata={width:preview.videoWidth,height:preview.videoHeight,duration:preview.duration};
  resolution.textContent=`${metadata.width} × ${metadata.height}`;duration.textContent=formatTime(metadata.duration);size.textContent=formatBytes(file.size);
  fps.textContent="No disponible";const [n,d]=profile(metadata.width,metadata.height);profileName.textContent=n;
  profileText.textContent=d+" El navegador no expone de forma fiable los FPS exactos en todos los dispositivos.";
  originalSize.textContent=formatBytes(file.size);status.textContent="Listo. El video permanece en tu dispositivo.";prepareBtn.disabled=false;
 };
});

ffmpeg.on("progress",({progress:p})=>setProgress(p*100,"Comprimiendo video…"));

async function loadFFmpeg(){
 if(ffmpeg.loaded)return;
 setProgress(2,"Cargando motor de video…");
 const base="https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
 await ffmpeg.load({coreURL:await toBlobURL(`${base}/ffmpeg-core.js`,"text/javascript"),wasmURL:await toBlobURL(`${base}/ffmpeg-core.wasm`,"application/wasm")});
}

prepareBtn.addEventListener("click",async()=>{
 if(!currentFile)return;prepareBtn.disabled=true;downloadArea.classList.add("hidden");progressWrap.classList.remove("hidden");setProgress(0,"Preparando…");
 try{
  await loadFFmpeg();
  const inputName=currentFile.name.toLowerCase().endsWith(".mov")?"input.mov":"input.mp4",outputName="tiktok-optimized.mp4";
  setProgress(5,"Cargando video en memoria…");await ffmpeg.writeFile(inputName,await fetchFile(currentFile));
  const args=["-i",inputName,"-c:v","libx264","-preset","veryfast","-crf",quality.value,"-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-movflags","+faststart"];
  if(fpsMode.value!=="source")args.push("-r",fpsMode.value);args.push(outputName);
  status.textContent="Procesando localmente. En 4K/60 FPS puede tardar bastante y consumir mucha memoria.";
  await ffmpeg.exec(args);
  setProgress(96,"Preparando descarga…");
  const data=await ffmpeg.readFile(outputName),blob=new Blob([data.buffer],{type:"video/mp4"});
  if(outputUrl)URL.revokeObjectURL(outputUrl);outputUrl=URL.createObjectURL(blob);
  outputPreview.src=outputUrl;downloadBtn.href=outputUrl;downloadArea.classList.remove("hidden");
  outputSize.textContent=formatBytes(blob.size);
  const saved=((currentFile.size-blob.size)/currentFile.size)*100;savings.textContent=saved>0?`${saved.toFixed(1)}%`:"0%";
  setProgress(100,"Optimización terminada.");status.textContent="Listo. El archivo optimizado se creó en tu dispositivo y no se subió a un servidor.";
 }catch(e){
  console.error(e);setProgress(0,"Error");
  status.textContent="No se pudo procesar este video en el navegador. Prueba primero con un clip corto. Si falla con varios archivos, pasaremos el procesamiento pesado a un servidor.";
 }finally{prepareBtn.disabled=false}
});
