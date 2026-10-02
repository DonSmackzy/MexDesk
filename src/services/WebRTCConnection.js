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

    this.candidateQueue = [];
    this._wasEverConnected = false;

    // Adaptive quality and rate control
    this.qualityMode = localStorage.getItem("mexdesk_quality_profile") || "auto";
    this.currentTier = 4;
    this.consecutiveGoodIntervals = 0;

    let customTurn = null;
    try {
      const stored = localStorage.getItem("mexdesk_turn_config");
      if (stored) customTurn = JSON.parse(stored);
    } catch (e) {}

    this.iceServers = customTurn || [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stun.nextcloud.com:443" },
      { urls: "stun:global.stun.twilio.com:3478" },
      // Fallback TURN relay servers
      {
        urls: [
          "turn:openrelay.metered.ca:80",
          "turn:openrelay.metered.ca:443",
          "turns:openrelay.metered.ca:443?transport=tcp"
        ],
        username: "openrelay",
        credential: "openrelay"
      }
    ];
  }

  async init(localStream = null) {
    this.localStream = localStream;

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    });

    // Collect codec preferences (prioritizing VP9, VP8, H264)
    let preferredVideoCodecs = null;
    if ("RTCRtpReceiver" in window && typeof RTCRtpReceiver.getCapabilities === "function") {
      try {
        const capabilities = RTCRtpReceiver.getCapabilities("video");
        if (capabilities && capabilities.codecs) {
          const vp9 = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() === "video/vp9");
          const vp8 = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() === "video/vp8");
          const h264 = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() === "video/h264");
          const others = capabilities.codecs.filter(
            (c) => !["video/vp9", "video/vp8", "video/h264"].includes(c.mimeType.toLowerCase())
          );
          preferredVideoCodecs = [...vp9, ...vp8, ...h264, ...others];
        }
      } catch (e) {}
    }

    // In modern WebRTC Unified Plan: If initiator is receiving (viewer), declare recvonly transceivers
    if (this.isInitiator && !this.localStream) {
      try {
        const videoTransceiver = this.peerConnection.addTransceiver("video", { direction: "recvonly" });
        const audioTransceiver = this.peerConnection.addTransceiver("audio", { direction: "recvonly" });
        if (videoTransceiver && typeof videoTransceiver.setCodecPreferences === "function" && preferredVideoCodecs) {
          try {
            videoTransceiver.setCodecPreferences(preferredVideoCodecs);
          } catch (e) {}
        }
        if (videoTransceiver?.receiver && "playoutDelayHint" in videoTransceiver.receiver) {
          videoTransceiver.receiver.playoutDelayHint = 0; // Zero latency playout for instant responsiveness
        }
        if (audioTransceiver?.receiver && "playoutDelayHint" in audioTransceiver.receiver) {
          audioTransceiver.receiver.playoutDelayHint = 0; // Synchronized zero audio playout delay
        }
      } catch (err) {
        console.warn("[WebRTC] addTransceiver fallback:", err);
      }
    }

    // Add local tracks if host is sharing screen with smoothness optimizations
    if (this.localStream) {
      const qualityProfile = localStorage.getItem("mexdesk_quality_profile") || "adaptive";
      const fpsLimit = parseInt(localStorage.getItem("mexdesk_fps_limit") || "60", 10);

      this.localStream.getTracks().forEach((track) => {
        console.log(`[WebRTC] Adding local track: ${track.kind} (${track.id}) enabled=${track.enabled}`);
        if (track.kind === "video" && "contentHint" in track) {
          track.contentHint = qualityProfile === "crisp" ? "detail" : "motion";
        }
        if (track.kind === "audio" && "contentHint" in track) {
          track.contentHint = "music"; // High-fidelity loopback system audio
        }
        const sender = this.peerConnection.addTrack(track, this.localStream);
        if (track.kind === "video" && sender && sender.getParameters) {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            // "maintain-framerate": Prioritize fluid cursor & animation over pixel perfection on slow connections
            params.degradationPreference = "maintain-framerate";
            if (fpsLimit > 0) {
              params.encodings[0].maxFramerate = fpsLimit;
            }
            sender.setParameters(params).catch(() => {});
          } catch (e) {
            console.warn("[WebRTC] sender parameters tweak skipped:", e);
          }
        }
      });

      // Apply codec preferences on host transceivers if supported
      if (preferredVideoCodecs) {
        try {
          const transceivers = this.peerConnection.getTransceivers();
          const videoTransceiver = transceivers.find((t) => t.sender?.track?.kind === "video");
          if (videoTransceiver && typeof videoTransceiver.setCodecPreferences === "function") {
            videoTransceiver.setCodecPreferences(preferredVideoCodecs);
          }
        } catch (e) {}
      }
    }

    // Handle remote track (client viewing host screen and listening to desktop audio)
    this.peerConnection.ontrack = (event) => {
      console.log(`[WebRTC] ontrack received track: ${event.track.kind} (${event.track.id})`);
      if (event.receiver && "playoutDelayHint" in event.receiver) {
        event.receiver.playoutDelayHint = 0; // Eliminate playout delay
      }
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
      }
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
      console.log(`[WebRTC] PeerConnection state changed: ${state}`);
      this.trigger("connection-state", state);
      if (state === "connected") {
        this.startStatsMonitoring();
      } else if (state === "disconnected" || state === "failed" || state === "closed") {
        this.stopStatsMonitoring();
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection.iceConnectionState;
      console.log(`[WebRTC] ICE Connection state: ${iceState}`);
      this.trigger("ice-connection-state", iceState);
      if (iceState === "connected" || iceState === "completed") {
        this._wasEverConnected = true;
      }
      if (iceState === "failed" && this._wasEverConnected) {
        // Only auto-restart if we were previously connected — avoid interfering with initial negotiation
        this.restartIce().catch((err) => console.warn("[WebRTC] Auto restartIce failed:", err));
      }
    };

    // Listen for peer ice-restart-request over signaling
    if (this.signaling) {
      this.signaling.on("ice-restart-request", async (msg) => {
        const sender = msg.senderId || msg.from;
        if (sender === this.targetPeerId && this.isInitiator) {
          console.log(`[WebRTC] Peer requested ICE restart, renewing offer...`);
          await this.restartIce();
        }
      });
    }

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
      console.log(`[WebRTC] DataChannel '${name}' is now OPEN`);
      this.trigger("channel-open", { name });
    };

    channel.onclose = () => {
      console.log(`[WebRTC] DataChannel '${name}' CLOSED`);
      this.trigger("channel-close", { name });
    };

    channel.onmessage = (event) => {
      if (name === "file" && event.data instanceof ArrayBuffer) {
        this.trigger("file-chunk", event.data);
      } else {
        try {
          const parsed = JSON.parse(event.data);
          if (name === "control") {
            if (parsed.type === "set-quality-mode") {
              this.setQualityMode(parsed.mode);
            } else if (parsed.type === "network-telemetry") {
              this.handleNetworkTelemetry(parsed);
            }
          }
          this.trigger(`${name}-message`, parsed);
        } catch (e) {
          this.trigger(`${name}-raw`, event.data);
        }
      }
    };
  }

  async createOffer(options = {}) {
    if (!this.peerConnection) return;
    try {
      const offer = await this.peerConnection.createOffer(options);
      await this.peerConnection.setLocalDescription(offer);
      this.signaling.sendOffer(this.targetPeerId, offer);
    } catch (err) {
      console.error("[WebRTC] createOffer error:", err);
    }
  }

  async restartIce() {
    if (!this.peerConnection) return;
    try {
      console.log(`[WebRTC] Initiating ICE restart for ${this.targetPeerId}...`);
      if (this.isInitiator) {
        if (typeof this.peerConnection.restartIce === "function") {
          this.peerConnection.restartIce();
        }
        await this.createOffer({ iceRestart: true });
      } else {
        // Notify initiator to create an iceRestart offer
        if (this.signaling?.requestIceRestart) {
          this.signaling.requestIceRestart(this.targetPeerId);
        }
      }
    } catch (err) {
      console.error("[WebRTC] restartIce error:", err);
    }
  }

  async handleOffer(offer) {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    await this.processQueuedCandidates();

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.signaling.sendAnswer(this.targetPeerId, answer);
  }

  async handleAnswer(answer) {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await this.processQueuedCandidates();
  }

  async handleIceCandidate(candidate) {
    if (!this.peerConnection) return;
    // Guard against race condition: if remote description is not set yet, queue candidate
    if (!this.peerConnection.remoteDescription || !this.peerConnection.remoteDescription.type) {
      this.candidateQueue.push(candidate);
      return;
    }
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("[WebRTC] Error adding ICE candidate:", e);
    }
  }

  async processQueuedCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    while (this.candidateQueue.length > 0) {
      const candidate = this.candidateQueue.shift();
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("[WebRTC] Error processing queued candidate:", e);
      }
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

  async applyEncodingParameters({ maxBitrate, maxFramerate, scaleResolutionDownBy }) {
    if (!this.peerConnection) return;
    try {
      const senders = this.peerConnection.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === "video");
      if (!videoSender || !videoSender.getParameters) return;

      const params = videoSender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }

      let changed = false;
      const enc = params.encodings[0];

      if (enc.maxBitrate !== maxBitrate) {
        enc.maxBitrate = maxBitrate;
        changed = true;
      }
      if (enc.maxFramerate !== maxFramerate) {
        enc.maxFramerate = maxFramerate;
        changed = true;
      }
      if (enc.scaleResolutionDownBy !== scaleResolutionDownBy) {
        enc.scaleResolutionDownBy = scaleResolutionDownBy;
        changed = true;
      }

      if (changed) {
        params.degradationPreference = "maintain-framerate";
        await videoSender.setParameters(params);
        console.log(`[WebRTC Quality] Applied params: ${Math.round(maxBitrate / 1000)} kbps, ${maxFramerate} fps, scale: ${scaleResolutionDownBy}`);
      }
    } catch (err) {
      console.warn("[WebRTC Quality] applyEncodingParameters error:", err.message);
    }
  }

  async setQualityMode(mode) {
    this.qualityMode = mode;
    console.log(`[WebRTC Quality] Quality mode changed: ${mode}`);
    if (mode === "high") {
      await this.applyEncodingParameters({ maxBitrate: 4000000, maxFramerate: 60, scaleResolutionDownBy: 1.0 });
    } else if (mode === "balanced") {
      await this.applyEncodingParameters({ maxBitrate: 2000000, maxFramerate: 30, scaleResolutionDownBy: 1.0 });
    } else if (mode === "speed") {
      await this.applyEncodingParameters({ maxBitrate: 700000, maxFramerate: 20, scaleResolutionDownBy: 1.5 });
    } else {
      this.applyTier(this.currentTier);
    }
  }

  handleNetworkTelemetry({ rtt = 0, packetLoss = 0 }) {
    if (this.qualityMode !== "auto") return;

    let targetTier = 4;
    if (rtt > 450 || packetLoss > 15) {
      targetTier = 0;
    } else if (rtt > 250 || packetLoss > 8) {
      targetTier = 1;
    } else if (rtt > 120 || packetLoss > 3) {
      targetTier = 2;
    } else if (rtt > 60 || packetLoss > 1) {
      targetTier = 3;
    } else {
      targetTier = 4;
    }

    if (targetTier < this.currentTier) {
      // Step down immediately on packet loss or latency spike
      this.currentTier = targetTier;
      this.consecutiveGoodIntervals = 0;
      this.applyTier(this.currentTier);
    } else if (targetTier > this.currentTier) {
      // Require 2 consecutive good intervals before stepping up to avoid oscillation
      this.consecutiveGoodIntervals = (this.consecutiveGoodIntervals || 0) + 1;
      if (this.consecutiveGoodIntervals >= 2) {
        this.currentTier += 1;
        this.consecutiveGoodIntervals = 0;
        this.applyTier(this.currentTier);
      }
    } else {
      this.consecutiveGoodIntervals = 0;
    }
  }

  applyTier(tier) {
    const tiers = {
      4: { maxBitrate: 4000000, maxFramerate: 60, scaleResolutionDownBy: 1.0 },
      3: { maxBitrate: 2500000, maxFramerate: 60, scaleResolutionDownBy: 1.0 },
      2: { maxBitrate: 1200000, maxFramerate: 30, scaleResolutionDownBy: 1.25 },
      1: { maxBitrate: 600000, maxFramerate: 20, scaleResolutionDownBy: 1.5 },
      0: { maxBitrate: 300000, maxFramerate: 15, scaleResolutionDownBy: 2.0 },
    };
    const settings = tiers[tier] || tiers[4];
    this.applyEncodingParameters(settings);
  }

  startStatsMonitoring() {
    this.stopStatsMonitoring();
    let prevBytes = 0;
    let prevTimestamp = Date.now();
    let prevPacketsLost = 0;
    let prevPacketsReceived = 0;
    let telemetryCounter = 0;

    this.statsTimer = setInterval(async () => {
      if (!this.peerConnection) return;
      try {
        const stats = await this.peerConnection.getStats();
        let fps = 0;
        let bitrate = 0;
        let latency = 0;
        let packetLoss = 0;
        let width = 0;
        let height = 0;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            fps = Math.round(report.framesPerSecond || 0);
            width = report.frameWidth || 0;
            height = report.frameHeight || 0;

            const now = Date.now();
            const bytes = report.bytesReceived || 0;
            if (prevBytes > 0 && now > prevTimestamp) {
              bitrate = Math.round(((bytes - prevBytes) * 8) / ((now - prevTimestamp) / 1000) / 1000); // kbps
            }
            prevBytes = bytes;
            prevTimestamp = now;

            const currentLost = report.packetsLost || 0;
            const currentRecv = report.packetsReceived || 0;
            const deltaLost = Math.max(0, currentLost - prevPacketsLost);
            const deltaRecv = Math.max(0, currentRecv - prevPacketsReceived);
            const total = deltaLost + deltaRecv;
            if (total > 0) {
              packetLoss = Math.min(100, Math.round((deltaLost / total) * 1000) / 10);
            }
            prevPacketsLost = currentLost;
            prevPacketsReceived = currentRecv;
          }

          if (report.type === "candidate-pair" && report.state === "succeeded") {
            latency = Math.round((report.currentRoundTripTime || 0) * 1000); // ms
          }

          // Host side RTCP remote-inbound-rtp inspection
          if (report.type === "remote-inbound-rtp" && report.kind === "video") {
            const fraction = report.fractionLost || 0;
            const rtcpLoss = Math.min(100, Math.round(fraction * 1000) / 10);
            const rtcpRtt = Math.round((report.roundTripTime || 0) * 1000);
            if (this.localStream && this.qualityMode === "auto") {
              this.handleNetworkTelemetry({ rtt: rtcpRtt, packetLoss: rtcpLoss });
            }
          }
        });

        this.trigger("stats", {
          fps,
          bitrate,
          latency,
          packetLoss,
          width,
          height,
          qualityMode: this.qualityMode,
          tier: this.currentTier,
        });

        // Viewer sends periodic network telemetry to host every 2 seconds
        telemetryCounter++;
        if (!this.localStream && telemetryCounter >= 2) {
          telemetryCounter = 0;
          this.send("control", {
            type: "network-telemetry",
            rtt: latency,
            packetLoss,
            fps,
            bitrate,
          });
        }
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
