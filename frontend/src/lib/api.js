import { StorageAPI, storageHelpers } from './storageAPI.js';

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

// Backend API functions
export async function ask(question) {
  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${msg}`);
  }
  return res.json(); // { answer: string, citations?: string[] }
}

export async function ingest() {
  const res = await fetch(`${API_BASE}/ingest`, { method: "POST" });
  if (!res.ok) throw new Error("No se pudo reindexar");
  return res.json();
}

export async function health() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

// Firebase Storage API functions
export const storage = {
  // Upload a single file
  async uploadFile(file, path, onProgress) {
    return await StorageAPI.uploadFile(file, path, onProgress);
  },

  // Upload multiple files
  async uploadMultipleFiles(files, basePath, onProgress) {
    return await StorageAPI.uploadMultipleFiles(files, basePath, onProgress);
  },

  // Get file download URL
  async getFileURL(path) {
    return await StorageAPI.getFileURL(path);
  },

  // Delete a file
  async deleteFile(path) {
    return await StorageAPI.deleteFile(path);
  },

  // List files in a directory
  async listFiles(dirPath) {
    return await StorageAPI.listFiles(dirPath);
  },

  // Get file metadata
  async getFileMetadata(path) {
    return await StorageAPI.getFileMetadata(path);
  },

  // Helper functions
  helpers: storageHelpers
};