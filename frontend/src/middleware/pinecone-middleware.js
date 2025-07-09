const express = require('express');
const cors = require('cors');
const { Pinecone } = require('@pinecone-database/pinecone');

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX;
const PINECONE_DIMENSION = parseInt(process.env.PINECONE_DIMENSION || '512', 10); // Default to 512
const PINECONE_METRIC = process.env.PINECONE_METRIC || 'cosine';

if (!PINECONE_API_KEY || !PINECONE_INDEX) {
  console.error('Missing Pinecone API key or index name in environment variables.');
  process.exit(1);
}

const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

async function ensureIndex() {
  const indexes = await pinecone.listIndexes();
  const exists = indexes.indexes.some(idx => idx.name === PINECONE_INDEX);
  if (!exists) {
    console.log(`[Pinecone] Index '${PINECONE_INDEX}' not found. Creating...`);
    await pinecone.createIndex({
      name: PINECONE_INDEX,
      dimension: PINECONE_DIMENSION,
      metric: PINECONE_METRIC,
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      },
      deletionProtection: 'disabled',
    });
    console.log(`[Pinecone] Index '${PINECONE_INDEX}' created.`);
  } else {
    console.log(`[Pinecone] Index '${PINECONE_INDEX}' exists.`);
  }
}

function sanitizeMetadata(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      // Pinecone only allows list of strings, so convert arrays to JSON string
      out[key] = JSON.stringify(value);
    } else if (typeof value === 'object' && value !== null) {
      out[key] = JSON.stringify(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

app.post('/pinecone/upsert', async (req, res) => {
  try {
    const vectors = req.body.vectors;
    if (!Array.isArray(vectors)) {
      return res.status(400).json({ error: 'vectors must be an array' });
    }
    // Sanitize metadata for each vector
    const sanitizedVectors = vectors.map(v => ({
      ...v,
      metadata: sanitizeMetadata(v.metadata)
    }));
    const index = pinecone.Index(PINECONE_INDEX);
    await index.upsert(sanitizedVectors);
    res.json({ success: true });
  } catch (err) {
    console.error('[Pinecone Upsert Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/pinecone/query', async (req, res) => {
  try {
    const { vector, topK = 10 } = req.body;
    if (!Array.isArray(vector)) {
      return res.status(400).json({ error: 'vector must be an array' });
    }
    const index = pinecone.Index(PINECONE_INDEX);
    const results = await index.query({ vector, topK, includeMetadata: true });
    res.json(results);
  } catch (err) {
    console.error('[Pinecone Query Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/pinecone/fetch', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }
    const index = pinecone.Index(PINECONE_INDEX);
    const result = await index.fetch([id]);
    res.json(result);
  } catch (err) {
    console.error('[Pinecone Fetch Error]', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PINECONE_MIDDLEWARE_PORT || 4000;

ensureIndex().then(() => {
  app.listen(PORT, () => console.log(`Pinecone middleware running on port ${PORT}`));
}).catch(err => {
  console.error('[Pinecone Startup Error]', err);
  process.exit(1);
}); 