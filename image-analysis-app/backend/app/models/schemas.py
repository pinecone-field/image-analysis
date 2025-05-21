from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class ImageEmbeddingMetadata(BaseModel):
    """
    Metadata for an image or region embedding stored in Pinecone.
    """
    image_id: str
    caption: str
    upload_time: datetime
    object_tags: List[str] = []
    region: Optional[Dict[str, Any]] = None  # e.g., bounding box or mask
    exif: Optional[Dict[str, Any]] = None

class ImageUploadResponse(BaseModel):
    image_id: str
    caption: str
    object_tags: List[str]
    upload_time: datetime

class SearchResult(BaseModel):
    image_id: str
    score: float
    caption: str
    object_tags: List[str]
    region: Optional[Dict[str, Any]] = None
