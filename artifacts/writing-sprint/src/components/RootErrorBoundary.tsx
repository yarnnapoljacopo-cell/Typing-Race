import { Component, type ReactNode, type ErrorInfo } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, componentStack: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    try {
      void fetch(`${basePath}/api/log/client-error`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
          url: typeof window !== "undefined" ? window.location.href : "",
        }),
      }).catch(() => {});
    } catch {}
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = `${basePath}/`;
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          fontFamily: "Inter, sans-serif",
          background: "#FAF8F4",
          color: "#2D3142",
          textAlign: "center",
        }}
      >
        <img
          src={`${basePath}/logo.svg`}
          alt="Writing Sprint"
          style={{ width: 56, height: 56, borderRadius: 14 }}
        />
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
          Something broke on this page
        </h1>
        <p style={{ margin: 0, color: "#68708A", maxWidth: 420 }}>
          Your writing is safe. We've logged the issue. Try reloading — if it
          keeps happening, head back to the home page.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={this.handleReload}
            style={{
              padding: "0.6rem 1.4rem",
              background: "#1A6BC9",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
          <button
            onClick={this.handleGoHome}
            style={{
              padding: "0.6rem 1.4rem",
              background: "transparent",
              color: "#1A6BC9",
              border: "1px solid #1A6BC9",
              borderRadius: "0.5rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Go home
          </button>
        </div>
      </div>
    );
  }
}
