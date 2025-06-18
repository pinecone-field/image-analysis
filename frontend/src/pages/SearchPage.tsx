import React, { useState, useRef } from "react";
import axios from "axios";
import { queryVectors } from '../api';

interface DetectedObject {
  id: string;
  bbox: number[];
  tag?: string;
}

const SearchPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [status, setStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setImageUrl(URL.createObjectURL(e.target.files[0]));
      setObjects([]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setStatus("Generating embedding...");
    setSearchResults([]);
    const url = `${process.env.REACT_APP_BACKEND_API}/api/images/search`;
    try {
      // Step 1: Get embedding from backend
      const res = await axios.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const embedding = res.data.embedding;
      if (!embedding) {
        setStatus("No embedding returned from backend.");
        return;
      }
      setStatus("Searching Pinecone for similar images...");
      // Step 2: Query Pinecone
      const pineconeRes = await queryVectors(embedding, 12);
      setSearchResults(pineconeRes.matches || pineconeRes.results || []);
      setStatus("Search complete.");
    } catch (err) {
      console.error("[SearchPage] Error:", err);
      setStatus("Error processing image or searching.");
    }
  };

  const handleObjectClick = async (objectId: string) => {
    setStatus(`Searching for object ${objectId}...`);
    // Call backend to search by object
    // Display results (implement SearchResults component)
  };

  return (
    <div style={{
      maxWidth: 600,
      margin: "3rem auto",
      padding: "2rem",
      background: "#fff",
      borderRadius: 24,
      boxShadow: "0 4px 24px rgba(0,0,0,0.06)"
    }}>
      <h2 style={{ color: "#1A2E35", fontWeight: 800, marginBottom: "2rem" }}>Search by Image</h2>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: "#0057FF",
            color: "#fff",
            border: "none",
            padding: "0.75rem 1.5rem",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: "1.1rem",
            cursor: "pointer"
          }}
        >
          {file ? "Change File" : "Select Image"}
        </button>
        <span style={{ color: "#1A2E35", fontSize: "1rem" }}>
          {file ? file.name : "No file chosen"}
        </span>
      </div>
      <button
        onClick={handleUpload}
        style={{
          background: "#0057FF",
          color: "#fff",
          border: "none",
          padding: "0.9rem 2.2rem",
          borderRadius: 10,
          fontWeight: 800,
          fontSize: "1.2rem",
          cursor: "pointer",
          marginTop: "0.5rem",
          marginBottom: "1rem"
        }}
        disabled={!file}
      >
        Upload & Detect
      </button>
      <div style={{ marginTop: "1rem", color: status.includes("error") ? "#d9534f" : "#0057FF", fontWeight: 600 }}>{status}</div>
      {imageUrl && (
        <div style={{ marginTop: "2rem" }}>
          <img src={imageUrl} alt="Uploaded" style={{ maxWidth: 400, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }} />
          <div style={{ marginTop: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {objects.map((obj, idx) => (
              <button
                key={obj.id || idx}
                onClick={() => handleObjectClick(obj.id)}
                style={{
                  background: "#F4F6F8",
                  color: "#0057FF",
                  border: "1px solid #E5E7EB",
                  padding: "0.5rem 1rem",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: "1rem",
                  cursor: "pointer"
                }}
              >
                Object {idx + 1}
              </button>
            ))}
          </div>
        </div>
      )}
      {searchResults.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ color: "#0057FF", fontWeight: 700 }}>Search Results</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 12 }}>
            {searchResults.map((result, idx) => (
              <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 8, background: "#fafbfc" }}>
                <div>Score: {result.score?.toFixed(3)}</div>
                <div>Id: {result.id}</div>
                {result.metadata?.image_path && (
                  <img src={`/images/${result.metadata.image_path.split('/').pop()}`} alt="Result" style={{ maxWidth: 120, borderRadius: 8, marginTop: 4 }} />
                )}
                {result.metadata?.caption && (
                  <div style={{ fontSize: 13, color: "#0057FF", marginTop: 4 }}>{result.metadata.caption}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPage; 