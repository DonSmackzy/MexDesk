// src/services/AuditLogger.js - Enterprise Security Audit Engine for AegisDesk

class AuditLogger {
  constructor() {
    this.STORAGE_KEY = "aegisdesk_audit_trail";
    this.MAX_ENTRIES = 200;
  }

  getLogs() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  logEvent({ type, peerId, peerAlias, details = {} }) {
    const logs = this.getLogs();
    const entry = {
      id: "audit-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      type, // "session_start" | "session_end" | "file_transfer" | "permission_change" | "security_alert" | "shortcut"
      peerId: peerId || "unknown",
      peerAlias: peerAlias || "unknown",
      details,
    };

    const updated = [entry, ...logs].slice(0, this.MAX_ENTRIES);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("[AegisDesk Audit] Storage write failure:", e);
    }
    return entry;
  }

  logSessionStart(peerId, peerAlias, mode = "full-control", permissions = {}) {
    return this.logEvent({
      type: "session_start",
      peerId,
      peerAlias,
      details: { mode, permissions },
    });
  }

  logSessionEnd(peerId, peerAlias, durationSeconds = 0, reason = "user_disconnect") {
    return this.logEvent({
      type: "session_end",
      peerId,
      peerAlias,
      details: { durationSeconds, reason },
    });
  }

  logFileTransfer(peerId, fileName, fileSize, direction = "upload", status = "completed") {
    return this.logEvent({
      type: "file_transfer",
      peerId,
      details: { fileName, fileSize, direction, status },
    });
  }

  logPermissionChange(peerId, changedPermissions) {
    return this.logEvent({
      type: "permission_change",
      peerId,
      details: { changedPermissions },
    });
  }

  exportJSON() {
    const logs = this.getLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegisdesk-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportCSV() {
    const logs = this.getLogs();
    const headers = ["ID", "Timestamp", "Type", "Peer ID", "Peer Alias", "Details"];
    const rows = logs.map((l) => [
      l.id,
      l.timestamp,
      l.type,
      l.peerId,
      l.peerAlias,
      `"${JSON.stringify(l.details).replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegisdesk-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  clearLogs() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const auditLogger = new AuditLogger();
