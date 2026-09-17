"use client";

/**
 * The last resort: the root layout itself threw, so there is no header, no
 * footer, and no globals.css — `global-error.tsx` replaces `<html>` entirely.
 *
 * Every style here is inline for that reason. A stylesheet that failed to load
 * is one of the ways a reader gets here, so this file must not need one.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0f0b07",
          color: "#f6f3ed",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "34rem" }}>
          <h1 style={{ fontSize: "1.75rem", margin: "0 0 1rem", lineHeight: 1.2 }}>
            Husk could not render this page.
          </h1>
          <p style={{ margin: "0 0 1rem", lineHeight: 1.6, color: "#c9c1b6" }}>
            The failure happened above the layout, so none of the usual page is
            available — including its stylesheet. Reloading often clears it.
          </p>
          {error.digest ? (
            <p style={{ margin: "0 0 1.5rem", color: "#c9c1b6" }}>
              Digest:{" "}
              <code style={{ fontFamily: "ui-monospace, monospace" }}>
                {error.digest}
              </code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              font: "inherit",
              padding: "0.6rem 1.1rem",
              borderRadius: "0.4rem",
              border: "1px solid #deb076",
              background: "#deb076",
              color: "#221a10",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
