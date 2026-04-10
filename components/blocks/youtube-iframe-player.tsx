/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type ProgressPayload = {
  current: number;
  duration: number;
  percent: number;
};

function loadYoutubeApi(): Promise<any> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("window unavailable"));
  if (window.YT?.Player) return Promise.resolve(window.YT);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("تعذر تحميل YouTube IFrame API"));
      document.head.appendChild(script);
    }

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
  });
}

export function YoutubeIframePlayer(props: {
  videoId: string;
  startSeconds?: number;
  autoplay?: boolean;
  onProgress?: (payload: ProgressPayload) => void;
  onEnded?: (payload: ProgressPayload) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadYoutubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;

        playerRef.current = new YT.Player(hostRef.current, {
          width: "100%",
          height: "100%",
          videoId: props.videoId,
          playerVars: {
            autoplay: props.autoplay ? 1 : 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              readyRef.current = true;
              if (props.startSeconds && props.startSeconds > 0) {
                playerRef.current?.seekTo(props.startSeconds, true);
              }
            },
            onStateChange: (event: any) => {
              const duration = Number(playerRef.current?.getDuration?.() || 0);
              const current = Number(
                playerRef.current?.getCurrentTime?.() || 0,
              );
              const percent = duration > 0 ? (current / duration) * 100 : 0;

              if (event.data === YT.PlayerState.ENDED) {
                props.onEnded?.({ current, duration, percent: 100 });
              }
            },
            onError: () => {
              setError("الفيديو لا يعمل داخل المشغّل المضمّن.");
            },
          },
        });
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "تعذر تحميل مشغّل يوتيوب.");
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!readyRef.current || !playerRef.current || !props.videoId) return;

    const startSeconds = Math.max(0, props.startSeconds || 0);
    playerRef.current.loadVideoById({
      videoId: props.videoId,
      startSeconds,
    });
  }, [props.videoId, props.startSeconds]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!playerRef.current?.getCurrentTime) return;
      const duration = Number(playerRef.current.getDuration() || 0);
      const current = Number(playerRef.current.getCurrentTime() || 0);
      const percent = duration > 0 ? (current / duration) * 100 : 0;
      props.onProgress?.({ current, duration, percent });
    }, 5000);

    return () => window.clearInterval(id);
  }, [props]);

  if (error) {
    return (
      <div className="rounded-xl border p-4 text-sm text-red-500">{error}</div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl border bg-black">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
