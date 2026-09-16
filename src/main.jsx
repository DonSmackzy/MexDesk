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
    console.error("[MexDesk Root ErrorBoundary]", error, errorInfo);
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
          backgroundColor: "#F8FAFC",
          color: "#1E293B",
          textAlign: "center"
        }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            backgroundColor: "#FEE2E2",
            color: "#EF4444",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            fontWeight: "bold",
            marginBottom: "16px"
          }}>
            M
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", margin: "0 0 8px 0" }}>
            MexDesk Encountered an Error
          </h2>
          <p style={{ fontSize: "12px", color: "#64748B", maxWidth: "420px", marginBottom: "16px" }}>
            {this.state.error?.message || "An unexpected error occurred while rendering the application interface."}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 18px",
              backgroundColor: "#E52E2E",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(229, 46, 46, 0.2)"
            }}
          >
            Reload MexDesk
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
