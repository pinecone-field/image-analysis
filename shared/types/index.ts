/**
 * Metadata for an image or region embedding stored in Pinecone.
 */
export interface ImageEmbeddingMetadata {
  image_id: string;
  caption: string;
  upload_time: string;
  object_tags: string[];
  region?: Record<string, any>;
  exif?: Record<string, any>;
}

/**
 * Response after uploading an image.
 */
export interface ImageUploadResponse {
  image_id: string;
  caption: string;
  object_tags: string[];
  upload_time: string;
}

/**
 * Search result for image or object queries.
 */
export interface SearchResult {
  image_id: string;
  score: number;
  caption: string;
  object_tags: string[];
  region?: Record<string, any>;
}
