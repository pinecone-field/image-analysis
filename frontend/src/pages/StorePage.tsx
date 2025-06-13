import React, { useState, useRef } from "react";
import axios from "axios";

const StorePage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
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
    </div>
  );
};

export default StorePage; 