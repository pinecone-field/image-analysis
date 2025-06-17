import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

interface Region {
  tag: string;
  bbox: number[];
  mask_png_b64: string;
  polygon?: number[][];
  semantic_label?: string;
}

const StorePage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("all");
  const uniqueLabels = Array.from(new Set(regions.map(r => r.semantic_label).filter(Boolean)));

  // Similarity search state
  const [searchingIdx, setSearchingIdx] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const handleRegionClick = async (region: Region, idx: number) => {
    setSearchingIdx(idx);
    setStatus("Searching for similar regions...");
    setErrorDetails("");
    setSearchResults([]);
    try {
      const url = `${process.env.REACT_APP_BACKEND_API}/api/images/search`;
      const response = await axios.post(url, {
        mask_png_b64: region.mask_png_b64,
        bbox: region.bbox,
      });
      setStatus("Similarity search complete!");
      setSearchResults(response.data || []);
      console.log("[Similarity Search] Results:", response.data);
    } catch (err: any) {
      setStatus("Error during similarity search.");
      setErrorDetails(err.message);
      setSearchResults([]);
      console.error("[Similarity Search] Error:", err);
    } finally {
      setSearchingIdx(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setImageUrl(URL.createObjectURL(e.target.files[0]));
      setRegions([]);
    }
  };

  const [duplicateInfo, setDuplicateInfo] = useState<{message: string, similar_images: string[]} | null>(null);
  const [duplicateMetas, setDuplicateMetas] = useState<any[]>([]);
  const [justUploaded, setJustUploaded] = useState<string>("");

  // Fetch metadata for similar images when duplicateInfo changes
  useEffect(() => {
    const fetchMetas = async () => {
      if (duplicateInfo && duplicateInfo.similar_images.length > 0) {
        const base = process.env.REACT_APP_BACKEND_API?.replace(/\/$/, "") || "";
        const metas = await Promise.all(
          duplicateInfo.similar_images.map(async (imgPath) => {
            try {
              const id = imgPath;
              const res = await axios.get(`${base}/api/images/meta`, { params: { id } });
              return res.data;
            } catch {
              return { id: imgPath };
            }
          })
        );
        setDuplicateMetas(metas);
      } else {
        setDuplicateMetas([]);
      }
    };
    fetchMetas();
  }, [duplicateInfo]);

  // Set justUploaded image when upload is successful
  useEffect(() => {
    if (imageUrl && typeof status === 'string' && status.includes("success")) {
      setJustUploaded(imageUrl);
    }
  }, [imageUrl, status]);

  const handleUpload = async () => {
    if (!file) return;
    setDuplicateInfo(null);
    const formData = new FormData();
    formData.append("file", file);
    setStatus("Uploading...");
    setErrorDetails("");
    const url = `${process.env.REACT_APP_BACKEND_API}/api/images/upload`;
    console.log("[StorePage] POST", url, formData);
    try {
      const response = await axios.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("[StorePage] Response:", response);
      if (response.data.duplicate) {
        setDuplicateInfo({
          message: '', // No backend message, handled in UI
          similar_images: response.data.similar_images || []
        });
        setStatus("I think I've seen this one before");
        setRegions([]);
        // Show the just-uploaded image using the local file preview
        setJustUploaded(URL.createObjectURL(file));
        setImageUrl("");
        return;
      }
      setStatus("Stored successfully!");
      setRegions(response.data.regions || []);
      if (response.data.image && response.data.image.image_png_b64) {
        setImageUrl(`data:image/png;base64,${response.data.image.image_png_b64}`);
      }
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
      {/* Label filter UI */}
      {uniqueLabels.length > 0 && (
        <div style={{ margin: "1rem 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setSelectedLabel("all")}
            style={{
              background: selectedLabel === "all" ? "#0057FF" : "#F4F6F8",
              color: selectedLabel === "all" ? "#fff" : "#0057FF",
              border: "none",
              borderRadius: 6,
              padding: "0.4rem 1.2rem",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Show All
          </button>
          {uniqueLabels.map(label => (
            <button
              key={label}
              onClick={() => setSelectedLabel(label as string)}
              style={{
                background: selectedLabel === label ? "#0057FF" : "#F4F6F8",
                color: selectedLabel === label ? "#fff" : "#0057FF",
                border: "none",
                borderRadius: 6,
                padding: "0.4rem 1.2rem",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {/* Only show the uploaded image and overlays if regions are available */}
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
              (selectedLabel === "all" || region.semantic_label === selectedLabel) && (
                region.polygon && region.polygon.length > 2 ? (
                  <g key={idx}>
                    <polygon
                      points={region.polygon.map(([x, y]) => `${x},${y}`).join(" ")}
                      fill={hoveredIdx === idx ? "rgba(0,87,255,0.2)" : "rgba(0,87,255,0.08)"}
                      stroke="#0057FF"
                      strokeWidth={hoveredIdx === idx ? 3 : 2}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      style={{ pointerEvents: "all", cursor: "pointer" }}
                      onClick={() => handleRegionClick(region, idx)}
                    />
                    {hoveredIdx === idx && region.semantic_label && (
                      <text
                        x={region.polygon[0][0]}
                        y={region.polygon[0][1] - 8}
                        fill="#0057FF"
                        fontWeight={800}
                        fontSize={16}
                        stroke="#fff"
                        strokeWidth={0.7}
                        paintOrder="stroke"
                        style={{ userSelect: "none" }}
                      >
                        {region.semantic_label}
                      </text>
                    )}
                  </g>
                ) : (
                  <g key={idx}>
                    <rect
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
                      onClick={() => handleRegionClick(region, idx)}
                    />
                    {hoveredIdx === idx && region.semantic_label && (
                      <text
                        x={region.bbox[0]}
                        y={region.bbox[1] - 8}
                        fill="#0057FF"
                        fontWeight={800}
                        fontSize={16}
                        stroke="#fff"
                        strokeWidth={0.7}
                        paintOrder="stroke"
                        style={{ userSelect: "none" }}
                      >
                        {region.semantic_label}
                      </text>
                    )}
                  </g>
                )
              )
            ))}
          </svg>
        </div>
      )}
      {/* Similarity search results */}
      {searchResults.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ color: "#0057FF", fontWeight: 700 }}>Similarity Search Results</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
            {searchResults.map((result, idx) => (
              <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 8, background: "#fafbfc" }}>
                <div>Score: {result.score?.toFixed(3)}</div>
                <div>Id: {result.id}</div>
                {/* Optionally show image if available in metadata */}
                {result.metadata?.image_path && (
                  <img src={`/images/${result.metadata.image_path.split('/').pop()}`} alt="Result" style={{ maxWidth: 120, borderRadius: 8, marginTop: 4 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Duplicate image warning and similar images */}
      {duplicateInfo && (
        <div style={{ margin: "1.5rem 0", color: "#d9534f", fontWeight: 700 }}>
          <div style={{ marginBottom: 12 }}>{duplicateInfo.message}</div>
          {/* Just uploaded image, centered */}
          {justUploaded && (
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: "#0057FF", fontWeight: 700, marginBottom: 4 }}>Just Uploaded</div>
              <img src={justUploaded} alt="Just Uploaded" style={{ maxWidth: 140, borderRadius: 8, border: "2px solid #0057FF" }} />
            </div>
          )}
          {/* Duplicates grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            marginTop: 0,
            alignItems: "start"
          }}>
            {duplicateMetas.map((meta, idx) => {
              const filename = meta.id?.split("/").pop();
              const base = process.env.REACT_APP_BACKEND_API?.replace(/\/$/, "") || "";
              const imgUrl = `${base}/images/${filename}`;
              return (
                <div key={idx} style={{ textAlign: "center" }}>
                  <img src={imgUrl} alt="Similar" style={{ maxWidth: 120, borderRadius: 8, border: "2px solid #eee" }} />
                  {meta.upload_time && (
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Uploaded: {meta.upload_time}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default StorePage; 