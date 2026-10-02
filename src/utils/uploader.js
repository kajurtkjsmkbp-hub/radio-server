/**
 * Reusable HTTP Binary Uploader with Real-time Progress, Transfer Speed (MB/s), and ETA calculation.
 */
export function uploadFileWithProgress({
  url,
  headers = {},
  file,
  onProgress
}) {
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
