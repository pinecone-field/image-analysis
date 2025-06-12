import React, { useEffect, useState } from "react";
import axios from "axios";

const BACKEND_URL = "http://204.52.26.14:8000/";

const HomePage: React.FC = () => {
  const [backendUp, setBackendUp] = useState(true);

  useEffect(() => {
    let didCancel = false;
    const checkBackend = async () => {
      try {
        await axios.get(BACKEND_URL, { timeout: 2000 });
        if (!didCancel) setBackendUp(true);
      } catch {
        if (!didCancel) setBackendUp(false);
      }
    };
    checkBackend();
    return () => { didCancel = true; };
  }, []);

  return (
    <div style={{
      maxWidth: 700,
      margin: "4rem auto",
      padding: "3rem 2rem",
      background: "#fff",
      borderRadius: 24,
      boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      textAlign: "center"
    }}>
      {!backendUp && (
        <div style={{
          background: "#F4F6F8",
          color: "#1A2E35",
          padding: "1.5rem 0.5rem 1rem 0.5rem",
          borderRadius: 10,
          marginBottom: "2rem",
          fontWeight: 600,
          fontSize: "1.1rem"
        }}>
          <div style={{ marginBottom: "1rem" }}>
            Cannot connect to backend. Please make sure the backend server is running.
          </div>
          <a href="https://brev.nvidia.com/launchable/deploy?launchableID=env-2yN88KRm8sor8KxiikpG69ZEDLG" target="_blank" rel="noopener noreferrer">
            <img
              src="https://brev-assets.s3.us-west-1.amazonaws.com/nv-lb-dark.svg"
              alt="Click here to deploy."
              style={{ height: 48, margin: "0 auto" }}
            />
          </a>
        </div>
      )}
      <h1 style={{
        fontSize: "2.8rem",
        color: "#1A2E35",
        fontWeight: 800,
        marginBottom: "1.2rem",
        letterSpacing: "-1px"
      }}>
        Pinecone Image Analysis
      </h1>
      <p style={{
        fontSize: "1.25rem",
        color: "#1A2E35",
        marginBottom: "2.5rem",
        fontWeight: 400
      }}>
        Upload, analyze, and search images with object-level intelligence.
      </p>
      <div style={{
        background: "#F4F6F8",
        borderRadius: 16,
        padding: "1.5rem 1rem",
        marginBottom: "2.5rem",
        color: "#1A2E35",
        textAlign: "left"
      }}>
        <h3 style={{ color: "#0057FF", marginBottom: 12, fontWeight: 700 }}>How to Use:</h3>
        <ol style={{ marginLeft: 20, marginBottom: 0 }}>
          <li style={{ marginBottom: 12 }}>
            <b>Store:</b> Upload an image on the <a href="/store" style={{ color: "#0057FF" }}>Store</a> page to add it and its detected objects to the search database.
          </li>
          <li style={{ marginBottom: 8 }}>
            <b>Search:</b> Upload an image on the <a href="/search" style={{ color: "#0057FF" }}>Search</a> page. Detected objects will be highlighted. Click any object to search for similar objects/images.
          </li>
        </ol>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: "2rem" }}>
        <a href="/store" style={{ background: "#0057FF", color: "#fff", padding: "1rem 2.5rem", borderRadius: 8, fontWeight: 700, fontSize: "1.1rem", border: "none", textDecoration: "none" }}>Store</a>
        <a href="/search" style={{ background: "#F4F6F8", color: "#0057FF", padding: "1rem 2.5rem", borderRadius: 8, fontWeight: 700, fontSize: "1.1rem", border: "1px solid #E5E7EB", textDecoration: "none" }}>Search</a>
      </div>
    </div>
  );
};

export default HomePage; 