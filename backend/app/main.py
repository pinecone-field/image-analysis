from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes import images, objects
from app.core.config import DEBUG
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(title="Pinecone Image Analysis & Search", debug=DEBUG)

# Allow frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve images directory as static files (correct path)
app.mount("/images", StaticFiles(directory=os.path.abspath(os.path.join(os.path.dirname(__file__), "../images"))), name="images")

app.include_router(images.router, prefix="/api/images", tags=["images"])
app.include_router(objects.router, prefix="/api/objects", tags=["objects"])

@app.get("/", tags=["health"])
def health_check():
    return JSONResponse(content={"status": "ok"})
