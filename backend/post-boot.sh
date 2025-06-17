#!/usr/bin/env bash

cd backend

alias python=python3
alias pip=pip3

python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

echo -n "Please enter your Pinecone API key: "
read PINECONE_API_KEY

export PINECONE_API_KEY=$PINECONE_API_KEY

echo "Downloading checkpoints..."
./download_ckpts.sh

echo "Starting backend server..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
