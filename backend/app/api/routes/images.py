from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Dict, Any
from app.models.schemas import ImageUploadResponse, SearchResult
from app.core.embeddings import extract_embeddings, generate_caption
from app.core.detection import detect_objects, crop_region_with_mask
from app.core.pinecone import index_embedding
from datetime import datetime
import uuid
import base64
import numpy as np
import logging
import traceback

router = APIRouter()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        logger.info("Generating caption for image_id=%s", image_id)
        caption = generate_caption(image_bytes)
        logger.info("Generating embedding for image_id=%s", image_id)
        embedding = extract_embeddings(image_bytes)
        logger.info("Detecting objects/regions for image_id=%s", image_id)
        objects = detect_objects(image_bytes)
        object_tags = [obj["tag"] for obj in objects]
        upload_time = datetime.utcnow()
        logger.info("Indexing full image embedding for image_id=%s", image_id)
        index_embedding(
            embedding=embedding,
            metadata={
                "image_id": image_id,
                "caption": caption,
                "object_tags": object_tags,
                "upload_time": upload_time.isoformat(),
                "type": "full_image"
            },
            vector_id=f"image_{image_id}"
        )
        regions = []
        for idx, obj in enumerate(objects):
            bbox = obj["bbox"]
            mask = obj["mask"]
            tag = obj["tag"]
            logger.info("Processing region %d for image_id=%s", idx, image_id)
            region_bytes = crop_region_with_mask(image_bytes, mask, bbox)
            region_embedding = extract_embeddings(region_bytes)
            from PIL import Image as PILImage
            import io
            mask_img = PILImage.fromarray((mask * 255).astype(np.uint8))
            buf = io.BytesIO()
            mask_img.save(buf, format="PNG")
            mask_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            logger.info("Indexing region %d embedding for image_id=%s", idx, image_id)
            index_embedding(
                embedding=region_embedding,
                metadata={
                    "image_id": image_id,
                    "region_idx": idx,
                    "caption": caption,
                    "object_tag": tag,
                    "bbox": bbox,
                    "upload_time": upload_time.isoformat(),
                    "type": "region"
                },
                vector_id=f"image_{image_id}_region_{idx}"
            )
            regions.append({
                "tag": tag,
                "bbox": bbox,
                "embedding": region_embedding,
                "mask_png_b64": mask_b64
            })
        logger.info("Successfully processed image_id=%s with %d regions", image_id, len(regions))
        return {
            "image": {
                "image_id": image_id,
                "caption": caption,
                "object_tags": object_tags,
                "upload_time": upload_time,
                "embedding": embedding
            },
            "regions": regions
        }
    except Exception as e:
        logger.error("Exception during image upload: %s", e)
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

@router.post("/search", response_model=List[SearchResult])
def search_images(file: UploadFile = File(None), query: str = Form(None)):
    """
    Search for similar images by image or text query.
    """
    # TODO: Implement search logic
    return []

@router.get("/list", response_model=List[ImageUploadResponse])
def list_images():
    """
    List all indexed images (metadata only).
    """
    # TODO: Implement listing logic
    return []
