"use client";

export default function ErrorGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-CO">
      <body style={{ margin: 0, background: "#f5f0e6", color: "#1f1b16", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Apriscol no pudo abrirse</h1>
            <p style={{ margin: "0 0 20px", color: "#6b6457" }}>Inténtalo de nuevo en un momento.</p>
            <button
              onClick={reset}
              style={{ minHeight: 48, padding: "0 24px", borderRadius: 16, border: 0, background: "#2f5a45", color: "#fffdf8", fontSize: 16, fontWeight: 600 }}
            >
              Reintentar
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
