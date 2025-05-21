import React, { useState } from 'react';

const ImageUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    // TODO: Call /images/upload API
    alert('Upload not implemented');
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleChange} />
      <button onClick={handleUpload} disabled={!file}>Upload</button>
    </div>
  );
};

export default ImageUploader;
