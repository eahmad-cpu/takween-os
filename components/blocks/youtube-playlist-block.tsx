"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  completeYoutubeEpisode,
  findFirstIncompleteEpisode,
  markYoutubeEpisodeOpened,
  saveYoutubeWatchProgress,
} from "@/lib/youtube-channel-actions";
import { YoutubeIframePlayer } from "@/components/blocks/youtube-iframe-player";

export function YoutubePlaylistBlock(props: {
  tenantId: string;
  blockId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [playlist, setPlaylist] = useState<any>(null);
  const [channel, setChannel] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [currentEpisodeId, setCurrentEpisodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef<{ sec: number; percent: number }>({
    sec: 0,
    percent: 0,
  });

  useEffect(() => {
    const unsubPlaylist = onSnapshot(
      doc(db, "tenants", props.tenantId, "nodes", props.blockId),
      (snap) => {
        const data = snap.exists()
          ? { id: snap.id, ...(snap.data() as any) }
          : null;
        setPlaylist(data);
      },
    );

    const unsubEpisodes = onSnapshot(
      query(
        collection(db, "tenants", props.tenantId, "nodes"),
        where("parentId", "==", props.blockId),
        where("type", "==", "item"),
        where("archived", "==", false),
        orderBy("orderKey"),
      ),
      (snap) => {
        setEpisodes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      },
    );

    return () => {
      unsubPlaylist();
      unsubEpisodes();
    };
  }, [props.blockId, props.tenantId]);

  useEffect(() => {
    if (!playlist?.parentId) return;
    return onSnapshot(
      doc(db, "tenants", props.tenantId, "nodes", playlist.parentId),
      (snap) => {
        setChannel(
          snap.exists() ? { id: snap.id, ...(snap.data() as any) } : null,
        );
      },
    );
  }, [playlist?.parentId, props.tenantId]);

  useEffect(() => {
    if (!episodes.length) return;

    const requested = searchParams.get("episode");
    const preferred =
      requested && episodes.some((x) => x.id === requested)
        ? requested
        : playlist?.lastOpenedEpisodeId &&
            episodes.some((x) => x.id === playlist.lastOpenedEpisodeId)
          ? playlist.lastOpenedEpisodeId
          : episodes.find((x) => !x.done)?.id || episodes[0]?.id || null;

    if (preferred && preferred !== currentEpisodeId) {
      setCurrentEpisodeId(preferred);
    }
  }, [episodes, playlist?.lastOpenedEpisodeId, searchParams, currentEpisodeId]);

  const currentEpisode = useMemo(
    () => episodes.find((x) => x.id === currentEpisodeId) || null,
    [episodes, currentEpisodeId],
  );

  useEffect(() => {
    if (!currentEpisodeId || !playlist || !channel) return;

    markYoutubeEpisodeOpened({
      tenantId: props.tenantId,
      channelBlockId: channel.id,
      playlistBlockId: playlist.id,
      episodeId: currentEpisodeId,
    });
  }, [channel, currentEpisodeId, playlist, props.tenantId]);

  async function goToEpisode(episodeId: string) {
    setCurrentEpisodeId(episodeId);
    router.replace(`/block/${props.blockId}?episode=${episodeId}`);
  }

  async function goNextAfter(currentId: string) {
    const idx = episodes.findIndex((x) => x.id === currentId);
    const nextInSame = idx >= 0 ? episodes[idx + 1] : null;

    if (nextInSame) {
      await goToEpisode(nextInSame.id);
      return;
    }

    if (!channel?.id) return;

    const siblingSnap = await getDocs(
      query(
        collection(db, "tenants", props.tenantId, "nodes"),
        where("parentId", "==", channel.id),
        where("type", "==", "block"),
        where("archived", "==", false),
        orderBy("orderKey"),
      ),
    );

    const siblings = siblingSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
    const currentPlaylistIndex = siblings.findIndex(
      (x) => x.id === props.blockId,
    );

    for (let i = currentPlaylistIndex + 1; i < siblings.length; i++) {
      const playlistBlock = siblings[i];
      const episodeId = await findFirstIncompleteEpisode({
        tenantId: props.tenantId,
        playlistBlockId: playlistBlock.id,
      });

      if (episodeId) {
        router.push(`/block/${playlistBlock.id}?episode=${episodeId}`);
        return;
      }
    }
  }

  if (!playlist) {
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border bg-background/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">قائمة تشغيل</div>
            <h1 className="font-bold">{playlist.title}</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            {playlist.doneEpisodes || 0} / {playlist.totalEpisodes || 0}
          </div>
        </div>

        {currentEpisode ? (
          <YoutubeIframePlayer
            videoId={currentEpisode.videoId}
            startSeconds={Number(currentEpisode.watchSeconds || 0)}
            autoplay
            onProgress={async ({ current, duration, percent }) => {
              const roundedSec = Math.round(current);
              const roundedPercent = Math.round(percent);

              if (
                Math.abs(roundedSec - lastSavedRef.current.sec) < 5 &&
                Math.abs(roundedPercent - lastSavedRef.current.percent) < 3
              ) {
                return;
              }

              lastSavedRef.current = {
                sec: roundedSec,
                percent: roundedPercent,
              };
              await saveYoutubeWatchProgress({
                tenantId: props.tenantId,
                episodeId: currentEpisode.id,
                watchSeconds: roundedSec,
                watchPercent: roundedPercent,
              });

              if (
                !currentEpisode.done &&
                (roundedPercent >= 90 ||
                  (duration > 0 && duration - roundedSec <= 10))
              ) {
                if (saving) return;
                setSaving(true);
                try {
                  await completeYoutubeEpisode({
                    tenantId: props.tenantId,
                    channelBlockId: channel.id,
                    playlistBlockId: playlist.id,
                    episodeId: currentEpisode.id,
                    durationSeconds: roundedSec,
                  });
                } finally {
                  setSaving(false);
                }
              }
            }}
            onEnded={async ({ duration }) => {
              if (!saving) {
                setSaving(true);
                try {
                  await completeYoutubeEpisode({
                    tenantId: props.tenantId,
                    channelBlockId: channel.id,
                    playlistBlockId: playlist.id,
                    episodeId: currentEpisode.id,
                    durationSeconds: duration,
                  });
                } finally {
                  setSaving(false);
                }
              }

              await goNextAfter(currentEpisode.id);
            }}
          />
        ) : (
          <div className="rounded-xl border p-4 text-muted-foreground">
            لا توجد حلقات في هذه القائمة.
          </div>
        )}
      </div>

      <div className="space-y-2">
        {episodes.map((ep, index) => {
          const active = ep.id === currentEpisodeId;
          return (
            <button
              key={ep.id}
              onClick={() => goToEpisode(ep.id)}
              className={[
                "w-full rounded-2xl border p-3 text-right transition",
                active
                  ? "border-foreground bg-muted"
                  : "bg-card hover:bg-muted/60",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    حلقة #{index + 1}
                  </div>
                  <div className="truncate font-medium">{ep.title}</div>
                </div>
                <div className="shrink-0 text-sm">
                  {ep.done ? "✅" : `${Math.round(ep.watchPercent || 0)}%`}
                </div>
              </div>
            </button>
          );
        })}

        {!episodes.length ? (
          <div className="rounded-2xl border bg-card p-4 text-muted-foreground">
            لا توجد حلقات.
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => channel?.id && router.push(`/block/${channel.id}`)}
        >
          رجوع إلى القناة
        </Button>
      </div>
    </div>
  );
}
