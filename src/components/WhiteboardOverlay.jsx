import React, { useRef, useState, useEffect } from "react";
import {
  PenTool,
  Highlighter,
  Square,
  ArrowUpRight,
  Eraser,
  Trash2,
  X,
  Undo2
} from "lucide-react";

export function WhiteboardOverlay({ webrtc, onClose }) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState("pen"); // pen, highlighter, rectangle, arrow, eraser
  const [color, setColor] = useState("#E52E2E"); // Default iconic AnyDesk red!
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState([]);

  const currentStrokeRef = useRef([]);

  const colors = [
    { name: "MexDesk Red", value: "#E52E2E" },
    { name: "Blue", value: "#2563EB" },
    { name: "Emerald", value: "#10B981" },
    { name: "Amber", value: "#F59E0B" },
    { name: "White", value: "#FFFFFF" },
    { name: "Black", value: "#0F172A" },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions to container
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
      redrawHistory();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Listen to remote whiteboard sync
    if (webrtc) {
      const unsub = webrtc.on("whiteboard-message", (msg) => {
        if (msg.type === "draw_stroke") {
          applyRemoteStroke(msg.stroke);
        } else if (msg.type === "clear") {
          clearCanvasLocal();
        }
      });
      return () => {
        window.removeEventListener("resize", resizeCanvas);
        unsub();
      };
    }

    return () => window.removeEventListener("resize", resizeCanvas);
  }, [webrtc]);

  const redrawHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    history.forEach((stroke) => {
      drawStrokeOnContext(ctx, stroke);
    });
  };

  const drawStrokeOnContext = (ctx, stroke) => {
    if (!stroke || stroke.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.tool === "highlighter") {
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = stroke.width * 2.5;
    } else if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = stroke.width * 3;
    }

    if (stroke.tool === "rectangle") {
      const p1 = stroke.points[0];
      const p2 = stroke.points[stroke.points.length - 1];
      ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    } else if (stroke.tool === "arrow") {
      const p1 = stroke.points[0];
      const p2 = stroke.points[stroke.points.length - 1];
      drawArrow(ctx, p1.x, p1.y, p2.x, p2.y);
    } else {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawArrow = (ctx, fromX, fromY, toX, toY) => {
    const headlen = 14;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const applyRemoteStroke = (stroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    drawStrokeOnContext(ctx, stroke);
    setHistory((prev) => [...prev, stroke]);
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    currentStrokeRef.current = [{ x, y }];
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentStrokeRef.current.push({ x, y });

    const ctx = canvas.getContext("2d");
    const currentStroke = {
      tool,
      color,
      width: lineWidth,
      points: currentStrokeRef.current,
    };

    redrawHistory();
    drawStrokeOnContext(ctx, currentStroke);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStrokeRef.current.length > 1) {
      const stroke = {
        tool,
        color,
        width: lineWidth,
        points: currentStrokeRef.current,
      };
      setHistory((prev) => [...prev, stroke]);

      // Broadcast to peer
      if (webrtc) {
        webrtc.send("whiteboard", {
          type: "draw_stroke",
          stroke,
        });
      }
    }
    currentStrokeRef.current = [];
  };

  const handleClear = () => {
    clearCanvasLocal();
    if (webrtc) {
      webrtc.send("whiteboard", { type: "clear" });
    }
  };

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHistory([]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const newHist = history.slice(0, -1);
    setHistory(newHist);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    newHist.forEach((s) => drawStrokeOnContext(ctx, s));
  };

  return (
    <div className="absolute inset-0 z-20 pointer-events-auto cursor-crosshair">
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="w-full h-full"
      />

      {/* FLOATING WHITEBOARD TOOLBAR */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-2 shadow-floating flex items-center space-x-2 text-slate-700 cursor-default">
        {/* Tools */}
        <div className="flex items-center space-x-1 border-r border-slate-200 pr-2">
          <button
            onClick={() => setTool("pen")}
            className={`p-2 rounded-xl transition ${
              tool === "pen" ? "bg-mexdesk-red text-white" : "hover:bg-slate-100 text-slate-600"
            }`}
            title="Pen"
          >
            <PenTool size={16} />
          </button>
          <button
            onClick={() => setTool("highlighter")}
            className={`p-2 rounded-xl transition ${
              tool === "highlighter" ? "bg-mexdesk-red text-white" : "hover:bg-slate-100 text-slate-600"
            }`}
            title="Highlighter"
          >
            <Highlighter size={16} />
          </button>
          <button
            onClick={() => setTool("arrow")}
            className={`p-2 rounded-xl transition ${
              tool === "arrow" ? "bg-mexdesk-red text-white" : "hover:bg-slate-100 text-slate-600"
            }`}
            title="Arrow"
          >
            <ArrowUpRight size={16} />
          </button>
          <button
            onClick={() => setTool("rectangle")}
            className={`p-2 rounded-xl transition ${
              tool === "rectangle" ? "bg-mexdesk-red text-white" : "hover:bg-slate-100 text-slate-600"
            }`}
            title="Rectangle"
          >
            <Square size={16} />
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={`p-2 rounded-xl transition ${
              tool === "eraser" ? "bg-mexdesk-red text-white" : "hover:bg-slate-100 text-slate-600"
            }`}
            title="Eraser"
          >
            <Eraser size={16} />
          </button>
        </div>

        {/* Colors */}
        <div className="flex items-center space-x-1.5 border-r border-slate-200 pr-2">
          {colors.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              className={`w-5 h-5 rounded-full border transition transform ${
                color === c.value ? "scale-125 ring-2 ring-mexdesk-red ring-offset-1" : "hover:scale-110"
              }`}
              style={{ backgroundColor: c.value, borderColor: c.value === "#FFFFFF" ? "#CBD5E1" : "transparent" }}
              title={c.name}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-1">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 disabled:opacity-40 transition"
            title="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={handleClear}
            className="p-2 rounded-xl hover:bg-rose-50 text-slate-600 hover:text-mexdesk-red transition"
            title="Clear All"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition ml-1"
            title="Exit Whiteboard"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
