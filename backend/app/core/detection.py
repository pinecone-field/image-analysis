from typing import List, Dict, Any
from PIL import Image
import io
import torch
from sam2.build_sam import build_sam2  # from pip package, not local
from sam2.sam2_image_predictor import SAM2ImagePredictor  # from pip package, not local
from sam2.automatic_mask_generator import AutomaticMaskGenerator  # Add this import
import numpy as np
import logging
import traceback

logger = logging.getLogger(__name__)

# Load SAM2 model and predictor once
def get_sam2_predictor():
    try:
        if not hasattr(get_sam2_predictor, "predictor"):
            checkpoint = "/app/backend/checkpoints/sam2.1_hiera_large.pt"  # Update path as needed
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

def get_sam2_mask_generator():
    try:
        if not hasattr(get_sam2_mask_generator, "generator"):
            checkpoint = "/app/backend/checkpoints/sam2.1_hiera_large.pt"  # Update path as needed
            model_cfg = "configs/sam2.1/sam2.1_hiera_l.yaml"    # Update path as needed
            logger.info(f"Loading SAM2 model for mask generator from {checkpoint} with config {model_cfg}")
            model = build_sam2(model_cfg, checkpoint)
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Using device for SAM2 mask generator: {device}")
            model = model.to(device)
            get_sam2_mask_generator.generator = AutomaticMaskGenerator(model)
        return get_sam2_mask_generator.generator
    except Exception as e:
        logger.error(f"Error loading SAM2 mask generator: {e}")
        logger.error(traceback.format_exc())
        raise

def detect_objects(image_bytes: bytes) -> List[Dict[str, Any]]:
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            np_img = np.array(img)
        generator = get_sam2_mask_generator()
        # Use AutomaticMaskGenerator with lower thresholds to get more regions
        masks = generator.generate(
            np_img,
            pred_iou_thresh=0.5,  # Lower to get more regions
            stability_score_thresh=0.7  # Lower to get more regions
        )
        regions = []
        for idx, mask_dict in enumerate(masks):
            mask = mask_dict["segmentation"]
            try:
                bbox = mask_to_bbox(mask)
            except ValueError as e:
                logger.warning(f"Skipping mask at idx {idx} due to shape error: {e}")
                continue
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

def ensure_2d_mask(mask: np.ndarray) -> np.ndarray:
    # Squeeze all singleton dimensions
    mask = np.squeeze(mask)
    if mask.ndim == 3:
        # If still 3D, try to reduce (e.g., (3, H, W) -> (H, W))
        if mask.shape[0] == 1 or mask.shape[0] == 3:
            mask = np.any(mask, axis=0)
        elif mask.shape[2] == 1:
            mask = mask.squeeze(axis=2)
        else:
            raise ValueError(f"Unexpected 3D mask shape after squeeze: {mask.shape}")
    if mask.ndim != 2:
        raise ValueError(f"Expected 2D mask, got shape {mask.shape}")
    return mask

def crop_region_with_mask(image_bytes: bytes, mask: np.ndarray, bbox: list) -> bytes:
    """
    Crop a region from the image using a segmentation mask and bounding box.
    Returns the cropped region as image bytes (PNG format), with background transparent.
    """
    from PIL import Image as PILImage
    with Image.open(io.BytesIO(image_bytes)) as img:
        img = img.convert("RGBA")
        # Clamp bbox to image/mask bounds
        x0, y0, x1, y1 = bbox
        width, height = img.size
        x0 = max(0, min(x0, width - 1))
        y0 = max(0, min(y0, height - 1))
        x1 = max(x0 + 1, min(x1, width))
        y1 = max(y0 + 1, min(y1, height))
        region = img.crop((x0, y0, x1, y1))
        mask_h, mask_w = mask.shape[:2]
        x0m = max(0, min(x0, mask_w - 1))
        y0m = max(0, min(y0, mask_h - 1))
        x1m = max(x0m + 1, min(x1, mask_w))
        y1m = max(y0m + 1, min(y1, mask_h))
        mask_cropped = mask[y0m:y1m, x0m:x1m]
        try:
            mask_cropped = ensure_2d_mask(mask_cropped)
        except ValueError as e:
            logger.warning(f"Skipping region due to mask error: {e}")
            return None
        # Resize mask_cropped to match region size
        region_w, region_h = region.size
        if mask_cropped.shape != (region_h, region_w):
            mask_img = PILImage.fromarray((mask_cropped * 255).astype(np.uint8))
            mask_img = mask_img.resize((region_w, region_h), resample=PILImage.NEAREST)
            mask_cropped = np.array(mask_img) / 255.0
        alpha = Image.fromarray((mask_cropped * 255).astype(np.uint8))
        if region.size != alpha.size:
            logger.warning(f"Skipping region due to size mismatch: region.size={region.size}, alpha.size={alpha.size}")
            return None
        region.putalpha(alpha)
        buf = io.BytesIO()
        region.save(buf, format="PNG")
        return buf.getvalue()

def mask_to_bbox(mask: np.ndarray):
    """Compute the bounding box [x_min, y_min, x_max, y_max] from a binary mask."""
    logger.debug(f"Original mask shape: {mask.shape}")

    mask = ensure_2d_mask(mask)

    ys, xs = np.where(mask)
    if len(xs) == 0 or len(ys) == 0:
        return [0, 0, 0, 0]  # or handle as empty
    x_min, x_max = xs.min(), xs.max()
    y_min, y_max = ys.min(), ys.max()
    return [x_min, y_min, x_max, y_max]
