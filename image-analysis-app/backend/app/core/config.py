import os
from dotenv import load_dotenv

load_dotenv()

# Model and API configuration
CLIP_MODEL_PATH = os.getenv("CLIP_MODEL_PATH", "jina-clip-v2")
YOLO_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_ENV = os.getenv("PINECONE_ENV", "us-west1-gcp")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "image-analysis-index")

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads/")
