"use client";

/**
 * Last-resort boundary: the root layout itself failed, so this renders its own
 * document and cannot rely on the design system or the shell.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#fbfaf8",
          color: "#1c1b19",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 500, margin: 0 }}>
            The application couldn&rsquo;t start.
          </h1>
          <p style={{ marginTop: "0.75rem", color: "#57544e" }}>
            Your journal files are untouched. Restarting usually resolves this.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.6rem 1.1rem",
              borderRadius: "0.375rem",
              border: "none",
              background: "#2f5d8a",
              color: "#fff",
              fontSize: "0.9375rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
