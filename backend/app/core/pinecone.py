from typing import Iterable, List, Dict, Any
from . import config
from pinecone.grpc import PineconeGRPC as Pinecone
from pinecone import ServerlessSpec
import itertools
import logging
import traceback

# Initialize Pinecone client and index
_pinecone_index = None
logger = logging.getLogger(__name__)

def get_pinecone_index():
    try:
        global _pinecone_index
        if _pinecone_index is None:
            logger.info("Initializing Pinecone client and index...")
            pc = Pinecone(api_key=config.PINECONE_API_KEY)
            if config.PINECONE_INDEX not in [idx["name"] for idx in pc.list_indexes()]:
                logger.info(f"Creating Pinecone index: {config.PINECONE_INDEX}")
                spec = ServerlessSpec(
                    cloud=config.PINECONE_CLOUD or "aws",
                    region=config.PINECONE_REGION or "us-east-1",
                )
                pc.create_index(
                    config.PINECONE_INDEX,
                    dimension=512,
                    metric="cosine",
                    spec=spec
                )
            _pinecone_index = pc.Index(config.PINECONE_INDEX)
        return _pinecone_index
    except Exception as e:
        logger.error(f"Error initializing Pinecone index: {e}")
        logger.error(traceback.format_exc())
        raise

def chunker(seq, batch_size=100):
    """Yield successive batch_size-sized chunks from seq."""
    for pos in range(0, len(seq), batch_size):
        yield seq[pos:pos + batch_size]

def index_embedding(embedding: List[float], metadata: Dict[str, Any], vector_id: str):
    """
    Index an embedding and its metadata in Pinecone.

    This function is a wrapper around index_embeddings that takes a single embedding, id, and metadata and indexes it in Pinecone.
    """
    return index_embeddings([embedding], [vector_id], [metadata])

def index_embeddings(
    embeddings: List[List[float]],
    ids: List[str],
    metadatas: List[Dict[str, Any]],
    batch_size: int = 100
):
    """
    Batch upsert embeddings, ids, and metadata to Pinecone.
    """
    try:
        index = get_pinecone_index()
        vectors = [
            {"id": id_, "values": emb, "metadata": meta}
            for id_, emb, meta in zip(ids, embeddings, metadatas)
        ]
        for batch in chunker(vectors, batch_size):
            logger.info(f"Upserting batch of {len(batch)} vectors to Pinecone.")
            index.upsert(vectors=batch)
    except Exception as e:
        logger.error(f"Error during Pinecone upsert: {e}")
        logger.error(traceback.format_exc())
        raise

def search_index(query_embedding: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Search Pinecone for similar embeddings.
    """
    try:
        index = get_pinecone_index()
        logger.info(f"Searching Pinecone index for top_k={top_k}")
        results = index.query(vector=query_embedding, top_k=top_k, include_metadata=True)
        logger.info(f"Pinecone search returned {len(results['matches'])} matches.")
        return results["matches"]
    except Exception as e:
        logger.error(f"Error during Pinecone search: {e}")
        logger.error(traceback.format_exc())
        raise
