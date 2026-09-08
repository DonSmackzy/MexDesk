import React, { useState, useEffect, useRef } from "react";
import { Send, X, MessageSquare, Clock, CheckCheck } from "lucide-react";

export function ChatDrawer({ webrtc, targetPeerId, onClose }) {
  const [messages, setMessages] = useState([
    {
      id: "system_1",
      sender: "system",
      text: "Encrypted P2P chat session initiated.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef(null);

  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  };

  useEffect(() => {
    if (!webrtc) return;

    const unsubscribe = webrtc.on("chat-message", (msg) => {
      setMessages((prev) => [
        ...prev,
        {
          id: "m_" + Date.now(),
          sender: "remote",
          text: msg.text,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      playNotificationSound();
    });

    return unsubscribe;
  }, [webrtc]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    if (!text) return;

    const newMsg = {
      id: "m_" + Date.now(),
      sender: "me",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage("");

    if (webrtc) {
      webrtc.send("chat", { text });
    }
  };

  const sendQuickReply = (text) => {
    setInputMessage(text);
  };

  return (
    <div className="absolute top-0 right-0 bottom-0 w-80 bg-white/95 backdrop-blur-md border-l border-slate-200 shadow-2xl z-40 flex flex-col">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-white">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-mexdesk-lightred flex items-center justify-center text-mexdesk-red">
            <MessageSquare size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800">In-Session Chat</h3>
            <p className="text-[10px] font-mono text-slate-400">{targetPeerId}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.sender === "me"
                ? "items-end"
                : m.sender === "system"
                ? "items-center"
                : "items-start"
            }`}
          >
            {m.sender === "system" ? (
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full my-1">
                {m.text}
              </span>
            ) : (
              <div className="max-w-[85%] space-y-0.5">
                <div
                  className={`p-3 rounded-2xl text-xs ${
                    m.sender === "me"
                      ? "bg-mexdesk-red text-white rounded-br-none shadow-sm"
                      : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                </div>
                <div
                  className={`flex items-center space-x-1 text-[10px] text-slate-400 px-1 ${
                    m.sender === "me" ? "justify-end" : "justify-start"
                  }`}
                >
                  <span>{m.time}</span>
                  {m.sender === "me" && <CheckCheck size={11} className="text-slate-400" />}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Responses */}
      <div className="px-3 py-1.5 border-t border-slate-100 flex items-center space-x-1 overflow-x-auto text-[10px] text-slate-500 bg-slate-50/50">
        <button
          onClick={() => sendQuickReply("Please grant keyboard control.")}
          className="px-2 py-1 bg-white border border-slate-200 rounded-full hover:bg-slate-100 whitespace-nowrap"
        >
          Request control
        </button>
        <button
          onClick={() => sendQuickReply("Transferring files now...")}
          className="px-2 py-1 bg-white border border-slate-200 rounded-full hover:bg-slate-100 whitespace-nowrap"
        >
          Sending files
        </button>
        <button
          onClick={() => sendQuickReply("Thanks!")}
          className="px-2 py-1 bg-white border border-slate-200 rounded-full hover:bg-slate-100 whitespace-nowrap"
        >
          Thanks!
        </button>
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white flex items-center space-x-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type message..."
          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-mexdesk-red focus:border-transparent transition"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim()}
          className="p-2 rounded-xl bg-mexdesk-red hover:bg-mexdesk-crimson text-white transition disabled:opacity-40 shadow-sm"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
