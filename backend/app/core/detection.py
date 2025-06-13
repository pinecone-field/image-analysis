from typing import List, Dict, Any
from PIL import Image
import io
import torch
from sam2.build_sam import build_sam2  # from pip package, not local
from sam2.sam2_image_predictor import SAM2ImagePredictor  # from pip package, not local
import numpy as np
import logging
import traceback

logger = logging.getLogger(__name__)

# Load SAM2 model and predictor once
def get_sam2_predictor():
    try:
        if not hasattr(get_sam2_predictor, "predictor"):
            checkpoint = "./checkpoints/sam2.1_hiera_large.pt"  # Update path as needed
            model_cfg = "configs/sam2.1/sam2.1_hiera_l.yaml"    # Update path as needed
            logger.info(f"Loading SAM2 model from {checkpoint} with config {model_cfg}")
            model = build_sam2(model_cfg, checkpoint)
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Using device for SAM2: {device}")
            model = model.to(device)
            get_sam2_predictor.predictor = SAM2ImagePredictor(model)
        return get_sam2_predictor.predictor
    except Exception as e:
        logger.error(f"Error loading SAM2 model: {e}")
        logger.error(traceback.format_exc())
        raise

def detect_objects(image_bytes: bytes) -> List[Dict[str, Any]]:
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            np_img = np.array(img)
        predictor = get_sam2_predictor()
        predictor.set_image(np_img)
        results = predictor.predict()
        regions = []
        for idx, mask in enumerate(results):
            bbox = None  # or compute from mask if needed
            tag = "region"
            regions.append({
                "mask": mask,
                "bbox": bbox,
                "tag": tag
            })
        logger.info(f"SAM2 local: Detected {len(regions)} regions in image.")
        return regions
    except Exception as e:
        logger.error(f"Error during SAM2 local object detection: {e}")
        logger.error(traceback.format_exc())
        raise

def crop_region(image_bytes: bytes, bbox: list) -> bytes:
    """
    Crop a region from the image using the bounding box [x_min, y_min, x_max, y_max].
    Returns the cropped region as image bytes (PNG format).
    """
    with Image.open(io.BytesIO(image_bytes)) as img:
        region = img.crop((bbox[0], bbox[1], bbox[2], bbox[3]))
        buf = io.BytesIO()
        region.save(buf, format="PNG")
        return buf.getvalue()

def crop_region_with_mask(image_bytes: bytes, mask: np.ndarray, bbox: list) -> bytes:
    """
    Crop a region from the image using a segmentation mask and bounding box.
    Returns the cropped region as image bytes (PNG format), with background transparent.
    """
    with Image.open(io.BytesIO(image_bytes)) as img:
        img = img.convert("RGBA")
        # Crop to bounding box for efficiency
        region = img.crop((bbox[0], bbox[1], bbox[2], bbox[3]))
        # Crop the mask to the same bbox
        mask_cropped = mask[bbox[1]:bbox[3], bbox[0]:bbox[2]]
        # Create an alpha channel from the mask
        alpha = Image.fromarray((mask_cropped * 255).astype(np.uint8))
        # Apply the mask as the alpha channel
        region.putalpha(alpha)
        buf = io.BytesIO()
        region.save(buf, format="PNG")
        return buf.getvalue()
