FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

WORKDIR /app

RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 libsm6 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN apt-get update && \
    apt-get install -y curl git python3 python3-pip && \
    python3 -m pip install --upgrade pip && \
    python3 -m pip install -r requirements.txt

COPY download_ckpts.sh ./
RUN ./download_ckpts.sh

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
