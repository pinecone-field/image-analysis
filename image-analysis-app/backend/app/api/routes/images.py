from fastapi import APIRouter, UploadFile, File, Form
from typing import List
from app.models.schemas import ImageUploadResponse, SearchResult

router = APIRouter()

@router.post("/upload", response_model=ImageUploadResponse)
def upload_image(file: UploadFile = File(...)):
    """
    Upload an image, generate embedding/caption, and index in Pinecone.
    """
    # TODO: Implement image ingestion, embedding, and indexing
    return ImageUploadResponse(
        image_id="stub",
        caption="A stub caption.",
        object_tags=["stub"],
        upload_time=None
    )

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
