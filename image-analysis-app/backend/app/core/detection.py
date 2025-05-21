from typing import List, Dict, Any

def detect_objects(image_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Detect objects in the image and return a list of dicts with bounding boxes and tags.
    """
    # TODO: Implement with YOLOv8
    return [
        {"bbox": [0, 0, 100, 100], "tag": "stub_object"}
    ]
