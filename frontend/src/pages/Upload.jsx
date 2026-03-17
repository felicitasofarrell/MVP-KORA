// Upload.jsx
import "./Upload.css";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { storage } from "../lib/api.js";
import KoraLogoWhite from "../assets/Logos-Kora-blanco.png";

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  
  // State management
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // File validation settings
  const MAX_FILE_SIZE = 10; // MB
  const ALLOWED_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  // Handle clipboard paste for screenshots
  useEffect(() => {
    const handlePaste = async (e) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let item of clipboardItems) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            // Create a custom name for pasted images
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const newFile = new File([file], `screenshot-${timestamp}.png`, { type: 'image/png' });
            handleFileSelection([newFile]);
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZoneRef.current?.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFileSelection(files);
  };

  // File input change handler
  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    handleFileSelection(files);
  };

  // File selection and validation
  const handleFileSelection = (files) => {
    setError(null);
    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      // Check file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Tipo de archivo no permitido`);
        return;
      }

      // Check file size
      if (!storage.helpers.validateFileSize(file, MAX_FILE_SIZE)) {
        errors.push(`${file.name}: Archivo demasiado grande (máximo ${MAX_FILE_SIZE}MB)`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      setError(errors.join(', '));
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  // Remove file from selection
  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload files
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress({});

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const basePath = `uploads/${timestamp}`;

      const uploadPromises = selectedFiles.map(async (file, index) => {
        const uniqueFilename = storage.helpers.createUniqueFilename(file.name);
        const filePath = `${basePath}/${uniqueFilename}`;

        const downloadURL = await storage.uploadFile(
          file,
          filePath,
          (progress) => {
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: progress
            }));
          }
        );

        return {
          name: file.name,
          path: filePath,
          downloadURL,
          size: file.size,
          type: file.type
        };
      });

      const results = await Promise.all(uploadPromises);
      
      setUploadedFiles(prev => [...prev, ...results]);
      setSelectedFiles([]);
      setSuccess(`${results.length} archivo(s) subido(s) exitosamente`);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);

    } catch (error) {
      console.error('Upload failed:', error);
      setError('Error al subir archivos: ' + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  // Clear all files
  const clearAllFiles = () => {
    setSelectedFiles([]);
    setUploadedFiles([]);
    setError(null);
    setSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="upload-root">
      {/* Header */}
      <header className="upload-header">
        <div className="brand">
          <button 
            className="back-btn" 
            onClick={() => navigate('/second')}
            aria-label="Volver"
          >
            ←
          </button>
          <img src={KoraLogoWhite} alt="Kora" />
        </div>
        <h1>Subir Archivos</h1>
        <div></div> {/* Spacer for flex layout */}
      </header>

      <div className="upload-container">
        {/* Upload Zone */}
        <div 
          ref={dropZoneRef}
          className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="upload-icon">📁</div>
          <h3>Arrastra archivos aquí o haz click para seleccionar</h3>
          <p>También puedes pegar capturas de pantalla con Ctrl+V</p>
          <p className="upload-specs">
            Tipos permitidos: Imágenes, PDF, Documentos, Excel<br/>
            Tamaño máximo: {MAX_FILE_SIZE}MB por archivo
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="message error-message">
            ⚠️ {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="message success-message">
            ✅ {success}
          </div>
        )}

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="files-section">
            <div className="section-header">
              <h3>Archivos Seleccionados ({selectedFiles.length})</h3>
              <div className="section-actions">
                <button 
                  className="btn btn-primary" 
                  onClick={handleUpload}
                  disabled={isUploading}
                >
                  {isUploading ? 'Subiendo...' : 'Subir Archivos'}
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={clearAllFiles}
                  disabled={isUploading}
                >
                  Limpiar Todo
                </button>
              </div>
            </div>

            <div className="files-list">
              {selectedFiles.map((file, index) => (
                <div key={index} className="file-item">
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-details">
                      {storage.helpers.formatFileSize(file.size)} • {file.type}
                    </div>
                  </div>
                  
                  {uploadProgress[file.name] !== undefined && (
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${uploadProgress[file.name]}%` }}
                      ></div>
                      <span className="progress-text">
                        {Math.round(uploadProgress[file.name])}%
                      </span>
                    </div>
                  )}
                  
                  {!isUploading && (
                    <button 
                      className="btn btn-remove"
                      onClick={() => removeFile(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="files-section">
            <div className="section-header">
              <h3>Archivos Subidos ({uploadedFiles.length})</h3>
            </div>

            <div className="files-list">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="file-item uploaded">
                  <div className="file-info">
                    <div className="file-name">✅ {file.name}</div>
                    <div className="file-details">
                      {storage.helpers.formatFileSize(file.size)} • Subido exitosamente
                    </div>
                  </div>
                  
                  <div className="file-actions">
                    <a 
                      href={file.downloadURL} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-link"
                    >
                      Ver
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="help-section">
          <h4>💡 Consejos:</h4>
          <ul>
            <li>Puedes arrastrar múltiples archivos a la vez</li>
            <li>Para capturas de pantalla: toma la captura y pega con Ctrl+V</li>
            <li>Los archivos se organizan automáticamente por fecha</li>
            <li>Todos los archivos quedan guardados en la nube de forma segura</li>
          </ul>
        </div>
      </div>
    </div>
  );
}