import React, { useState, DragEvent } from 'react';
import api from '../api';

const ImageUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setMessage(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setMessage(null);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    setStatus('Uploading image...');
    const url = '/api/images/upload';
    console.log('[ImageUploader] POST', url, file);
    try {
      const formData = new FormData();
      formData.append('file', file);
      setStatus('Uploading image...');
      await new Promise((res) => setTimeout(res, 400));
      setStatus('Generating embeddings...');
      await new Promise((res) => setTimeout(res, 400));
      setStatus('Determining caption...');
      await new Promise((res) => setTimeout(res, 400));
      setStatus('Analyzing image for regions...');
      const response = await api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('[ImageUploader] Response:', response);
      setMessage('Upload successful!');
      setStatus('Done!');
    } catch (err: any) {
      console.error('[ImageUploader] Error:', err);
      setMessage('Upload failed.');
      setStatus('Error during upload.');
    } finally {
      setUploading(false);
      setTimeout(() => setStatus(null), 2000);
    }
  };

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          border: '2px dashed #aaa',
          borderRadius: 8,
          padding: 24,
          textAlign: 'center',
          marginBottom: 16,
          background: '#fafbfc',
        }}
      >
        {preview ? (
          <img src={preview} alt="preview" style={{ maxWidth: 200, maxHeight: 200, marginBottom: 8 }} />
        ) : (
          <span>Drag & drop an image here, or click to browse.</span>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleChange}
          style={{ display: 'none' }}
          id="image-upload-input"
        />
        <label htmlFor="image-upload-input" style={{ display: 'block', marginTop: 8, cursor: 'pointer', color: '#0070f3' }}>
          Browse
        </label>
      </div>
      {status && <div style={{ marginBottom: 8, color: '#555' }}>{status}</div>}
      <button onClick={handleUpload} disabled={!file || uploading} style={{ marginRight: 8 }}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
      {message && <div style={{ marginTop: 8 }}>{message}</div>}
    </div>
  );
};

export default ImageUploader;
