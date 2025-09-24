// Storage.jsx
import "./Storage.css";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { storage } from "../lib/api.js";
import KoraLogoWhite from "../assets/Logos-Kora-blanco.png";

export default function Storage() {
  const navigate = useNavigate();
  
  // State management
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'
  const [lastLoadTime, setLastLoadTime] = useState(null);
  
  // Cache to avoid unnecessary reloads
  const [filesCache, setFilesCache] = useState(null);
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  // File type categories
  const fileCategories = {
    images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    spreadsheets: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
    text: ['text/plain', 'text/csv']
  };

  // Optimized function to load files with better Firebase Storage API usage
  const loadFilesRecursively = async (basePath) => {
    let allFiles = [];
    
    try {
      // Use Firebase Storage's list() method which can list subdirectories too
      // This is more efficient than making individual calls
      const directFiles = await storage.listFiles(basePath);
      allFiles = [...allFiles, ...directFiles];

      // For uploads directory, use a more efficient approach
      if (basePath === 'uploads') {
        // Only check the most likely recent dates (last 7 days) to reduce API calls
        const recentDates = [];
        const today = new Date();
        
        for (let i = 0; i < 7; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          recentDates.push(date.toISOString().split('T')[0]);
        }

        // Use Promise.allSettled for parallel execution instead of sequential
        const datePromises = recentDates.map(async (dateStr) => {
          try {
            return await storage.listFiles(`${basePath}/${dateStr}`);
          } catch (err) {
            return []; // Return empty array if directory doesn't exist
          }
        });

        const results = await Promise.allSettled(datePromises);
        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value.length > 0) {
            allFiles = [...allFiles, ...result.value];
          }
        });
      }
    } catch (err) {
      console.log(`Error loading files from ${basePath}:`, err);
    }

    return allFiles;
  };

  // Check if cache is still valid
  const isCacheValid = () => {
    if (!filesCache || !lastLoadTime) return false;
    return Date.now() - lastLoadTime < CACHE_DURATION;
  };

  // Load files from storage with caching and progress
  const loadFiles = async (forceReload = false) => {
    // Use cache if valid and not forcing reload
    if (!forceReload && isCacheValid()) {
      setFiles(filesCache);
      setFilteredFiles(filesCache);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingProgress({ current: 0, total: 4 }); // 4 main directories to check
    
    try {
      const directories = ['uploads', 'documents', 'images', ''];
      let allFiles = [];
      let completed = 0;

      // Load directories in parallel for better performance
      const directoryPromises = directories.map(async (dir) => {
        try {
          const dirFiles = await loadFilesRecursively(dir);
          completed++;
          setLoadingProgress({ current: completed, total: directories.length });
          return dirFiles;
        } catch (err) {
          console.log(`Directory ${dir} not found or empty`);
          completed++;
          setLoadingProgress({ current: completed, total: directories.length });
          return [];
        }
      });

      const results = await Promise.all(directoryPromises);
      
      // Flatten all results
      allFiles = results.flat();

      // Remove duplicates based on fullPath
      const uniqueFiles = allFiles.filter((file, index, self) => 
        index === self.findIndex(f => f.fullPath === file.fullPath)
      );

      // Update cache
      setFilesCache(uniqueFiles);
      setLastLoadTime(Date.now());
      
      setFiles(uniqueFiles);
      setFilteredFiles(uniqueFiles);
      
    } catch (error) {
      console.error('Error loading files:', error);
      setError('Error cargando archivos: ' + error.message);
    } finally {
      setLoading(false);
      setLoadingProgress({ current: 0, total: 0 });
    }
  };

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);

  // Get unique folders from files
  const getUniqueFolders = () => {
    const folders = new Set();
    files.forEach(file => {
      const folderName = getFolderName(file.fullPath);
      folders.add(folderName);
    });
    return Array.from(folders).sort();
  };

  // Filter and search files
  useEffect(() => {
    let filtered = [...files];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(file => 
        file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.fullPath.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply folder filter
    if (selectedFolder !== 'all') {
      filtered = filtered.filter(file => {
        const folderName = getFolderName(file.fullPath);
        return folderName === selectedFolder;
      });
    }

    // Apply category filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(file => {
        if (selectedFilter === 'images') {
          return fileCategories.images.includes(file.contentType);
        }
        if (selectedFilter === 'documents') {
          return fileCategories.documents.includes(file.contentType);
        }
        if (selectedFilter === 'spreadsheets') {
          return fileCategories.spreadsheets.includes(file.contentType);
        }
        if (selectedFilter === 'text') {
          return fileCategories.text.includes(file.contentType);
        }
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'date':
          comparison = new Date(a.timeCreated) - new Date(b.timeCreated);
          break;
        case 'type':
          comparison = a.contentType.localeCompare(b.contentType);
          break;
        case 'folder':
          comparison = getFolderName(a.fullPath).localeCompare(getFolderName(b.fullPath));
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredFiles(filtered);
  }, [files, searchTerm, selectedFilter, selectedFolder, sortBy, sortOrder]);

  // Get file type icon
  const getFileIcon = (contentType) => {
    if (fileCategories.images.includes(contentType)) return '🖼️';
    if (fileCategories.documents.includes(contentType)) return '📄';
    if (fileCategories.spreadsheets.includes(contentType)) return '📊';
    if (fileCategories.text.includes(contentType)) return '📝';
    return '📁';
  };

  // Get file category name
  const getFileCategory = (contentType) => {
    if (fileCategories.images.includes(contentType)) return 'Imagen';
    if (fileCategories.documents.includes(contentType)) return 'Documento';
    if (fileCategories.spreadsheets.includes(contentType)) return 'Hoja de cálculo';
    if (fileCategories.text.includes(contentType)) return 'Texto';
    return 'Archivo';
  };

  // Get folder name from file path
  const getFolderName = (fullPath) => {
    const pathParts = fullPath.split('/');
    if (pathParts.length > 2) {
      return `${pathParts[0]}/${pathParts[1]}`;
    }
    return pathParts[0] || 'Raíz';
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Toggle file selection
  const toggleFileSelection = (fullPath) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fullPath)) {
      newSelected.delete(fullPath);
    } else {
      newSelected.add(fullPath);
    }
    setSelectedFiles(newSelected);
  };

  // Select all filtered files
  const selectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map(file => file.fullPath)));
    }
  };

  // Delete selected files
  const deleteSelectedFiles = async () => {
    if (selectedFiles.size === 0) return;
    
    const confirmDelete = window.confirm(
      `¿Estás seguro de que quieres eliminar ${selectedFiles.size} archivo(s)?`
    );
    
    if (!confirmDelete) return;

    try {
      const deletePromises = Array.from(selectedFiles).map(fullPath => 
        storage.deleteFile(fullPath)
      );
      
      await Promise.all(deletePromises);
      
      // Refresh file list
      await loadFiles();
      setSelectedFiles(new Set());
      
      alert(`${selectedFiles.size} archivo(s) eliminado(s) exitosamente`);
    } catch (error) {
      console.error('Error deleting files:', error);
      alert('Error eliminando archivos: ' + error.message);
    }
  };

  // Download file
  const downloadFile = (file) => {
    const link = document.createElement('a');
    link.href = file.downloadURL;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="storage-root">
      {/* Header */}
      <header className="storage-header">
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
        <h1>Gestor de Archivos</h1>
        <div className="header-actions">
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/upload')}
          >
            Subir Archivos
          </button>
        </div>
      </header>

      <div className="storage-container">
        {/* Controls */}
        <div className="storage-controls">
          <div className="search-section">
            <input
              type="text"
              className="search-input"
              placeholder="Buscar archivos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button 
              className="btn btn-secondary"
              onClick={() => loadFiles(true)}
              disabled={loading}
              title={isCacheValid() ? 'Forzar actualización (cache válido)' : 'Actualizar'}
            >
              🔄 {loading ? 'Cargando...' : 'Actualizar'}
            </button>
            {isCacheValid() && !loading && (
              <span className="cache-indicator" title="Datos en caché (actualizados recientemente)">
                💾 Cache válido
              </span>
            )}
          </div>

          <div className="filter-section">
            <select 
              value={selectedFolder} 
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="filter-select"
            >
              <option value="all">📁 Todas las carpetas</option>
              {getUniqueFolders().map((folder) => (
                <option key={folder} value={folder}>
                  📅 {folder}
                </option>
              ))}
            </select>

            <select 
              value={selectedFilter} 
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Todos los tipos</option>
              <option value="images">🖼️ Imágenes</option>
              <option value="documents">📄 Documentos</option>
              <option value="spreadsheets">📊 Hojas de cálculo</option>
              <option value="text">📝 Archivos de texto</option>
            </select>

            <select 
              value={`${sortBy}-${sortOrder}`} 
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
              className="sort-select"
            >
              <option value="date-desc">📅 Más reciente primero</option>
              <option value="date-asc">📅 Más antiguo primero</option>
              <option value="name-asc">🔤 Nombre A-Z</option>
              <option value="name-desc">🔤 Nombre Z-A</option>
              <option value="size-desc">📏 Mayor tamaño primero</option>
              <option value="size-asc">📏 Menor tamaño primero</option>
              <option value="type-asc">🏷️ Tipo A-Z</option>
              <option value="folder-asc">📁 Carpeta A-Z</option>
            </select>

            <div className="view-toggle">
              <button 
                className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('grid')}
              >
                ⊞
              </button>
              <button 
                className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('list')}
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {/* Bulk actions */}
        {filteredFiles.length > 0 && (
          <div className="bulk-actions">
            <div className="selection-info">
              <button 
                className="btn btn-secondary"
                onClick={selectAll}
              >
                {selectedFiles.size === filteredFiles.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
              <span>
                {selectedFiles.size} de {filteredFiles.length} archivos seleccionados
              </span>
            </div>
            
            {selectedFiles.size > 0 && (
              <button 
                className="btn btn-danger"
                onClick={deleteSelectedFiles}
              >
                🗑️ Eliminar seleccionados
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="loading-message">
            <div className="spinner"></div>
            <div className="loading-text">
              {loadingProgress.total > 0 ? (
                <span>
                  Cargando archivos... ({loadingProgress.current}/{loadingProgress.total} directorios)
                  <div className="loading-progress">
                    <div 
                      className="loading-progress-bar"
                      style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </span>
              ) : (
                'Iniciando carga...'
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {/* Files display */}
        {!loading && !error && (
          <>
            {filteredFiles.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📂</div>
                <h3>No se encontraron archivos</h3>
                <p>
                  {files.length === 0 
                    ? 'No hay archivos en el storage. ¡Sube algunos para comenzar!'
                    : 'No hay archivos que coincidan con tu búsqueda.'
                  }
                </p>
                <button 
                  className="btn btn-primary"
                  onClick={() => navigate('/upload')}
                >
                  📁 Subir Archivos
                </button>
              </div>
            ) : (
              <div className={`files-display ${viewMode}`}>
                {filteredFiles.map((file) => (
                  <div 
                    key={file.fullPath} 
                    className={`file-card ${selectedFiles.has(file.fullPath) ? 'selected' : ''}`}
                  >
                    <div className="file-selection">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.fullPath)}
                        onChange={() => toggleFileSelection(file.fullPath)}
                      />
                    </div>
                    
                    <div className="file-preview">
                      {fileCategories.images.includes(file.contentType) ? (
                        <img 
                          src={file.downloadURL} 
                          alt={file.name}
                          className="file-thumbnail"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <div 
                        className="file-icon"
                        style={{ display: fileCategories.images.includes(file.contentType) ? 'none' : 'flex' }}
                      >
                        {getFileIcon(file.contentType)}
                      </div>
                    </div>

                    <div className="file-details">
                      <div className="file-name" title={file.name}>
                        {file.name}
                      </div>
                      <div className="file-meta">
                        <span className="file-folder">
                          📁 {getFolderName(file.fullPath)}
                        </span>
                        <span className="file-type">
                          {getFileCategory(file.contentType)}
                        </span>
                        <span className="file-size">
                          {storage.helpers.formatFileSize(file.size)}
                        </span>
                        <span className="file-date">
                          {formatDate(file.timeCreated)}
                        </span>
                      </div>
                    </div>

                    <div className="file-actions">
                      <button 
                        className="btn btn-link"
                        onClick={() => downloadFile(file)}
                        title="Descargar"
                      >
                        ⬇️
                      </button>
                      <a 
                        href={file.downloadURL} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn btn-link"
                        title="Ver"
                      >
                        👁️
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Stats */}
        {!loading && files.length > 0 && (
          <div className="storage-stats">
            <h4>📊 Estadísticas</h4>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Total de archivos:</span>
                <span className="stat-value">{files.length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Tamaño total:</span>
                <span className="stat-value">
                  {storage.helpers.formatFileSize(
                    files.reduce((total, file) => total + file.size, 0)
                  )}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Imágenes:</span>
                <span className="stat-value">
                  {files.filter(f => fileCategories.images.includes(f.contentType)).length}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Documentos:</span>
                <span className="stat-value">
                  {files.filter(f => fileCategories.documents.includes(f.contentType)).length}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Carpetas:</span>
                <span className="stat-value">
                  {getUniqueFolders().length}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Uploads con fecha:</span>
                <span className="stat-value">
                  {files.filter(f => f.fullPath.startsWith('uploads/') && f.fullPath.match(/uploads\/\d{4}-\d{2}-\d{2}\//)).length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
