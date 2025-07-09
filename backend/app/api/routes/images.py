from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Dict, Any
from app.core.embeddings import extract_embeddings, generate_caption
from app.core.detection import detect_objects, crop_region_with_mask, ensure_2d_mask
from datetime import datetime, timezone
import uuid
import base64
import numpy as np
import logging
import traceback
import os
from PIL import Image as PILImage
import io
import time

router = APIRouter()

# Configure logging
logger = logging.getLogger(__name__)

IMAGES_DIR = "images"
if not os.path.exists(IMAGES_DIR):
    os.makedirs(IMAGES_DIR)

@router.post("/upload")
def upload_image(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Upload an image, generate embedding/caption, and return all metadata and embeddings to the frontend.
    """
    try:
        start_time = time.time()
        logger.info("Received image upload request: %s", file.filename)
        image_bytes = file.file.read()
        image_id = str(uuid.uuid4())
        filename = file.filename
        # Store the image on disk
        image_save_path = os.path.join(IMAGES_DIR, f"{image_id}_{filename}")
        with open(image_save_path, "wb") as f:
            f.write(image_bytes)
        logger.info(f"Saved image to {image_save_path}")

        t_caption_start = time.time()
        logger.info("[Timing] Start generating caption for image_id=%s", image_id)
        caption = generate_caption(image_bytes)
        t_caption_end = time.time()
        logger.info("[Timing] Finished generating caption for image_id=%s (%.3f seconds)", image_id, t_caption_end - t_caption_start)

        t_emb_start = time.time()
        logger.info("[Timing] Start generating embeddings for image_id=%s", image_id)
        embedding = extract_embeddings(image_bytes)
        t_emb_end = time.time()
        logger.info("[Timing] Finished generating embeddings for image_id=%s (%.3f seconds)", image_id, t_emb_end - t_emb_start)

        t_detect_start = time.time()
        logger.info("[Timing] Start detecting objects/regions for image_id=%s", image_id)
        objects = detect_objects(image_bytes)
        t_detect_end = time.time()
        logger.info("[Timing] Finished detecting objects/regions for image_id=%s (%.3f seconds)", image_id, t_detect_end - t_detect_start)

        object_tags = [obj["tag"] for obj in objects]
        upload_time = datetime.now(timezone.utc)
        # Full image metadata
        image_metadata = {
            "image_id": image_id,
            "caption": caption,
            "object_tags": object_tags,
            "upload_time": upload_time.isoformat(),
            "type": "full_image",
            "filename": filename,
            "image_path": image_save_path,
            "embedding": embedding
        }
        regions = []
        logger.info(f"Detected {len(objects)} regions for image_id={image_id}")
        for idx, obj in enumerate(objects):
            bbox = obj["bbox"]
            mask = obj["mask"]
            tag = obj["tag"]
            logger.info(f"Region {idx}: bbox={bbox}, tag={tag}")
            region_bytes = crop_region_with_mask(image_bytes, mask, bbox)
            if region_bytes is None:
                logger.warning(f"Skipping region {idx} for image_id={image_id} due to invalid region bytes.")
                continue
            region_embedding = extract_embeddings(region_bytes)
            try:
                mask_2d = ensure_2d_mask(mask)
            except ValueError as e:
                logger.warning(f"Skipping mask PNG encoding for region {idx} due to mask error: {e}")
                continue
            mask_img = PILImage.fromarray((mask_2d * 255).astype(np.uint8))
            buf = io.BytesIO()
            mask_img.save(buf, format="PNG")
            mask_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            # Convert bbox to native Python ints for response
            def to_py_number(val):
                if isinstance(val, np.generic):
                    return val.item()
                if isinstance(val, (list, tuple, np.ndarray)):
                    return [to_py_number(x) for x in val]
                if isinstance(val, (int, float)):
                    return val
                return float(val)
            bbox_py = to_py_number(bbox)
            region_dict = {
                "tag": tag,
                "bbox": bbox_py,
                "mask_png_b64": mask_b64,
                "polygon": obj.get("polygon"),
                "embedding": region_embedding,
                "region_idx": int(idx),
                "caption": caption,  # Optionally generate a region-specific caption if desired
                "object_tag": tag,
                "upload_time": upload_time.isoformat(),
                "type": "region",
                "filename": filename,
                "image_path": image_save_path
            }
            # Add semantic_label if present
            if "semantic_label" in obj:
                region_dict["semantic_label"] = obj["semantic_label"]
            regions.append(region_dict)
        # If no regions detected, add a default region for the entire image
        if not regions:
            with PILImage.open(io.BytesIO(image_bytes)) as img:
                width, height = img.size
                bbox_py = [0, 0, width, height]
                # Create a full mask
                mask = np.ones((height, width), dtype=bool)
                mask_img = PILImage.fromarray((mask * 255).astype(np.uint8))
                buf = io.BytesIO()
                mask_img.save(buf, format="PNG")
                mask_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
                # Polygon for the image border
                polygon = [[0,0],[width,0],[width,height],[0,height]]
                region_dict = {
                    "tag": "full_image",
                    "bbox": bbox_py,
                    "mask_png_b64": mask_b64,
                    "polygon": polygon,
                    "semantic_label": "full_image",
                    "embedding": embedding,
                    "region_idx": 0,
                    "caption": caption,
                    "object_tag": "full_image",
                    "upload_time": upload_time.isoformat(),
                    "type": "region",
                    "filename": filename,
                    "image_path": image_save_path
                }
                regions.append(region_dict)
        # Add base64-encoded PNG of the uploaded image for frontend display
        img = PILImage.open(io.BytesIO(image_bytes)).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        image_png_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        total_time = time.time() - start_time
        logger.info("Successfully processed image_id=%s with %d regions. Total time: %.3f seconds", image_id, len(regions), total_time)
        return {
            "image": image_metadata,
            "regions": regions
        }
    except Exception as e:
        logger.error("Exception during image upload: %s", e)
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

@router.post("/search")
def search_images(mask_png_b64: str = None, bbox: list = None, file: UploadFile = File(None), query: str = Form(None)):
    """
    Return the embedding for a region or image so the frontend can use it for Pinecone search.
    """
    try:
        # If mask_png_b64 and bbox are provided, extract region embedding
        if mask_png_b64 and bbox:
            mask_bytes = base64.b64decode(mask_png_b64)
            mask_img = PILImage.open(io.BytesIO(mask_bytes)).convert("L")
            # For demo: create a dummy RGB region (all white)
            region_img = PILImage.new("RGB", (mask_img.width, mask_img.height), (255, 255, 255))
            region_img.putalpha(mask_img)
            buf = io.BytesIO()
            region_img.save(buf, format="PNG")
            region_bytes = buf.getvalue()
            embedding = extract_embeddings(region_bytes)
            return {"embedding": embedding}
        # If file is provided, extract embedding and return
        if file:
            image_bytes = file.file.read()
            embedding = extract_embeddings(image_bytes)
            return {"embedding": embedding}
        # If text query is provided, TODO: implement text embedding search
        return {"embedding": None}
    except Exception as e:
        logger.error("Exception during search: %s", e)
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")

@router.get("/list")
def list_images():
    """
    List all indexed images (metadata only).
    """
    try:
        # List all files in the images directory
        files = os.listdir(IMAGES_DIR)
        images = []
        for fname in files:
            if not fname.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif')):
                continue
            image_id = fname.split("_", 1)[0]
            filename = fname.split("_", 1)[1] if "_" in fname else fname
            images.append({
                "image_id": image_id,
                "filename": filename,
            })
        return images
    except Exception as e:
        logger.error("Exception during list_images: %s", e)
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"List failed: {e}")