// WebRTCConnection.js - Manages WebRTC PeerConnection, MediaStreams, and DataChannels

export class WebRTCConnection {
  constructor(signaling, targetPeerId, isInitiator = false) {
    this.signaling = signaling;
    this.targetPeerId = targetPeerId;
    this.isInitiator = isInitiator;

    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;

    // Data channels
    this.channels = {
      control: null,
      file: null,
      chat: null,
      whiteboard: null,
      clipboard: null,
    };

    this.handlers = new Map();
    this.statsTimer = null;

    this.iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun.services.mozilla.com" },
      { urls: "stun:global.stun.twilio.com:3478" }
    ];
  }

  async init(localStream = null) {
    this.localStream = localStream;

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    });

    // Add local tracks if host is sharing screen
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle remote track (client viewing host screen)
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0] || new MediaStream([event.track]);
      this.trigger("remote-stream", this.remoteStream);
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate(this.targetPeerId, event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this.trigger("connection-state", state);
      if (state === "connected") {
        this.startStatsMonitoring();
      } else if (state === "disconnected" || state === "failed" || state === "closed") {
        this.stopStatsMonitoring();
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection.iceConnectionState;
      if (iceState === "failed") {
        try {
          if (typeof this.peerConnection.restartIce === "function") {
            this.peerConnection.restartIce();
          }
        } catch (e) {}
      }
    };

    // If initiator, create data channels
    if (this.isInitiator) {
      this.createDataChannels();
    } else {
      // Receiver listens for incoming data channels
      this.peerConnection.ondatachannel = (event) => {
        const channel = event.channel;
        this.setupDataChannel(channel.label, channel);
      };
    }
  }

  createDataChannels() {
    const channelNames = ["control", "file", "chat", "whiteboard", "clipboard"];
    channelNames.forEach((name) => {
      const reliable = name !== "control"; // control channel can have low latency ordered=false if needed, but ordered=true is safe
      const channel = this.peerConnection.createDataChannel(name, {
        ordered: true,
      });
      this.setupDataChannel(name, channel);
    });
  }

  setupDataChannel(name, channel) {
    this.channels[name] = channel;

    if (name === "file") {
      channel.binaryType = "arraybuffer";
    }

    channel.onopen = () => {
      this.trigger("channel-open", { name });
    };

    channel.onclose = () => {
      this.trigger("channel-close", { name });
    };

    channel.onmessage = (event) => {
      if (name === "file" && event.data instanceof ArrayBuffer) {
        this.trigger("file-chunk", event.data);
      } else {
        try {
          const parsed = JSON.parse(event.data);
          this.trigger(`${name}-message`, parsed);
        } catch (e) {
          this.trigger(`${name}-raw`, event.data);
        }
      }
    };
  }

  async createOffer() {
    if (!this.peerConnection) return;
    const offer = await this.peerConnection.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true,
    });
    await this.peerConnection.setLocalDescription(offer);
    this.signaling.sendOffer(this.targetPeerId, offer);
  }

  async handleOffer(offer) {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.signaling.sendAnswer(this.targetPeerId, answer);
  }

  async handleAnswer(answer) {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleIceCandidate(candidate) {
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("[WebRTC] Error adding ICE candidate:", e);
    }
  }

  send(channelName, data) {
    const channel = this.channels[channelName];
    if (channel && channel.readyState === "open") {
      if (typeof data === "object" && !(data instanceof ArrayBuffer)) {
        channel.send(JSON.stringify(data));
      } else {
        channel.send(data);
      }
      return true;
    }
    return false;
  }

  startStatsMonitoring() {
    this.stopStatsMonitoring();
    let prevBytes = 0;
    let prevTimestamp = Date.now();

    this.statsTimer = setInterval(async () => {
      if (!this.peerConnection) return;
      try {
        const stats = await this.peerConnection.getStats();
        let fps = 0;
        let bitrate = 0;
        let latency = 0;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            fps = report.framesPerSecond || 0;
            const now = Date.now();
            const bytes = report.bytesReceived || 0;
            if (prevBytes > 0) {
              bitrate = Math.round(((bytes - prevBytes) * 8) / ((now - prevTimestamp) / 1000) / 1000); // kbps
            }
            prevBytes = bytes;
            prevTimestamp = now;
          }
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            latency = Math.round((report.currentRoundTripTime || 0) * 1000); // ms
          }
        });

        this.trigger("stats", { fps, bitrate, latency });
      } catch (e) {
        // ignore stats errors
      }
    }, 1000);
  }

  stopStatsMonitoring() {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  close() {
    this.stopStatsMonitoring();
    Object.values(this.channels).forEach((ch) => {
      if (ch) ch.close();
    });
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
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
          console.error(`[WebRTC] Handler error for ${event}:`, e);
        }
      });
    }
  }
}
