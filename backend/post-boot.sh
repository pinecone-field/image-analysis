#!/usr/bin/env bash

set -x

cd backend

python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

if [[ -z "$PINECONE_API_KEY" ]]; then
    echo -n "Please enter your Pinecone API key: "
    read PINECONE_API_KEY
fi

export PINECONE_API_KEY=$PINECONE_API_KEY

echo "Downloading checkpoints..."
./download_ckpts.sh

echo "Starting backend server..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
