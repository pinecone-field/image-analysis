# Pinecone Showcase – Image Analysis & Search

## Overview

A modular, full-stack demo for image ingestion, embedding, and search using Pinecone, Jina CLIP V2, and YOLOv8. Supports full-image and object-level search, text-to-image queries, and hybrid search. Designed for extensibility and developer-friendliness.

## Core Capabilities

- **Image Ingestion & Embedding**: Upload images, generate CLIP embeddings and captions, optionally embed detected regions/objects.
- **Storage & Indexing**: Store embeddings and metadata in Pinecone, including object-level regions.
- **Search**: Search by image, region/object, or text. Hybrid queries supported.
- **Object Detection**: Automatic region detection with YOLOv8.
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
│   │   │   ├── embeddings.py         # CLIP embedding functions
│   │   │   ├── detection.py          # Object detection utils (YOLO or similar)
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
├── shared/
│   ├── types/
│   │   ├── index.ts                  # Shared type definitions (image metadata, etc.)
├── .env
├── docker-compose.yml
└── README.md
```

---

## Getting Started

- See `backend/requirements.txt` and `frontend/package.json` for dependencies.
- Configure API keys and model paths in `.env` and `backend/app/core/config.py`.
- Run with Docker Compose or start backend/frontend separately. 