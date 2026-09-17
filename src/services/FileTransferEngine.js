// FileTransferEngine.js - Chunked binary file transfer over WebRTC DataChannel

const CHUNK_SIZE = 64 * 1024; // 64 KB chunks
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB memory bound (DoS prevention)

function sanitizeFileName(rawName) {
  if (typeof rawName !== "string") return "downloaded_file";
  const baseName = rawName.split(/[/\\]/).pop();
  return baseName.replace(/[/\\?%*:|"<>]/g, "_").replace(/^\.+/, "").trim() || "downloaded_file";
}

export class FileTransferEngine {
  constructor(webrtc) {
    this.webrtc = webrtc;
    this.handlers = new Map();
    this.receivingFiles = new Map(); // fileId -> { name, size, chunks: [], receivedBytes, totalChunks }
    this.sendingQueue = [];
    this.isSending = false;

    // Listen to messages from WebRTC
    this.webrtc.on("file-message", (msg) => this.handleControlMessage(msg));
    this.webrtc.on("file-chunk", (chunk) => this.handleChunk(chunk));
  }

  // Send a File or Blob
  async sendFile(file) {
    if (!file || typeof file.size !== "number") {
      throw new Error("Invalid file object.");
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed size of 500 MB.`);
    }

    const fileId = "fx_" + Math.random().toString(36).substr(2, 9);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const task = {
      id: fileId,
      name: sanitizeFileName(file.name),
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      file,
      totalChunks,
    };

    this.sendingQueue.push(task);
    this.trigger("transfer-queued", task);

    if (!this.isSending) {
      this.processQueue();
    }

    return fileId;
  }

  async processQueue() {
    if (this.sendingQueue.length === 0) {
      this.isSending = false;
      return;
    }

    this.isSending = true;
    const task = this.sendingQueue.shift();

    // Send file start header
    this.webrtc.send("file", {
      type: "file-start",
      id: task.id,
      name: task.name,
      size: task.size,
      mimeType: task.mimeType,
      totalChunks: task.totalChunks,
    });

    const fileChannel = this.webrtc.channels.file;
    let offset = 0;
    let chunkIndex = 0;

    const fileReader = new FileReader();

    const readNextChunk = () => {
      const slice = task.file.slice(offset, offset + CHUNK_SIZE);
      fileReader.readAsArrayBuffer(slice);
    };

    fileReader.onload = async (e) => {
      const buffer = e.target.result;

      // Handle DataChannel backpressure
      if (fileChannel && fileChannel.bufferedAmount > 512 * 1024) {
        await new Promise((resolve) => {
          const checkBuffer = () => {
            if (!fileChannel || fileChannel.bufferedAmount <= 128 * 1024) {
              resolve();
            } else {
              setTimeout(checkBuffer, 20);
            }
          };
          checkBuffer();
        });
      }

      this.webrtc.send("file", buffer);

      offset += buffer.byteLength;
      chunkIndex++;

      const progress = Math.min(100, Math.round((offset / task.size) * 100));
      this.trigger("transfer-progress", {
        id: task.id,
        direction: "upload",
        name: task.name,
        offset,
        total: task.size,
        progress,
      });

      if (offset < task.size) {
        readNextChunk();
      } else {
        // Send file end footer
        this.webrtc.send("file", {
          type: "file-end",
          id: task.id,
        });

        this.trigger("transfer-complete", {
          id: task.id,
          direction: "upload",
          name: task.name,
        });

        // Continue next queued file
        setTimeout(() => this.processQueue(), 50);
      }
    };

    readNextChunk();
  }

  handleControlMessage(msg) {
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "file-start") {
      // Security check (SEC-05): validate size bounds and data types
      if (!msg.id || typeof msg.size !== "number" || msg.size <= 0 || msg.size > MAX_FILE_SIZE) {
        console.warn(`[FileTransferEngine] Rejected invalid/oversized file transfer (id: ${msg.id}, size: ${msg.size})`);
        this.trigger("transfer-error", {
          id: msg.id,
          name: msg.name,
          message: msg.size > MAX_FILE_SIZE
            ? `File exceeds maximum allowed size (${(msg.size / (1024 * 1024)).toFixed(1)} MB > 500 MB).`
            : "Invalid file transfer header parameters.",
        });
        return;
      }

      // Security check (SEC-06): sanitize incoming remote file name
      const safeName = sanitizeFileName(msg.name);

      this.receivingFiles.set(msg.id, {
        id: msg.id,
        name: safeName,
        size: msg.size,
        mimeType: msg.mimeType || "application/octet-stream",
        totalChunks: msg.totalChunks,
        receivedBytes: 0,
        chunks: [],
      });
      this.currentIncomingId = msg.id;

      this.trigger("transfer-started", {
        id: msg.id,
        direction: "download",
        name: safeName,
        size: msg.size,
      });
    } else if (msg.type === "file-end") {
      const fileData = this.receivingFiles.get(msg.id);
      if (fileData) {
        const blob = new Blob(fileData.chunks, { type: fileData.mimeType });
        this.trigger("transfer-complete", {
          id: msg.id,
          direction: "download",
          name: fileData.name,
          blob,
        });
        fileData.chunks = []; // Explicitly free memory
        this.receivingFiles.delete(msg.id);
        if (this.currentIncomingId === msg.id) {
          this.currentIncomingId = null;
        }
      }
    } else if (msg.type === "file-cancel" || msg.type === "file-error") {
      this.cancelTransfer(msg.id);
    }
  }

  handleChunk(arrayBuffer) {
    if (!this.currentIncomingId) return;
    const fileData = this.receivingFiles.get(this.currentIncomingId);
    if (!fileData) return;

    // Security check (SEC-05): enforce strict chunk byte boundary to prevent memory exhaustion
    if (fileData.receivedBytes + arrayBuffer.byteLength > fileData.size) {
      console.warn(`[FileTransferEngine] Transfer for ${fileData.id} exceeded declared file size (${fileData.size} bytes). Aborting.`);
      const badId = this.currentIncomingId;
      const fileName = fileData.name;
      this.cancelTransfer(badId);
      this.trigger("transfer-error", {
        id: badId,
        name: fileName,
        message: "File transfer aborted: incoming data exceeded declared size.",
      });
      return;
    }

    fileData.chunks.push(arrayBuffer);
    fileData.receivedBytes += arrayBuffer.byteLength;

    const progress = Math.min(100, Math.round((fileData.receivedBytes / fileData.size) * 100));
    this.trigger("transfer-progress", {
      id: fileData.id,
      direction: "download",
      name: fileData.name,
      offset: fileData.receivedBytes,
      total: fileData.size,
      progress,
    });
  }

  cancelTransfer(fileId) {
    const fileData = this.receivingFiles.get(fileId);
    if (fileData) {
      fileData.chunks = []; // Release chunk memory buffer immediately
      this.receivingFiles.delete(fileId);
    }
    if (this.currentIncomingId === fileId) {
      this.currentIncomingId = null;
    }
    this.sendingQueue = this.sendingQueue.filter((t) => t.id !== fileId);
  }

  on(event, callback) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.handlers.has(event)) return;
    const list = this.handlers.get(event).filter((cb) => cb !== callback);
    this.handlers.set(event, list);
  }

  trigger(event, data) {
    if (this.handlers.has(event)) {
      this.handlers.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[FileTransferEngine] Handler error for ${event}:`, e);
        }
      });
    }
  }
}
