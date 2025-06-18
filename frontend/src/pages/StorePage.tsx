import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { queryVectors, upsertVectors } from '../api';

interface Region {
  tag: string;
  bbox: number[];
  mask_png_b64: string;
  polygon?: number[][];
  semantic_label?: string;
  region_idx?: number;
  embedding?: number[];
  caption?: string;
  region_png_url?: string;
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
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [regionSearchRegion, setRegionSearchRegion] = useState<Region | null>(null);

  const handleRegionClick = async (region: Region, idx: number) => {
    setStatus("Cropping region and recomputing embedding...");
    setErrorDetails("");
    setSearchResults([]);
    setRegionSearchRegion(region);
    try {
      // Get the displayed image element
      const imgEl = document.querySelector('img[alt="Uploaded"]') as HTMLImageElement;
      if (!imgEl) {
        setStatus("Could not find uploaded image element.");
        return;
      }
      // Create a canvas to crop the region
      const canvas = document.createElement('canvas');
      const [x0, y0, x1, y1] = region.bbox;
      const width = x1 - x0;
      const height = y1 - y0;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setStatus("Could not get canvas context.");
        return;
      }
      // Draw the image region
      ctx.drawImage(imgEl, x0, y0, width, height, 0, 0, width, height);
      // If mask is present, apply it as alpha
      if (region.mask_png_b64) {
        const maskImg = new window.Image();
        maskImg.src = `data:image/png;base64,${region.mask_png_b64}`;
        await new Promise(resolve => { maskImg.onload = resolve; });
        // Draw mask to get alpha channel
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          maskCtx.drawImage(maskImg, 0, 0, width, height);
          const maskData = maskCtx.getImageData(0, 0, width, height);
          const regionData = ctx.getImageData(0, 0, width, height);
          // Set alpha channel from mask
          for (let i = 0; i < maskData.data.length; i += 4) {
            regionData.data[i + 3] = maskData.data[i]; // Use red channel as alpha
          }
          ctx.putImageData(regionData, 0, 0);
        }
      }
      // Convert canvas to blob
      const blob: Blob = await new Promise(resolve => canvas.toBlob(resolve as any, 'image/png'));
      // Debug: show cropped region
      console.log('[Region Search] Cropped region blob:', blob);
      // Send as file to backend
      const formData = new FormData();
      formData.append('file', new File([blob], 'region.png', { type: 'image/png' }));
      const backendUrl = `${process.env.REACT_APP_BACKEND_API}/api/images/search`;
      const res = await axios.post(backendUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const embedding = res.data.embedding;
      if (!embedding) {
        setStatus("No embedding returned for this region.");
        return;
      }
      console.log("[Region Search] Embedding sent to Pinecone:", embedding);
      setStatus("Querying Pinecone for similar regions...");
      let results = await queryVectors(embedding, 12);
      let matches = results.matches || [];
      // Uniqueness filter: only keep highest scoring result per image_path
      const uniqueByImage: { [key: string]: any } = {};
      for (const match of matches) {
        const imgPath = match.metadata?.image_path;
        if (!imgPath) continue;
        if (!uniqueByImage[imgPath] || (match.score > uniqueByImage[imgPath].score)) {
          uniqueByImage[imgPath] = match;
        }
      }
      const uniqueResults = Object.values(uniqueByImage);
      setStatus("Similarity search complete!");
      setSearchResults(uniqueResults);
      console.log("[Similarity Search] Results:", uniqueResults);
    } catch (err: any) {
      setStatus("Error during similarity search.");
      setErrorDetails(err.message);
      setSearchResults([]);
      console.error("[Similarity Search] Error:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      // File type detection
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'
      ];
      if (!allowedTypes.includes(selected.type)) {
        setErrorDetails('Incompatible file type, please use JPEG, PNG, WEBP, GIF, or BMP.');
        setFile(null);
        setImageUrl("");
        setRegions([]);
        setStatus("");
        setSearchResults([]);
        setRegionSearchRegion(null);
        return;
      }
      setFile(selected);
      setImageUrl(URL.createObjectURL(selected));
      setRegions([]);
      setStatus("");
      setSearchResults([]);
      setRegionSearchRegion(null);
      setErrorDetails("");
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

  // Helper to crop a region and return a data URL
  async function cropRegionToDataUrl(imgUrl: string, bbox: number[], mask_png_b64?: string): Promise<string> {
    return new Promise(async (resolve) => {
      const img = new window.Image();
      img.src = imgUrl;
      await new Promise(r => { img.onload = r; });
      const [x0, y0, x1, y1] = bbox;
      const width = x1 - x0;
      const height = y1 - y0;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve('');
      ctx.drawImage(img, x0, y0, width, height, 0, 0, width, height);
      if (mask_png_b64) {
        const maskImg = new window.Image();
        maskImg.src = `data:image/png;base64,${mask_png_b64}`;
        await new Promise(r => { maskImg.onload = r; });
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          maskCtx.drawImage(maskImg, 0, 0, width, height);
          const maskData = maskCtx.getImageData(0, 0, width, height);
          const regionData = ctx.getImageData(0, 0, width, height);
          for (let i = 0; i < maskData.data.length; i += 4) {
            regionData.data[i + 3] = maskData.data[i];
          }
          ctx.putImageData(regionData, 0, 0);
        }
      }
      resolve(canvas.toDataURL('image/png'));
    });
  }

