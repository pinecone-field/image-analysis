import axios from 'axios';
// @ts-ignore: If you see a type error here, install @pinecone-database/pinecone
import { Pinecone } from '@pinecone-database/pinecone';

const baseURL = process.env.REACT_APP_BACKEND_API || '/';
console.log('[API] Using backend baseURL:', baseURL);

const api = axios.create({
  baseURL,
});

// If you see a type error for the Pinecone import, ensure you have installed @pinecone-database/pinecone and its types.
// npm install @pinecone-database/pinecone
// npm install --save-dev @types/pinecone-database__pinecone (if available)
// If using Vite, add a declaration for import.meta.env in src/vite-env.d.ts:
// interface ImportMetaEnv {
//   VITE_PINECONE_API_KEY: string;
//   VITE_PINECONE_INDEX: string;
// }
// interface ImportMeta {
//   readonly env: ImportMetaEnv;
// }

const PINECONE_API_KEY = (import.meta as any).env?.VITE_PINECONE_API_KEY || process.env.REACT_APP_PINECONE_API_KEY;
const PINECONE_INDEX = (import.meta as any).env?.VITE_PINECONE_INDEX || process.env.REACT_APP_PINECONE_INDEX;

let pineconeClient: Pinecone | null = null;

export function getPineconeClient() {
  if (!pineconeClient) {
    if (!PINECONE_API_KEY) throw new Error('Pinecone API key not set');
    pineconeClient = new Pinecone({ apiKey: PINECONE_API_KEY });
  }
  return pineconeClient;
}

export async function upsertVectors(vectors: any[], namespace?: string) {
  const client = getPineconeClient();
  const index = client.Index(PINECONE_INDEX);
  return await index.upsert({ vectors, namespace });
}

export async function queryVectors(queryVector: number[], topK = 10, namespace?: string) {
  const client = getPineconeClient();
  const index = client.Index(PINECONE_INDEX);
  return await index.query({ vector: queryVector, topK, includeMetadata: true, namespace });
}

export default api;
