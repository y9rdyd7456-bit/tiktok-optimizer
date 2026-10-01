import uuid
import shutil
import subprocess
from pathlib import Path
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

BASE = Path("/tmp/tiktok-optimizer")
BASE.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="TikTok Optimizer API", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"name":"TikTok Optimizer API","version":"0.3.0","status":"ok"}

@app.get("/health")
def health():
    ok = shutil.which("ffmpeg") is not None
    return {"status":"ok" if ok else "error", "ffmpeg":ok}

@app.post("/optimize")
async def optimize(
    video: UploadFile = File(...),
    crf: int = Form(20),
    fps: str = Form("source"),
):
    if crf not in (18,20,23):
        raise HTTPException(400, "CRF debe ser 18, 20 o 23.")
    if fps not in ("source","60","30"):
        raise HTTPException(400, "FPS debe ser source, 60 o 30.")

    job = BASE / uuid.uuid4().hex
    job.mkdir()
    suffix = Path(video.filename or ".mp4").suffix.lower()
    if suffix not in {".mp4",".mov",".m4v",".webm",".mkv",".avi"}:
        suffix = ".mp4"

    src = job / ("input" + suffix)
    out = job / "tiktok-optimized.mp4"

    try:
        with src.open("wb") as f:
            while chunk := await video.read(1024 * 1024):
                f.write(chunk)

        vf = "scale=w=min(2160,iw):h=min(3840,ih):force_original_aspect_ratio=decrease"
        if fps in ("60","30"):
            vf += f",fps={fps}"

        cmd = [
            "ffmpeg","-hide_banner","-y","-i",str(src),
            "-map","0:v:0","-map","0:a:0?","-vf",vf,
            "-c:v","libx264","-preset","veryfast","-crf",str(crf),
            "-pix_fmt","yuv420p","-c:a","aac","-b:a","192k",
            "-movflags","+faststart","-shortest",str(out)
        ]
        r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                           text=True, timeout=900)
        if r.returncode != 0:
            raise RuntimeError(r.stderr[-5000:])
        if not out.exists() or out.stat().st_size == 0:
            raise RuntimeError("FFmpeg no produjo un archivo.")

        return FileResponse(out, media_type="video/mp4",
                            filename="tiktok-optimized.mp4")
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "La conversión superó 15 minutos.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error durante la conversión: {e}")
