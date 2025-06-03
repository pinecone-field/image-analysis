FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

WORKDIR /app

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
