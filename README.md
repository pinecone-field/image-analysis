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
- **Node.js Pinecone Middleware**: Securely proxies all Pinecone upsert/query operations, keeping API keys out of the browser.
- **Frontend File Type Validation**: Only allows JPEG, PNG, WEBP, GIF, or BMP uploads.
- **Uniqueness Filtering**: Search results show only the highest scoring match per image.

## Project Structure

```bash
.
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── embeddings.py
│   │   │   ├── detection.py
│   │   │   └── config.py
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── images.py
│   │   │   │   └── objects.py
│   │   │   └── __init__.py
│   │   ├── models/
│   │   │   └── schemas.py
│   │   ├── main.py
│   │   └── checkpoints/  # model checkpoints (not in git)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── download_ckpts.sh
│   ├── post-boot.sh
│   └── images/  # uploaded images (local storage)
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── StorePage.tsx
│   │   │   ├── SearchPage.tsx
│   │   │   └── HomePage.tsx
│   │   ├── components/
│   │   │   └── ImageUploader.tsx
│   │   ├── middleware/
│   │   │   └── pinecone-middleware.js
│   │   ├── api.ts
│   │   └── ...
│   ├── package.json
│   └── Dockerfile
├── shared/
│   └── types/
│       └── index.ts
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Pinecone Middleware (Node.js)

A Node.js Express service (`frontend/src/middleware/pinecone-middleware.js`) handles all Pinecone upsert and query operations. This keeps your Pinecone API key secure and out of the browser. The middleware auto-creates the index if it does not exist.

**Environment variables:**

- `PINECONE_API_KEY` – Your Pinecone API key
- `PINECONE_INDEX` – The name of your Pinecone index
- `PINECONE_DIMENSION` – (default: 512) Vector dimension
- `PINECONE_METRIC` – (default: cosine) Similarity metric
- `PINECONE_MIDDLEWARE_PORT` – (default: 4000) Port for the middleware

**To run:**

```sh
cd frontend
npm install
node src/middleware/pinecone-middleware.js
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
- Select your desired GPU type (A10, L4, A100, etc.).
- Click "Validate" and launch your environment.

---

## Post-Boot Setup (Launchable VM)

After launching your VM, you must run the new post-boot script in the `backend` directory. This script installs all necessary Python modules and starts the backend app. SSH into your VM and run:

```sh
cd image-analysis/backend
./post-boot.sh
```

## Exposing the Backend Port

Once the backend is running, you need to expose port 8000 so the frontend (and your browser) can access the API. In the Launchable UI, go to your running instance and look for the port exposure section. You can choose to expose the port to all IPs or just your own IP. Use your best judgment for security.

![Launchable Port Exposure](./docs/launchable-port-exposure.png)

## Updating Frontend Environment Variables

Each time you launch a new VM, the public IP address may change. You must update the frontend environment variable `REACT_APP_BACKEND_API` to point to the new backend API address. You can find the current IP address on the Launchable GPU page for your instance. Example:

```sh
REACT_APP_BACKEND_API=http://YOUR_VM_IP:8000
```

Update this in your `.env` or environment variable configuration before starting the frontend.

---

## Environment Variables

- See `.env.example` for required variables for backend, frontend, and middleware.

---

## Notes

- All heavy compute (SAM2, CLIP) runs on GPU in the backend container.
- No credentials or secrets are stored in Docker images or in git.
- The frontend validates file types before upload and shows a user-friendly error for unsupported types.
- Image URLs in the frontend are constructed using the backend API base URL, ensuring correct image loading in all environments.
- Search results are filtered to show only the highest scoring match per image.
- The Pinecone middleware will auto-create the index if it does not exist (troubleshooting tip: check logs if you see 404 errors from Pinecone).
- **Planned:** Future support for S3 image storage, configurable via environment variable.
- For more, see [Brev Launchables - Getting Started](https://docs.nvidia.com/brev/latest/launchables-getting-started.html).

---
