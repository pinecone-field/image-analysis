from typing import List
from PIL import Image
import io
import numpy as np
import torch
from transformers import CLIPProcessor, CLIPModel, BlipProcessor, BlipForConditionalGeneration
import logging
import traceback

logger = logging.getLogger(__name__)

# Load CLIP model and processor once
def get_clip_model():
    try:
        if not hasattr(get_clip_model, "model"):
            model_id = "openai/clip-vit-base-patch32"
            logger.info(f"Loading CLIP model: {model_id}")
            get_clip_model.model = CLIPModel.from_pretrained(model_id)
            get_clip_model.processor = CLIPProcessor.from_pretrained(model_id)
            get_clip_model.device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Using device: {get_clip_model.device}")
            get_clip_model.model.to(get_clip_model.device)
        return get_clip_model.model, get_clip_model.processor, get_clip_model.device
    except Exception as e:
        logger.error(f"Error loading CLIP model: {e}")
        raise

def extract_embeddings(image_bytes: bytes) -> List[float]:
    """
    Generate CLIP embeddings for the given image bytes using HuggingFace Transformers.
    Returns a list of floats.
    """
    try:
        model, processor, device = get_clip_model()
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert('RGB')
        inputs = processor(images=img, return_tensors="pt").to(device)
        with torch.no_grad():
            image_features = model.get_image_features(**inputs)
        # Normalize to unit vector (optional, but common for CLIP)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        logger.info("Extracted embedding of shape: %s", image_features.shape)
        return image_features[0].cpu().tolist()
    except Exception as e:
        logger.error(f"Error extracting embeddings: {e}")
        logger.error(traceback.format_exc())
        raise

def generate_caption(image_bytes: bytes) -> str:
    """
    Generate a caption for the given image bytes using BLIP (runs locally).
    """
    try:
        if not hasattr(generate_caption, "model"):
            logger.info("Loading BLIP model and processor for image captioning...")
            generate_caption.processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
            generate_caption.model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
            generate_caption.device = "cuda" if torch.cuda.is_available() else "cpu"
            generate_caption.model.to(generate_caption.device)
        processor = generate_caption.processor
        model = generate_caption.model
        device = generate_caption.device
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
        inputs = processor(img, return_tensors="pt").to(device)
        with torch.no_grad():
            out = model.generate(**inputs)
            caption = processor.decode(out[0], skip_special_tokens=True)
        logger.info(f"Generated caption: {caption}")
        return caption
    except Exception as e:
        logger.error(f"Error generating caption: {e}")
        logger.error(traceback.format_exc())
        return "A descriptive image."  # fallback caption
