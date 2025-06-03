from fastapi import APIRouter, UploadFile, File, Form
from typing import List
from app.models.schemas import SearchResult

router = APIRouter()

@router.post("/search", response_model=List[SearchResult])
def search_objects(file: UploadFile = File(None), query: str = Form(None)):
    """
    Search for similar objects/regions by image crop or text query.
    """
    # TODO: Implement object-level search logic
    return []
