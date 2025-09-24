import React, { useState } from 'react';
import { storage } from '../lib/api.js';

const FileUploadExample = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);
  };

  const handleSingleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    setLoading(true);
    const file = selectedFiles[0];
    
    try {
      // Create a unique path for the file
      const uniqueFilename = storage.helpers.createUniqueFilename(file.name);
      const filePath = `documents/${uniqueFilename}`;

      // Upload with progress tracking
      const downloadURL = await storage.uploadFile(
        file, 
        filePath, 
        (progress) => {
          setUploadProgress({ [file.name]: progress });
          console.log(`Upload progress: ${progress}%`);
        }
      );

      // Add to uploaded files list
      setUploadedFiles(prev => [...prev, {
        name: file.name,
        path: filePath,
        downloadURL,
        size: storage.helpers.formatFileSize(file.size)
      }]);

      console.log('File uploaded successfully:', downloadURL);
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Error uploading file: ' + error.message);
    } finally {
      setLoading(false);
      setUploadProgress({});
    }
  };

  const handleMultipleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    setLoading(true);
    
    try {
      const basePath = 'documents';
      
      // Upload multiple files with progress tracking
      const downloadURLs = await storage.uploadMultipleFiles(
        selectedFiles,
        basePath,
        (index, progress, filename) => {
          setUploadProgress(prev => ({
            ...prev,
            [filename]: progress
          }));
        }
      );

      // Add all uploaded files to the list
      const newUploadedFiles = selectedFiles.map((file, index) => ({
        name: file.name,
        path: `${basePath}/${file.name}`,
        downloadURL: downloadURLs[index],
        size: storage.helpers.formatFileSize(file.size)
      }));

      setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
      console.log('All files uploaded successfully');
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Error uploading files: ' + error.message);
    } finally {
      setLoading(false);
      setUploadProgress({});
    }
  };

  const handleDeleteFile = async (filePath, index) => {
    try {
      await storage.deleteFile(filePath);
      setUploadedFiles(prev => prev.filter((_, i) => i !== index));
      console.log('File deleted successfully');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Error deleting file: ' + error.message);
    }
  };

  const listAllFiles = async () => {
    try {
      const files = await storage.listFiles('documents');
      console.log('Files in storage:', files);
      setUploadedFiles(files.map(file => ({
        name: file.name,
        path: file.fullPath,
        downloadURL: file.downloadURL,
        size: storage.helpers.formatFileSize(file.size)
      })));
    } catch (error) {
      console.error('Error listing files:', error);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Firebase Storage API Example</h2>
      
      {/* File Selection */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ marginBottom: '10px' }}
        />
        <div>
          {selectedFiles.map((file, index) => (
            <div key={index} style={{ fontSize: '14px', color: '#666' }}>
              {file.name} ({storage.helpers.formatFileSize(file.size)})
            </div>
          ))}
        </div>
      </div>

      {/* Upload Buttons */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={handleSingleUpload} 
          disabled={loading || selectedFiles.length === 0}
          style={{ marginRight: '10px' }}
        >
          Upload First File
        </button>
        <button 
          onClick={handleMultipleUpload} 
          disabled={loading || selectedFiles.length === 0}
          style={{ marginRight: '10px' }}
        >
          Upload All Files
        </button>
        <button onClick={listAllFiles}>
          List All Files
        </button>
      </div>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Upload Progress:</h3>
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div key={filename} style={{ marginBottom: '10px' }}>
              <div>{filename}</div>
              <div style={{ 
                width: '100%', 
                backgroundColor: '#f0f0f0', 
                borderRadius: '4px',
                height: '20px'
              }}>
                <div style={{
                  width: `${progress}%`,
                  backgroundColor: '#4CAF50',
                  height: '100%',
                  borderRadius: '4px',
                  textAlign: 'center',
                  lineHeight: '20px',
                  color: 'white',
                  fontSize: '12px'
                }}>
                  {Math.round(progress)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div>
          <h3>Uploaded Files:</h3>
          {uploadedFiles.map((file, index) => (
            <div key={index} style={{ 
              border: '1px solid #ddd', 
              padding: '10px', 
              marginBottom: '10px',
              borderRadius: '4px'
            }}>
              <div><strong>{file.name}</strong></div>
              <div>Size: {file.size}</div>
              <div>Path: {file.path}</div>
              <div style={{ marginTop: '10px' }}>
                <a 
                  href={file.downloadURL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ marginRight: '10px' }}
                >
                  Download
                </a>
                <button 
                  onClick={() => handleDeleteFile(file.path, index)}
                  style={{ 
                    backgroundColor: '#f44336', 
                    color: 'white', 
                    border: 'none', 
                    padding: '5px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUploadExample;