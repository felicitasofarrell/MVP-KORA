import { 
  ref, 
  uploadBytes, 
  uploadBytesResumable,
  getDownloadURL, 
  deleteObject, 
  listAll,
  getMetadata 
} from "firebase/storage";
import { storage } from "./firebase.js";

// Storage API utilities for Firebase Storage
export class StorageAPI {
  
  /**
   * Upload a file to Firebase Storage
   * @param {File} file - The file to upload
   * @param {string} path - The storage path (e.g., 'documents/filename.pdf')
   * @param {function} onProgress - Optional progress callback
   * @returns {Promise<string>} - Download URL of the uploaded file
   */
  static async uploadFile(file, path, onProgress = null) {
    try {
      const storageRef = ref(storage, path);
      
      if (onProgress) {
        // Use resumable upload for progress tracking
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        return new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              onProgress(progress);
            },
            (error) => {
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              } catch (error) {
                reject(error);
              }
            }
          );
        });
      } else {
        // Simple upload without progress
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Get download URL for a file
   * @param {string} path - The storage path
   * @returns {Promise<string>} - Download URL
   */
  static async getFileURL(path) {
    try {
      const storageRef = ref(storage, path);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error getting download URL:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Firebase Storage
   * @param {string} path - The storage path
   * @returns {Promise<void>}
   */
  static async deleteFile(path) {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
      console.log('File deleted successfully');
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * List all files in a directory
   * @param {string} dirPath - The directory path
   * @returns {Promise<Array>} - Array of file references
   */
  static async listFiles(dirPath) {
    try {
      const storageRef = ref(storage, dirPath);
      const result = await listAll(storageRef);
      
      const files = await Promise.all(
        result.items.map(async (itemRef) => {
          const metadata = await getMetadata(itemRef);
          const downloadURL = await getDownloadURL(itemRef);
          
          return {
            name: itemRef.name,
            fullPath: itemRef.fullPath,
            downloadURL,
            size: metadata.size,
            contentType: metadata.contentType,
            timeCreated: metadata.timeCreated,
            updated: metadata.updated
          };
        })
      );
      
      return files;
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param {string} path - The storage path
   * @returns {Promise<Object>} - File metadata
   */
  static async getFileMetadata(path) {
    try {
      const storageRef = ref(storage, path);
      const metadata = await getMetadata(storageRef);
      return metadata;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files
   * @param {FileList|Array} files - Files to upload
   * @param {string} basePath - Base storage path
   * @param {function} onProgress - Optional progress callback
   * @returns {Promise<Array>} - Array of download URLs
   */
  static async uploadMultipleFiles(files, basePath, onProgress = null) {
    try {
      const uploadPromises = Array.from(files).map((file, index) => {
        const filePath = `${basePath}/${file.name}`;
        return this.uploadFile(file, filePath, onProgress ? 
          (progress) => onProgress(index, progress, file.name) : null
        );
      });

      const downloadURLs = await Promise.all(uploadPromises);
      return downloadURLs;
    } catch (error) {
      console.error('Error uploading multiple files:', error);
      throw error;
    }
  }
}

// Helper functions for common storage operations
export const storageHelpers = {
  
  /**
   * Create a unique filename with timestamp
   * @param {string} originalName - Original filename
   * @returns {string} - Unique filename
   */
  createUniqueFilename(originalName) {
    const timestamp = Date.now();
    const extension = originalName.split('.').pop();
    const nameWithoutExt = originalName.replace(`.${extension}`, '');
    return `${nameWithoutExt}_${timestamp}.${extension}`;
  },

  /**
   * Get file extension
   * @param {string} filename - Filename
   * @returns {string} - File extension
   */
  getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
  },

  /**
   * Format file size
   * @param {number} bytes - File size in bytes
   * @returns {string} - Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Validate file type
   * @param {File} file - File to validate
   * @param {Array} allowedTypes - Array of allowed MIME types
   * @returns {boolean} - Whether file type is allowed
   */
  validateFileType(file, allowedTypes) {
    return allowedTypes.includes(file.type);
  },

  /**
   * Validate file size
   * @param {File} file - File to validate
   * @param {number} maxSizeInMB - Maximum size in MB
   * @returns {boolean} - Whether file size is valid
   */
  validateFileSize(file, maxSizeInMB) {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return file.size <= maxSizeInBytes;
  }
};

export default StorageAPI;