"use client";

import { useEffect, useId, useRef, useState } from "react";
import Script from "next/script";

export function googleButtonWidth(availableWidth: number): number {
  return Math.min(320, Math.max(1, Math.floor(availableWidth || 320)));
}

/**
 * Renders Google's own "Sign in with Google" button and hands the resulting ID
 * token to `onCredential`. A Google client ID is meant to be public — it is only
 * the client *secret* that must stay server-side, and this flow never uses the
 * secret at all: the ID token is verified against Google's published keys, not
 * exchanged through a server-side code flow.
 */
export function GoogleSignInButton({
  clientId,
  onCredential,
  label = "Continue with Google",
}: {
  clientId: string;
  onCredential: (credential: string) => Promise<void>;
  label?: string;
}) {
  const containerId = `google-signin-${useId().replace(/[:]/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onCredentialRef = useRef(onCredential);
  useEffect(() => {
    onCredentialRef.current = onCredential;
  });

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const google = window.google;
    if (!google) return;

    google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: { credential: string }) => {
        setPending(true);
        setError(null);
        try {
          await onCredentialRef.current(response.credential);
        } catch {
          setError("That Google sign-in could not be used. Try again.");
        } finally {
          setPending(false);
        }
      },
    });
    const container = containerRef.current;
    const render = () => {
      const width = googleButtonWidth(
        container.getBoundingClientRect().width || container.clientWidth,
      );
      container.replaceChildren();
      google.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
        width,
        text: "continue_with",
      });
    };
    render();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(render);
    observer.observe(container);
    return () => observer.disconnect();
  }, [ready, clientId]);

  return (
    <div className="grid w-full justify-items-center text-center">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div
        id={containerId}
        ref={containerRef}
        aria-label={label}
        className="flex w-full justify-center"
      />
      {pending ? (
        <p className="mt-2 text-sm text-(--pv-muted)" role="status">
          Signing in…
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-(--pv-danger)" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: { theme: string; size: string; width: number; text: string },
          ) => void;
        };
      };
    };
  }
}
