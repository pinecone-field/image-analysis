from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Dict, Any
from app.core.embeddings import extract_embeddings, generate_caption
from app.core.detection import detect_objects, crop_region_with_mask, ensure_2d_mask
from app.core.pinecone import index_embeddings, get_pinecone_index
from datetime import datetime
import uuid
import base64
import numpy as np
import logging
import traceback
import os
from PIL import Image as PILImage
import io

router = APIRouter()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

IMAGES_DIR = "images"
if not os.path.exists(IMAGES_DIR):
    os.makedirs(IMAGES_DIR)

@router.post("/upload")
def upload_image(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Upload an image, generate embedding/caption, and index in Pinecone.
    Returns full image and region metadata for dev/testing.
    """
    try:
        logger.info("Received image upload request: %s", file.filename)
        image_bytes = file.file.read()
        image_id = str(uuid.uuid4())
        filename = file.filename
        # Compute embedding for duplicate detection
        logger.info("Checking for duplicate images in Pinecone...")
        from app.core.pinecone import search_index
        matches = search_index(image_bytes, top_k=5)
        similar = []
        for m in matches:
            if m.get("score", 0) > 0.999:
                # Use image_path from metadata if present, else id
                path = m.get("metadata", {}).get("image_path") or m.get("id")
                similar.append(path)
        if similar:
            logger.info("Duplicate image detected. Returning similar images.")
            return {
                "duplicate": True,
                "similar_images": similar
            }
        # Store the image on disk
        image_save_path = os.path.join(IMAGES_DIR, f"{image_id}_{filename}")
        with open(image_save_path, "wb") as f:
            f.write(image_bytes)
        logger.info(f"Saved image to {image_save_path}")
        logger.info("Generating caption for image_id=%s", image_id)
        caption = generate_caption(image_bytes)
        logger.info("Generating embedding for image_id=%s", image_id)
        embedding = extract_embeddings(image_bytes)
        logger.info("Detecting objects/regions for image_id=%s", image_id)
        objects = detect_objects(image_bytes)
        object_tags = [obj["tag"] for obj in objects]
        upload_time = datetime.utcnow()
        # --- BATCH EMBEDDING COLLECTION ---
        all_embeddings = []
        all_ids = []
        all_metadatas = []
        # Full image
        all_embeddings.append(embedding)
        all_ids.append(image_save_path)
        all_metadatas.append({
            "image_id": image_id,
            "caption": caption,
            "object_tags": object_tags,
            "upload_time": upload_time.isoformat(),
            "type": "full_image",
            "filename": filename,
            "image_path": image_save_path
        })
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
            region_vector_id = f"{image_save_path}#region_{idx}"
            # --- BATCH EMBEDDING ADD ---
            all_embeddings.append(region_embedding)
            all_ids.append(region_vector_id)
            all_metadatas.append({
                "image_id": image_id,
                "region_idx": int(idx),
                "caption": caption,
                "object_tag": tag,
                "upload_time": upload_time.isoformat(),
                "type": "region",
                "filename": filename,
                "image_path": image_save_path
            })
            region_dict = {
                "tag": tag,
                "bbox": bbox_py,
                "mask_png_b64": mask_b64,
                "polygon": obj.get("polygon"),
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
                    "semantic_label": "full_image"
                }
                regions.append(region_dict)
        # --- BATCH UPSERT ---
        logger.info(f"Batch upserting {len(all_embeddings)} vectors to Pinecone for image_id={image_id}")
        index_embeddings(all_embeddings, all_ids, all_metadatas)
        # Add base64-encoded PNG of the uploaded image for frontend display
        img = PILImage.open(io.BytesIO(image_bytes)).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        image_png_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        logger.info("Successfully processed image_id=%s with %d regions", image_id, len(regions))
        return {
            "image": {
                "image_id": image_id,
                "caption": caption,
                "object_tags": object_tags,
                "upload_time": upload_time.isoformat(),
                "filename": filename,
                "image_png_b64": image_png_b64,
            },
            "regions": regions
        }
    except Exception as e:
        logger.error("Exception during image upload: %s", e)
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

@router.post("/search")
def search_images(mask_png_b64: str = None, bbox: list = None, file: UploadFile = File(None), query: str = Form(None)):
    """
    Search for similar images/regions by region mask or image or text query.
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
            # Search Pinecone for similar regions
            index = get_pinecone_index()
            results = index.query(vector=embedding, top_k=10, include_metadata=True)
            # Ensure all matches are dicts
            matches = results.get("matches", [])
            serializable_matches = []
            for m in matches:
                if hasattr(m, "to_dict"):
                    serializable_matches.append(m.to_dict())
                elif isinstance(m, dict):
                    serializable_matches.append(m)
                else:
                    serializable_matches.append(dict(m))
            return serializable_matches
        # If file is provided, extract embedding and search
        if file:
            image_bytes = file.file.read()
            embedding = extract_embeddings(image_bytes)
            from app.core.pinecone import get_pinecone_index
            index = get_pinecone_index()
            results = index.query(vector=embedding, top_k=10, include_metadata=True)
            matches = results.get("matches", [])
            serializable_matches = []
            for m in matches:
                if hasattr(m, "to_dict"):
                    serializable_matches.append(m.to_dict())
                elif isinstance(m, dict):
                    serializable_matches.append(m)
                else:
                    serializable_matches.append(dict(m))
            return serializable_matches
        # If text query is provided, TODO: implement text embedding search
        return []
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

@router.get("/meta")
def get_image_meta(id: str):
    """
    Return metadata for a given image vector ID (image_path).
    """
    from app.core.pinecone import get_pinecone_index
    index = get_pinecone_index()
    res = index.fetch(ids=[id])
    # Pinecone FetchResponse has a .vectors attribute
    vectors = getattr(res, 'vectors', None)
    if vectors and id in vectors:
        meta = vectors[id].get("metadata", {})
        meta["id"] = id
        return meta
    # Try .to_dict() if available
    if hasattr(res, 'to_dict'):
        d = res.to_dict()
        if "vectors" in d and id in d["vectors"]:
            meta = d["vectors"][id].get("metadata", {})
            meta["id"] = id
            return meta
    return {"id": id, "error": "Not found"}
