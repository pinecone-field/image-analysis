from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uuid
import base64
from queue import Queue
from threading import Thread
import time

app = FastAPI()

# In-memory job queue and result store
job_queue = Queue()
results = {}

class SegmentRequest(BaseModel):
    image_b64: str

@app.post("/segment")
def segment(request: SegmentRequest):
    message_id = str(uuid.uuid4())
    job_queue.put((message_id, request.image_b64))
    results[message_id] = {"status": "processing"}
    return {"message_id": message_id}

@app.get("/result/{message_id}")
def get_result(message_id: str):
    if message_id not in results:
        raise HTTPException(status_code=404, detail="Job not found")
    return results[message_id]

# Worker thread to process jobs
def worker():
    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor
    import numpy as np
    from PIL import Image
    import io

    # Load model once
    checkpoint = "./checkpoints/sam2.1_hiera_large.pt"
    model_cfg = "configs/sam2.1/sam2.1_hiera_l.yaml"
    model = build_sam2(model_cfg, checkpoint)
    predictor = SAM2ImagePredictor(model)

    while True:
        message_id, image_b64 = job_queue.get()
        try:
            image_bytes = base64.b64decode(image_b64)
            with Image.open(io.BytesIO(image_bytes)) as img:
                img = img.convert("RGB")
                img_np = np.array(img)
            predictor.set_image(img_np)
            masks, _, _ = predictor.predict([])
            regions = []
            for mask in masks:
                mask_arr = mask["segmentation"]
                y_indices, x_indices = np.where(mask_arr)
                if len(x_indices) == 0 or len(y_indices) == 0:
                    continue
                x_min, x_max = int(x_indices.min()), int(x_indices.max())
                y_min, y_max = int(y_indices.min()), int(y_indices.max())
                bbox = [x_min, y_min, x_max, y_max]
                # Optionally encode mask as base64 PNG
                regions.append({
                    "bbox": bbox,
                    # "mask": ... # encode as needed
                })
            results[message_id] = {"status": "done", "regions": regions}
        except Exception as e:
            results[message_id] = {"status": "error", "error": str(e)}
        job_queue.task_done()

# Start worker thread
Thread(target=worker, daemon=True).start()