  const handleUpload = async () => {
    if (!file) return;
    setDuplicateInfo(null);
    setStatus('Uploading to backend for processing...');
    setErrorDetails("");
    const formData = new FormData();
    formData.append("file", file);
    const url = `${process.env.REACT_APP_BACKEND_API}/api/images/upload`;
    try {
      // Step 1: Upload to backend for embedding/caption/region extraction
      const response = await axios.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { image, regions } = response.data;
      setStatus('Checking for duplicates in Pinecone...');
      // Step 2: Duplicate check (only full image embedding)
      const dupResults = await queryVectors(image.embedding, 5);
      const duplicates = (dupResults.matches || dupResults)?.filter((m: any) => m.score > 0.999);
      if (duplicates && duplicates.length > 0) {
        setDuplicateInfo({
          message: 'Duplicate detected! Please verify.',
          similar_images: duplicates.map((d: any) => d.id)
        });
        setStatus('Duplicate detected!');
        setRegions([]);
        setJustUploaded(URL.createObjectURL(file));
        setImageUrl("");
        return;
      }
      setStatus('No duplicate found. Upserting to Pinecone...');
      // Step 3: Batch upsert full image and all regions
      const vectors = [
        {
          id: image.image_path,
          values: image.embedding,
          metadata: { ...image, embedding: undefined, image_png_b64: undefined }
        },
        ...regions.map((region: Region, idx: number) => ({
          id: `${image.image_path}#region_${region.region_idx ?? idx}`,
          values: region.embedding,
          metadata: { ...region, embedding: undefined, mask_png_b64: undefined }
        }))
      ];
      await upsertVectors(vectors);
      setStatus('Stored successfully!');
      // Generate PNGs for each region and store as data URLs
      const imgUrl = image && image.image_png_b64 ? `data:image/png;base64,${image.image_png_b64}` : imageUrl;
      const regionsWithPng = await Promise.all((regions || []).map(async (region: Region) => {
        const region_png_url = await cropRegionToDataUrl(imgUrl, region.bbox, region.mask_png_b64);
        return { ...region, region_png_url };
      }));
      setRegions(regionsWithPng);
      if (image && image.image_png_b64) {
        setImageUrl(`data:image/png;base64,${image.image_png_b64}`);
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
      maxWidth: 900,
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
          onClick={() => {
            setFile(null);
            setImageUrl("");
            setRegions([]);
            setStatus("");
            setSearchResults([]);
            setRegionSearchRegion(null);
            setErrorDetails("");
            fileInputRef.current?.click();
          }}
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
      {/* Similarity search results for region-based search */}
      {regionSearchRegion && searchResults.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ color: "#0057FF", fontWeight: 700 }}>Region-Based Similarity Search</h3>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#0057FF", fontWeight: 700, marginBottom: 4 }}>Cropped Region</div>
            {regionSearchRegion.region_png_url && (
              <img
                src={regionSearchRegion.region_png_url}
                alt="Region"
                style={{ maxWidth: 140, borderRadius: 8, border: "2px solid #0057FF", background: "#fff" }}
              />
            )}
            {regionSearchRegion.caption && (
              <div style={{ fontSize: 13, color: "#0057FF", marginTop: 4 }}>{regionSearchRegion.caption}</div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 12 }}>
            {searchResults.map((result, idx) => (
              <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 8, background: "#fafbfc" }}>
                <div>Score: {result.score?.toFixed(3)}</div>
                <div>Id: {result.id}</div>
                {result.metadata?.image_path && (
                  <img src={`${process.env.REACT_APP_BACKEND_API?.replace(/\/$/, '') || ''}/images/${result.metadata.image_path.split('/').pop()}`} alt="Result" style={{ maxWidth: 120, borderRadius: 8, marginTop: 4 }} />
                )}
                {result.metadata?.caption && (
                  <div style={{ fontSize: 13, color: "#0057FF", marginTop: 4 }}>{result.metadata.caption}</div>
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