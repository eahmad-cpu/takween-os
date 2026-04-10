"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  findFirstIncompleteEpisode,
  saveImportedYouTubeChannel,
  startNewYouTubeChannelRun,
} from "@/lib/youtube-channel-actions";

export function YoutubeChannelBlock(props: {
  tenantId: string;
  blockId: string;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<any>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [channelUrl, setChannelUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubBlock = onSnapshot(
      doc(db, "tenants", props.tenantId, "nodes", props.blockId),
      (snap) => {
        const data = snap.exists()
          ? { id: snap.id, ...(snap.data() as any) }
          : null;
        setChannel(data);
        setChannelUrl(
          typeof data?.youtubeChannelUrl === "string"
            ? data.youtubeChannelUrl
            : "",
        );
        setLoading(false);
      },
    );

    const unsubPlaylists = onSnapshot(
      query(
        collection(db, "tenants", props.tenantId, "nodes"),
        where("parentId", "==", props.blockId),
        where("type", "==", "block"),
        where("archived", "==", false),
        orderBy("orderKey"),
      ),
      (snap) => {
        setPlaylists(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
        );
      },
    );

    return () => {
      unsubBlock();
      unsubPlaylists();
    };
  }, [props.blockId, props.tenantId]);

  const percent = useMemo(() => {
    const total = Number(channel?.totalEpisodes || 0);
    const done = Number(channel?.doneEpisodes || 0);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [channel]);

  async function handleImport() {
    try {
      setError("");
      setImporting(true);

      const res = await fetch("/api/youtube/import-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelUrl }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok || !json?.data) {
        throw new Error(json?.error || "فشل استيراد القناة.");
      }

      await saveImportedYouTubeChannel({
        tenantId: props.tenantId,
        channelBlockId: props.blockId,
        data: json.data,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ أثناء الاستيراد.");
    } finally {
      setImporting(false);
    }
  }

  async function handleContinue() {
    if (!channel) return;

    if (channel.resumePlaylistId && channel.resumeEpisodeId) {
      router.push(
        `/block/${channel.resumePlaylistId}?episode=${channel.resumeEpisodeId}`,
      );
      return;
    }

    for (const playlist of playlists) {
      const targetEpisodeId = await findFirstIncompleteEpisode({
        tenantId: props.tenantId,
        playlistBlockId: playlist.id,
      });

      if (targetEpisodeId) {
        router.push(`/block/${playlist.id}?episode=${targetEpisodeId}`);
        return;
      }
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">
              {channel?.title || "قناة يوتيوب"}
            </h1>
            <div className="text-sm text-muted-foreground">
              {channel?.youtubeHandle ||
                channel?.youtubeChannelId ||
                "لم يتم ربط القناة بعد"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleContinue}
              disabled={!playlists.length}
            >
              تابع
            </Button>

            {channel?.isRunComplete ? (
              <Button
                onClick={() =>
                  startNewYouTubeChannelRun({
                    tenantId: props.tenantId,
                    channelBlockId: props.blockId,
                  })
                }
              >
                ابدأ رحلة جديدة
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-background p-3">
            <div className="text-xs text-muted-foreground">قوائم التشغيل</div>
            <div className="text-2xl font-bold">
              {channel?.totalPlaylists || 0}
            </div>
          </div>
          <div className="rounded-xl border bg-background p-3">
            <div className="text-xs text-muted-foreground">الحلقات</div>
            <div className="text-2xl font-bold">
              {channel?.doneEpisodes || 0} / {channel?.totalEpisodes || 0}
            </div>
          </div>
          <div className="rounded-xl border bg-background p-3">
            <div className="text-xs text-muted-foreground">الختمات</div>
            <div className="text-2xl font-bold">
              {channel?.runsCompleted || 0}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span>التقدم العام</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-foreground transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">رابط القناة</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              placeholder="https://www.youtube.com/@channel"
            />
            <Button
              onClick={handleImport}
              disabled={importing || !channelUrl.trim()}
            >
              {importing
                ? "جارٍ الاستيراد..."
                : playlists.length
                  ? "إعادة الاستيراد"
                  : "استيراد"}
            </Button>
          </div>
          {error ? <div className="text-sm text-red-500">{error}</div> : null}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-bold">قوائم التشغيل</div>

        {playlists.map((playlist, index) => {
          const pTotal = Number(playlist.totalEpisodes || 0);
          const pDone = Number(playlist.doneEpisodes || 0);
          const pPercent = pTotal > 0 ? Math.round((pDone / pTotal) * 100) : 0;

          return (
            <div
              key={playlist.id}
              className="rounded-2xl border bg-card p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    قائمة #{index + 1}
                  </div>
                  <div className="font-bold">{playlist.title}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-muted-foreground">
                    {pDone} / {pTotal}
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/block/${playlist.id}`}>فتح</Link>
                  </Button>
                </div>
              </div>

              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{ width: `${pPercent}%` }}
                />
              </div>
            </div>
          );
        })}

        {!playlists.length ? (
          <div className="rounded-2xl border bg-card p-4 text-muted-foreground">
            لم يتم استيراد أي قوائم تشغيل بعد.
          </div>
        ) : null}
      </div>
    </div>
  );
}
