import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[AegisDesk Root ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#0F172A",
          color: "#F8FAFC",
          textAlign: "center"
        }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            backgroundColor: "#4F46E5",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            fontWeight: "bold",
            marginBottom: "16px"
          }}>
            A
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", margin: "0 0 8px 0" }}>
            AegisDesk Encountered an Error
          </h2>
          <p style={{ fontSize: "12px", color: "#94A3B8", maxWidth: "420px", marginBottom: "16px" }}>
            {this.state.error?.message || "An unexpected error occurred while rendering the application interface."}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 18px",
              backgroundColor: "#4F46E5",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(79, 70, 229, 0.4)"
            }}
          >
            Reload AegisDesk
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
