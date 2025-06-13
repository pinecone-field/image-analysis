from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import images, objects
from app.core.config import DEBUG

app = FastAPI(title="Pinecone Image Analysis & Search", debug=DEBUG)

# Allow frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(images.router, prefix="/images", tags=["images"])
app.include_router(objects.router, prefix="/objects", tags=["objects"])
