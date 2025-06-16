import React, { useState, useRef } from "react";
import axios from "axios";

interface Region {
  tag: string;
  bbox: number[];
  mask_png_b64: string;
}

const StorePage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setImageUrl(URL.createObjectURL(e.target.files[0]));
      setRegions([]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setStatus("Uploading...");
    setErrorDetails("");
    const url = `${process.env.REACT_APP_BACKEND_API}/images/upload`;
    console.log("[StorePage] POST", url, formData);
    try {
      const response = await axios.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("[StorePage] Response:", response);
      setStatus("Stored successfully!");
      setRegions(response.data.regions || []);
    } catch (err: any) {
      let details = "";
      if (err.response) {
        details = `Status: ${err.response.status}\nMessage: ${err.response.statusText}`;
        if (err.response.data) {
          details += `\nResponse: ${JSON.stringify(err.response.data)}`;
        }
      } else if (err.request) {
        details = "No response received from backend.";
      } else {
        details = err.message;
      }
      setStatus("Error storing image.");
      setErrorDetails(details);
      console.error("[StorePage] Error:", err, details);
    }
  };

  // Helper to get image display size
  const [imgDims, setImgDims] = useState<{width: number, height: number}>({width: 1, height: 1});
  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImgDims({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
  };

  return (
    <div style={{
      maxWidth: 500,
      margin: "3rem auto",
      padding: "2rem",
      background: "#fff",
      borderRadius: 24,
      boxShadow: "0 4px 24px rgba(0,0,0,0.06)"
    }}>
      <h2 style={{ color: "#1A2E35", fontWeight: 800, marginBottom: "2rem" }}>Store Image</h2>
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
        Upload & Store
      </button>
      <div style={{ marginTop: "1rem", color: status.includes("success") ? "#0057FF" : "#d9534f", fontWeight: 600 }}>{status}</div>
      {errorDetails && (
        <pre style={{ color: '#d9534f', background: '#fff0f0', padding: 10, borderRadius: 8, marginTop: 8 }}>{errorDetails}</pre>
      )}
      {/* Image and bounding boxes visualization */}
      {imageUrl && regions.length > 0 && (
        <div style={{ position: "relative", marginTop: 24, textAlign: "center" }}>
          <img
            src={imageUrl}
            alt="Uploaded"
            style={{ maxWidth: 400, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
            onLoad={handleImgLoad}
          />
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              pointerEvents: "none",
              width: imgDims.width > 0 ? Math.min(400, imgDims.width) : 400,
              height: imgDims.height > 0 ? (imgDims.width > 0 ? Math.min(400, imgDims.width) * imgDims.height / imgDims.width : 400) : 400,
              zIndex: 2
            }}
            viewBox={`0 0 ${imgDims.width} ${imgDims.height}`}
          >
            {regions.map((region, idx) => (
              <rect
                key={idx}
                x={region.bbox[0]}
                y={region.bbox[1]}
                width={region.bbox[2] - region.bbox[0]}
                height={region.bbox[3] - region.bbox[1]}
                fill={hoveredIdx === idx ? "rgba(0,87,255,0.2)" : "rgba(0,87,255,0.08)"}
                stroke="#0057FF"
                strokeWidth={hoveredIdx === idx ? 3 : 2}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ pointerEvents: "all", cursor: "pointer" }}
              />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
};

export default StorePage; 