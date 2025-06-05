# Pinecone Showcase – Image Analysis & Search

## Overview

A modular, full-stack demo for image ingestion, embedding, segmentation, and search using Pinecone, OpenAI CLIP (local), and Meta SAM2 (GPU, via Brev Launchable). Supports full-image and object-level search, text-to-image queries, and hybrid search. Designed for extensibility, reproducibility, and demo-friendliness.

## Core Capabilities

- **Image Ingestion & Embedding**: Upload images, generate CLIP embeddings and captions, optionally embed detected regions/objects.
- **Segmentation**: Automatic region segmentation with Meta SAM2 (runs on GPU, directly in backend).
- **Storage & Indexing**: Store embeddings and metadata in Pinecone, including object-level regions.
- **Search**: Search by image, region/object, or text. Hybrid queries supported.
- **Visual Segmentation UI**: Interactive region selection for custom crops.
- **Duplicate Detection**: Group near-duplicate images.
- **Metadata Ingestion**: Parse and index EXIF data.
- **Embeddings Audit**: View and compare raw vectors.
- **Sample Dataset**: Optionally seed with a prebuilt gallery.

## Project Structure

```bash
.
├── backend/
│   ├── app/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── download_ckpts.sh
├── frontend/
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── shared/
│   └── types/
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Model Checkpoints

**Model checkpoints for Meta SAM2 are NOT included in this repository.**

- The backend Dockerfile (or you, manually) runs `backend/download_ckpts.sh` to fetch the required checkpoints into `backend/checkpoints/`.
- No large files are stored in git.

---

## Deployment (Brev Launchable)

- Backend and frontend are published as prebuilt Docker images on Docker Hub.
- The `docker-compose.yml` references these images directly (no build context required).
- When using Brev, provide the full path to your compose file (blob/raw URL).
- Remove any `env_file:` lines from your compose file and set environment variables in the Brev UI.
- Select your desired GPU type (A10, L4, A100, etc.).
- Click "Validate" and launch your environment.

---

## Manual Local Run

- Clone the repo.
- Copy `.env.example` to `.env` and fill in your keys.
- Build and run with Docker Compose:

  ```sh
  docker compose up
  ```

- Access the frontend at [http://localhost:3000](http://localhost:3000) and backend at [http://localhost:8000](http://localhost:8000).

---

## Environment Variables

- See `.env.example` for required variables.
- When using Brev, set these in the Launchable UI.

---

## Notes

- All heavy compute (SAM2, CLIP) runs on GPU in the backend container.
- No credentials or secrets are stored in Docker images or in git.
- For more, see [Brev Launchables - Getting Started](https://docs.nvidia.com/brev/latest/launchables-getting-started.html).

---
