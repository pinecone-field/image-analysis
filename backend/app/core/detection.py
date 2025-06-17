from typing import List, Dict, Any
from PIL import Image
import io
import torch
from sam2.build_sam import build_sam2  # from pip package, not local
from sam2.sam2_image_predictor import SAM2ImagePredictor  # from pip package, not local
from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator  # Add this import
import numpy as np
import logging
import traceback
import cv2
from app.core.embeddings import extract_embeddings, get_clip_model

logger = logging.getLogger(__name__)

checkpoint = "app/checkpoints/sam2.1_hiera_large.pt"
model_cfg = "configs/sam2.1/sam2.1_hiera_l.yaml"

# Load SAM2 model and predictor once
def get_sam2_predictor():
    try:
        if not hasattr(get_sam2_predictor, "predictor"):
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
            logger.info(f"Loading SAM2 model for mask generator from {checkpoint} with config {model_cfg}")
            model = build_sam2(model_cfg, checkpoint)
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Using device for SAM2 mask generator: {device}")
            model = model.to(device)
            get_sam2_mask_generator.generator = SAM2AutomaticMaskGenerator(model)
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
        masks = generator.generate(np_img)
        # Candidate labels for semantic grouping
        candidate_labels = [
            "person", "pants", "jacket", "shirt", "shoes", "hat", "table", "background", "window", "door", "bag", "scarf", "hand", "face", "hair", "glasses", "building", "floor", "sidewalk", "object"
        ]
        # Precompute CLIP text embeddings for candidate labels
        model, processor, device = get_clip_model()
        with torch.no_grad():
            text_inputs = processor(text=candidate_labels, return_tensors="pt", padding=True).to(device)
            text_features = model.get_text_features(**text_inputs)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        regions = []
        for idx, mask_dict in enumerate(masks):
            mask = mask_dict["segmentation"]
            # Filter out small masks
            if np.sum(mask) < 500:  # skip tiny regions
                continue
            # Filter out masks that cover more than 60% of the image area
            if np.sum(mask) > 0.6 * mask.size:
                continue
            # Filter out masks with very high mean intensity (nearly blank/white regions)
            if np_img is not None and np.mean(np_img[mask > 0]) > 240:
                continue
            # Remove masks that are fully inside already used area (DISABLED: allow overlap)
            # if np.all(used[mask > 0]):
            #     continue
            # Mark this mask's area as used (DISABLED)
            # used[mask > 0] = True
            try:
                bbox = mask_to_bbox(mask)
            except ValueError as e:
                logger.warning(f"Skipping mask at idx {idx} due to shape error: {e}")
                continue
            # Morphological closing to smooth mask
            mask_uint8 = (mask * 255).astype(np.uint8)
            kernel = np.ones((3, 3), np.uint8)
            mask_closed = cv2.morphologyEx(mask_uint8, cv2.MORPH_CLOSE, kernel)
            # Find the largest contour (polygon) for the mask
            contours, _ = cv2.findContours(mask_closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                continue
            largest_contour = max(contours, key=cv2.contourArea)
            # Smooth the polygon using approxPolyDP (0.5% of perimeter for tighter fit)
            epsilon = 0.005 * cv2.arcLength(largest_contour, True)
            smoothed = cv2.approxPolyDP(largest_contour, epsilon, True)
            polygon = smoothed.squeeze().tolist()  # [[x1, y1], [x2, y2], ...]
            # Only include polygons with at least 3 points
            if not isinstance(polygon[0], list):  # If only one point
                continue
            if len(polygon) < 3:
                continue
            # Filter out polygons with extreme aspect ratios
            xs = [pt[0] for pt in polygon]
            ys = [pt[1] for pt in polygon]
            width = max(xs) - min(xs)
            height = max(ys) - min(ys)
            if height == 0 or width == 0:
                continue
            aspect = width / height
            if aspect > 8 or aspect < 0.125:
                continue
            tag = "region"
            # Crop region from image using mask and bbox
            bbox = mask_to_bbox(mask)
            x0, y0, x1, y1 = bbox
            region_img = Image.fromarray(np_img).crop((x0, y0, x1, y1))
            # Apply mask to region_img (set background to white)
            mask_crop = mask[y0:y1, x0:x1]
            region_img = region_img.convert("RGBA")
            arr = np.array(region_img)
            arr[..., 3] = (mask_crop * 255).astype(np.uint8)
            region_img = Image.fromarray(arr)
            buf = io.BytesIO()
            region_img.save(buf, format="PNG")
            region_bytes = buf.getvalue()
            # Get CLIP embedding for region
            region_emb = torch.tensor(extract_embeddings(region_bytes)).to(device)
            region_emb = region_emb / region_emb.norm()
            # Compute similarity to candidate labels
            sims = (text_features @ region_emb).cpu().numpy()
            best_idx = int(np.argmax(sims))
            best_label = candidate_labels[best_idx]
            # Add semantic_label to region
            region_dict = {
                "mask": mask,
                "bbox": bbox,
                "polygon": polygon,
                "tag": tag,
                "semantic_label": best_label
            }
            regions.append(region_dict)
        logger.info(f"SAM2 local: Detected {len(regions)} regions in image.")
        # --- Group small, similar, horizontally-aligned masks (for text/letters and over-segmented objects) ---
        small_regions = []
        large_regions = []
        for region in regions:
            area = np.sum(region["mask"])
            if area < 3000:
                small_regions.append(region)
            else:
                large_regions.append(region)
        merged = [False] * len(small_regions)
        merged_regions = []
        for i, reg1 in enumerate(small_regions):
            if merged[i]:
                continue
            group = [i]
            bbox1 = reg1["bbox"]
            mean1 = np.mean(np_img[reg1["mask"] > 0])
            for j, reg2 in enumerate(small_regions):
                if i == j or merged[j]:
                    continue
                bbox2 = reg2["bbox"]
                mean2 = np.mean(np_img[reg2["mask"] > 0])
                # Check horizontal proximity and color similarity
                if abs(bbox1[1] - bbox2[1]) < 30 and abs(bbox1[3] - bbox2[3]) < 30:  # vertical overlap
                    if abs(bbox1[0] - bbox2[2]) < 50 or abs(bbox1[2] - bbox2[0]) < 50:  # horizontal close
                        if abs(mean1 - mean2) < 30:
                            group.append(j)
                            merged[j] = True
            if len(group) > 1:
                # Merge masks
                merged_mask = np.zeros_like(small_regions[0]["mask"], dtype=bool)
                for idx in group:
                    merged_mask = np.logical_or(merged_mask, small_regions[idx]["mask"])
                # Extract new bbox and polygon
                try:
                    bbox = mask_to_bbox(merged_mask)
                except ValueError:
                    continue
                mask_uint8 = (merged_mask * 255).astype(np.uint8)
                kernel = np.ones((3, 3), np.uint8)
                mask_closed = cv2.morphologyEx(mask_uint8, cv2.MORPH_CLOSE, kernel)
                contours, _ = cv2.findContours(mask_closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                if not contours:
                    continue
                largest_contour = max(contours, key=cv2.contourArea)
                epsilon = 0.005 * cv2.arcLength(largest_contour, True)
                smoothed = cv2.approxPolyDP(largest_contour, epsilon, True)
                polygon = smoothed.squeeze().tolist()
                merged_regions.append({
                    "mask": merged_mask,
                    "bbox": bbox,
                    "polygon": polygon,
                    "tag": "region"
                })
                merged[i] = True
            else:
                merged_regions.append(reg1)
        # Combine large regions and merged small regions
        regions = large_regions + merged_regions
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
