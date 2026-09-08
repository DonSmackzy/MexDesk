// SignalingClient.js - WebSocket client for MexDesk signaling and peer discovery

export class SignalingClient {
  constructor(url = "ws://localhost:7777") {
    this.url = url;
    this.ws = null;
    this.peerId = null;
    this.isConnected = false;
    this.handlers = new Map();
    this.reconnectTimer = null;
    this.pingInterval = null;
  }

  connect(customId = null, alias = "MexDesk Device", unattendedPassword = null) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.trigger("status", { connected: true });
        // Register client
        this.send({
          type: "register",
          requestedId: customId,
          alias,
          unattendedPassword,
          systemInfo: {
            userAgent: navigator.userAgent,
            isElectron: !!window.mexdeskAPI?.isElectron,
          }
        });

        // Ping keepalive every 20s
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.send({ type: "ping" });
          }
        }, 20000);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error("[SignalingClient] Parse error:", e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.trigger("status", { connected: false });
        if (this.pingInterval) clearInterval(this.pingInterval);
        // Auto-reconnect after 3s
        this.reconnectTimer = setTimeout(() => {
          this.connect(this.peerId, alias, unattendedPassword);
        }, 3000);
      };

      this.ws.onerror = (err) => {
        console.warn("[SignalingClient] WebSocket error:", err);
      };
    } catch (e) {
      console.error("[SignalingClient] Connection error:", e);
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case "registered":
        this.peerId = msg.id;
        this.trigger("registered", msg);
        break;
      case "incoming-call":
        this.trigger("incoming-call", msg);
        break;
      case "call-ringing":
        this.trigger("call-ringing", msg);
        break;
      case "call-accepted":
        this.trigger("call-accepted", msg);
        break;
      case "call-rejected":
        this.trigger("call-rejected", msg);
        break;
      case "call-error":
        this.trigger("call-error", msg);
        break;
      case "offer":
        this.trigger("offer", msg);
        break;
      case "answer":
        this.trigger("answer", msg);
        break;
      case "ice-candidate":
        this.trigger("ice-candidate", msg);
        break;
      case "session-ended":
      case "peer-disconnected":
        this.trigger("session-ended", msg);
        break;
      case "query-peer-result":
        this.trigger("query-peer-result", msg);
        break;
      default:
        this.trigger(msg.type, msg);
    }
  }

  callUser(targetId, callerAlias, password = null, connectionType = "full-control") {
    this.send({
      type: "call-user",
      targetId,
      callerAlias,
      password,
      connectionType
    });
  }

  acceptCall(callerId, permissions) {
    this.send({
      type: "accept-call",
      callerId,
      permissions
    });
  }

  rejectCall(callerId, reason) {
    this.send({
      type: "reject-call",
      callerId,
      reason
    });
  }

  sendOffer(targetId, sdp) {
    this.send({ type: "offer", targetId, sdp });
  }

  sendAnswer(targetId, sdp) {
    this.send({ type: "answer", targetId, sdp });
  }

  sendIceCandidate(targetId, candidate) {
    this.send({ type: "ice-candidate", targetId, candidate });
  }

  hangup() {
    this.send({ type: "hangup" });
  }

  setUnattendedPassword(password) {
    this.send({ type: "set-unattended-password", password });
  }

  setAlias(alias) {
    this.send({ type: "set-alias", alias });
  }

  queryPeer(targetId) {
    this.send({ type: "query-peer", targetId });
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
          console.error(`[SignalingClient] Handler error for ${event}:`, e);
        }
      });
    }
  }
}
