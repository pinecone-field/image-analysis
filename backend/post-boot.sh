#!/usr/bin/env bash

if [[ "$DEBUG" == "true" ]]; then
    set -x
fi

if [[ $(pwd) != *"backend"* ]]; then
    cd backend || { echo "Error: Could not cd to backend directory, are you in the correct directory?"; exit 1; }
fi


if [[ -z "$PINECONE_API_KEY" ]]; then
    echo -n "Please enter your Pinecone API key: "
    read PINECONE_API_KEY
fi
export PINECONE_API_KEY=$PINECONE_API_KEY

echo "Creating virtual environment..."
if [[ ! -d ".venv" ]]; then 
    python3 -m venv .venv 
fi
source .venv/bin/activate && pip install -U pip && pip install -r requirements.txt

echo "Installing checkpoints..."
CHECKPOINT_DIR="app/checkpoints"
if [ -z "$(ls -A "$CHECKPOINT_DIR")" ]; then
  echo "Checkpoints not found, downloading..."
  ./download_ckpts.sh
else
  echo "Checkpoints already present, skipping download."
fi

echo "Starting backend server..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
