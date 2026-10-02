/**
 * Reusable HTTP Binary Uploader with Real-time Progress, Transfer Speed (MB/s), ETA calculation,
 * and automatic Multi-Part Chunking to completely bypass Cloudflare Tunnel's 100MB body limit.
 */

const CHUNK_SIZE = 25 * 1024 * 1024; // 25 MB per chunk (well under Cloudflare's 100MB threshold)

/**
 * Upload single small file (<= 25MB)
 */
function uploadSinglePart({ url, headers = {}, file, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    for (const [key, val] of Object.entries(headers)) {
      xhr.setRequestHeader(key, val);
    }

    let lastLoaded = 0;
    let lastTime = Date.now();
    let speed = 0;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        if (timeDiff >= 0.25) {
          const loadedDiff = e.loaded - lastLoaded;
          speed = (loadedDiff / timeDiff) / (1024 * 1024); // MB/s
          lastLoaded = e.loaded;
          lastTime = now;
        }

        const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
        const remainingBytes = Math.max(0, e.total - e.loaded);
        const etaSeconds = speed > 0 ? Math.round((remainingBytes / (1024 * 1024)) / speed) : 0;

        if (onProgress) {
          onProgress({
            loadedBytes: e.loaded,
            totalBytes: e.total,
            uploadedMB: (e.loaded / (1024 * 1024)).toFixed(1),
            fileSizeMB: (e.total / (1024 * 1024)).toFixed(1),
            percent,
            speedMBs: speed > 0 ? speed.toFixed(2) : '0.00',
            etaSeconds
          });
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          resolve({ success: true });
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Upload gagal (HTTP ${xhr.status})`));
        } catch (e) {
          reject(new Error(`Upload gagal (HTTP ${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Koneksi internet terputus atau batas Cloudflare Tunnel terlampaui'));
    xhr.ontimeout = () => reject(new Error('Upload timeout (koneksi terlalu lambat)'));
    xhr.send(file);
  });
}

/**
 * Upload large file (> 25MB) using Multi-Part Chunks
 */
async function uploadMultiChunk({ url, headers = {}, file, onProgress }) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  let overallStartTime = Date.now();
  let lastLoaded = 0;
  let lastTime = Date.now();
  let speed = 0;

  let lastResponse = null;

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const start = chunkIdx * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const chunkBlob = file.slice(start, end);

    const chunkHeaders = {
      ...headers,
      'x-upload-id': uploadId,
      'x-chunk-index': chunkIdx.toString(),
      'x-chunk-total': totalChunks.toString()
    };

    lastResponse = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      for (const [key, val] of Object.entries(chunkHeaders)) {
        xhr.setRequestHeader(key, val);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const currentTotalLoaded = start + e.loaded;
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          if (timeDiff >= 0.25) {
            const loadedDiff = currentTotalLoaded - lastLoaded;
            speed = (loadedDiff / timeDiff) / (1024 * 1024); // MB/s
            lastLoaded = currentTotalLoaded;
            lastTime = now;
          }

          const percent = Math.min(100, Math.round((currentTotalLoaded / file.size) * 100));
          const remainingBytes = Math.max(0, file.size - currentTotalLoaded);
          const etaSeconds = speed > 0 ? Math.round((remainingBytes / (1024 * 1024)) / speed) : 0;

          if (onProgress) {
            onProgress({
              loadedBytes: currentTotalLoaded,
              totalBytes: file.size,
              uploadedMB: (currentTotalLoaded / (1024 * 1024)).toFixed(1),
              fileSizeMB: (file.size / (1024 * 1024)).toFixed(1),
              percent,
              speedMBs: speed > 0 ? speed.toFixed(2) : '0.00',
              etaSeconds,
              chunk: chunkIdx + 1,
              totalChunks
            });
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            resolve({ success: true });
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || `Upload chunk gagal (HTTP ${xhr.status})`));
          } catch (e) {
            reject(new Error(`Upload chunk gagal (HTTP ${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Koneksi internet terputus saat mengirim bagian file'));
      xhr.ontimeout = () => reject(new Error('Upload timeout'));
      xhr.send(chunkBlob);
    });
  }

  return lastResponse;
}

/**
 * Main uploader function: automatically chooses single or chunked upload.
 */
export function uploadFileWithProgress(params) {
  if (params.file && params.file.size > CHUNK_SIZE) {
    return uploadMultiChunk(params);
  }
  return uploadSinglePart(params);
}
