import axios from 'axios';

const baseURL = process.env.REACT_APP_BACKEND_API || '/';
console.log('[API] Using backend baseURL:', baseURL);

const api = axios.create({
  baseURL,
});

const PINECONE_MIDDLEWARE_URL = (import.meta as any).env?.VITE_PINECONE_MIDDLEWARE_URL || process.env.REACT_APP_PINECONE_MIDDLEWARE_URL || 'http://localhost:4000';

export async function upsertVectors(vectors: any[]) {
  const url = `${PINECONE_MIDDLEWARE_URL}/pinecone/upsert`;
  const res = await axios.post(url, { vectors });
  return res.data;
}

export async function queryVectors(queryVector: number[], topK = 10) {
  const url = `${PINECONE_MIDDLEWARE_URL}/pinecone/query`;
  const res = await axios.post(url, { vector: queryVector, topK });
  return res.data;
}

export async function fetchVector(id: string) {
  const url = `${PINECONE_MIDDLEWARE_URL}/pinecone/fetch`;
  const res = await axios.get(url, { params: { id } });
  return res.data;
}

export default api;
