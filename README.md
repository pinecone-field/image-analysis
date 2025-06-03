# Pinecone Showcase – Image Analysis & Search

## Overview

A modular, full-stack demo for image ingestion, embedding, segmentation, and search using Pinecone, OpenAI CLIP (local), and Meta SAM2 (GPU, via microservice). Supports full-image and object-level search, text-to-image queries, and hybrid search. Designed for extensibility and developer-friendliness.

## Core Capabilities

- **Image Ingestion & Embedding**: Upload images, generate CLIP embeddings and captions, optionally embed detected regions/objects.
- **Segmentation**: Automatic region segmentation with Meta SAM2 (runs as a GPU microservice).
- **Storage & Indexing**: Store embeddings and metadata in Pinecone, including object-level regions.
- **Search**: Search by image, region/object, or text. Hybrid queries supported.
- **Visual Segmentation UI**: Interactive region selection for custom crops.
- **Duplicate Detection**: Group near-duplicate images.
- **Metadata Ingestion**: Parse and index EXIF data.
- **Embeddings Audit**: View and compare raw vectors.
- **Sample Dataset**: Optionally seed with a prebuilt gallery.

## Project Structure

```bash
image-analysis-app/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── images.py         # Upload, index, search
│   │   │   │   ├── objects.py        # Object-level search
│   │   │   └── __init__.py
│   │   ├── core/
│   │   │   ├── embeddings.py         # CLIP embedding functions (local, CPU)
│   │   │   ├── detection.py          # Segmentation client (calls sam2 service)
│   │   │   ├── pinecone.py           # Indexing and search abstraction
│   │   │   └── config.py             # Configs (model path, keys, etc.)
│   │   ├── models/
│   │   │   ├── schemas.py            # Pydantic models for request/response
│   │   └── main.py                   # FastAPI app entry point
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ImageUploader.tsx
│   │   │   ├── ImageSearch.tsx
│   │   │   ├── RegionSelector.tsx    # Canvas-style object selection
│   │   ├── pages/
│   │   │   ├── index.tsx
│   │   │   ├── search.tsx
│   │   ├── utils/
│   │   │   ├── api.ts                # Axios interface to backend
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── sam2/
│   ├── app/
│   │   └── main.py                   # FastAPI microservice for SAM2 segmentation
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── checkpoints/                  # Model weights for SAM2 (see below)
│   └── configs/                      # Model config for SAM2 (see below)
├── shared/
│   ├── types/
│   │   ├── index.ts                  # Shared type definitions (image metadata, etc.)
├── .env
├── docker-compose.yml
└── README.md
```

---

## Model Checkpoints

**Model checkpoints and configs for SAM2 are NOT included in this repository.**

To use the SAM2 segmentation service, you must download the official model weights and config files from the Meta SAM2 repository:

- Repository: <https://github.com/facebookresearch/sam2>
- Use the provided `download_ckpts.sh` script in that repo to download the checkpoints and configs.
- Place the downloaded files in `sam2/checkpoints/` and `sam2/configs/` as required by the `sam2` service Dockerfile and code.

---

## Deployment & Security

- **All services (frontend, backend, sam2) are designed to run on a single EC2 GPU instance** for simplicity. Use Docker Compose for orchestration.
- **For secure development/testing:**
  - Only open port 22 (SSH) in your security group.
  - Use SSH tunneling to access frontend/backend locally:

    ```sh
    ssh -i /path/to/key.pem -L 3000:localhost:3000 -L 8000:localhost:8000 -L 8001:localhost:8001 ec2-user@<EC2_PUBLIC_IP>
    ```

  - Access services at `localhost:3000`, `localhost:8000`, etc. on your local machine.
- **For production:**
  - Consider a reverse proxy (nginx, Caddy) and HTTPS.
  - Restrict public access to only the frontend, if possible.

## Cost-Saving Tips

- **Spot Instances:** For development and testing, consider using AWS Spot Instances to save up to 90% on compute costs. Be aware that spot instances can be interrupted at any time.
- **Automatic Shutdown:** To avoid unnecessary charges, set up automatic shutdown for your EC2 instance after a period of inactivity.
- **Manual Start/Stop:** Before deploying Docker, ensure your EC2 instance is running. You can start/stop your instance using the AWS Console or AWS CLI:

  ```sh
  aws ec2 start-instances --instance-ids <your-instance-id>
  aws ec2 stop-instances --instance-ids <your-instance-id>
  ```

- **Monitor Usage:** Regularly monitor your AWS usage and billing dashboard to avoid unexpected charges.

---

## Getting Started

- See `backend/requirements.txt`, `frontend/package.json`, and `sam2/requirements.txt` for dependencies.
- Configure API keys, model paths, and Pinecone settings in `.env` and `backend/app/core/config.py`.
- **Download SAM2 model weights and configs from [facebookresearch/sam2](https://github.com/facebookresearch/sam2) using their `download_ckpts.sh` script.** (NOTE: For your convenience a copy of this script is included in the `image-analysis-app` directory. However it is recommended to download a fresh version from the source for production work.)
- Place the downloaded files in `sam2/checkpoints/` and `sam2/configs/`.
- Run all services with Docker Compose or start them separately as needed.
- For development, use SSH tunneling for secure access.

---
