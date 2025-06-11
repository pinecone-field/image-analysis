import os
from dotenv import load_dotenv
import logging

load_dotenv()

# Configure logging globally for the backend
logging.basicConfig(level=logging.INFO)

# Model and API configuration
CLIP_MODEL_PATH = os.getenv("CLIP_MODEL_PATH", "openai/clip-vit-base-patch32")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_CLOUD = os.getenv("PINECONE_CLOUD", "aws")
PINECONE_REGION = os.getenv("PINECONE_REGION", "us-west-2")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "image-analysis-index")

# Debugging
DEBUG = os.getenv("DEBUG", False) == "true" 

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads/")