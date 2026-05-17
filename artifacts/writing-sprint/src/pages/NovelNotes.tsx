import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function NovelNotes() {
  const [, navigate] = useLocation();
  const { getToken, isSignedIn } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const serverDataRef = useRef<unknown>(null);
  const iframeReadyRef = useRef(false);

  const sendDataToIframe = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "nn:init", data: { nnData: serverDataRef.current } },
      "*",
    );
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    getToken().then((token) => {
      if (!token) return;
      fetch(`${basePath}/api/novel-notes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          serverDataRef.current = d.nnData ?? null;
          if (iframeReadyRef.current) sendDataToIframe();
        })
        .catch(() => {});
    });
  }, [isSignedIn, getToken, sendDataToIframe]);

  useEffect(() => {
    const goBack = () => navigate("/my-files");
    const handler = (e: MessageEvent) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      const msg = e.data as { type: string; data?: unknown };
      if (msg.type === "nn:ready") {
        iframeReadyRef.current = true;
        if (serverDataRef.current !== null) sendDataToIframe();
      } else if (msg.type === "nn:back") {
        goBack();
      } else if (msg.type === "nn:save" && isSignedIn) {
        getToken().then((token) => {
          if (!token) return;
          fetch(`${basePath}/api/novel-notes`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ nnData: msg.data }),
          }).catch(() => {});
        });
      }
    };
    window.addEventListener("nn:back", goBack);
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("nn:back", goBack);
      window.removeEventListener("message", handler);
    };
  }, [isSignedIn, getToken, navigate, sendDataToIframe]);

  return (
    <div style={{ height: "100dvh", overflow: "hidden" }}>
      <iframe
        ref={iframeRef}
        src="/novel-notes.html"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        title="Novel Notes"
      />
    </div>
  );
}
