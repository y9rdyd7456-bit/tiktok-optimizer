# TikTok Optimizer Backend v0.3

API FastAPI + FFmpeg para Render.

Render:
- New -> Web Service
- conecta este repositorio
- Runtime: Docker
- Root Directory: server
- Plan: Free
- Dockerfile Path: Dockerfile

Endpoints:
GET /health
POST /optimize (video, crf=18|20|23, fps=source|60|30)

El almacenamiento es temporal y el servicio gratuito de Render puede apagarse tras 15 minutos sin tráfico.
