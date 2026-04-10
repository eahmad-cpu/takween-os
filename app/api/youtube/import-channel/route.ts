import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ImportedEpisode = {
  title: string;
  url: string;
  videoId: string;
  position: number;
  thumbnailUrl: string | null;
};

type ImportedPlaylist = {
  playlistId: string;
  title: string;
  itemCount: number;
  thumbnailUrl: string | null;
  position: number;
  episodes: ImportedEpisode[];
};

type ImportedChannel = {
  channelId: string;
  title: string;
  handle: string | null;
  url: string;
  thumbnailUrl: string | null;
  playlists: ImportedPlaylist[];
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function extractChannelRef(raw: string) {
  const value = raw.trim();
  if (!value) throw new Error("أدخل رابط القناة أولًا.");

  // channel id مباشر
  if (/^UC[\w-]{20,}$/.test(value)) {
    return { mode: "id" as const, value };
  }

  // handle مباشر مثل: @mychannel
  if (/^@[A-Za-z0-9._-]+$/.test(value)) {
    return { mode: "forHandle" as const, value };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("الرابط غير صالح. استخدم رابط قناة يوتيوب صحيح.");
  }

  const host = url.hostname.replace(/^www\./, "");
  if (!["youtube.com", "m.youtube.com"].includes(host)) {
    throw new Error("الرابط ليس رابط قناة يوتيوب صالح.");
  }

  const path = url.pathname.replace(/\/+$/, "");

  // يدعم:
  // /@name
  // /@name/videos
  // /@name/playlists
  // /@name/featured
  const handleMatch = path.match(/^\/@([^/]+)/);
  if (handleMatch?.[1]) {
    return { mode: "forHandle" as const, value: `@${handleMatch[1]}` };
  }

  const channelMatch = path.match(/^\/channel\/([^/]+)/);
  if (channelMatch?.[1]) {
    return { mode: "id" as const, value: channelMatch[1] };
  }

  const userMatch = path.match(/^\/user\/([^/]+)/);
  if (userMatch?.[1]) {
    return { mode: "forUsername" as const, value: userMatch[1] };
  }

  throw new Error(
    "استخدم رابط قناة من نوع @handle أو /channel/UC... أو /user/...",
  );
}

async function yt<T>(path: string, params: Record<string, string>) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error("YOUTUBE_API_KEY غير موجود في .env.local");
  }

  const search = new URLSearchParams({ ...params, key });
  const url = `https://www.googleapis.com/youtube/v3/${path}?${search.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();

  if (!res.ok) {
    const message = json?.error?.message || "فشل الاتصال بـ YouTube API";
    throw new Error(message);
  }

  return json as T;
}

async function resolveChannel(channelUrl: string) {
  const ref = extractChannelRef(channelUrl);

  const json = await yt<{
    items?: Array<{
      id: string;
      snippet?: {
        title?: string;
        customUrl?: string;
        thumbnails?: {
          high?: { url?: string };
          medium?: { url?: string };
          default?: { url?: string };
        };
      };
    }>;
  }>("channels", {
    part: "snippet",
    [ref.mode]: ref.value,
  });

  const item = json.items?.[0];
  if (!item?.id) {
    throw new Error("لم أستطع الوصول إلى القناة من هذا الرابط.");
  }

  const rawCustom = item.snippet?.customUrl?.trim() || "";
  const handle =
    rawCustom
      ? `@${rawCustom.replace(/^@/, "")}`
      : ref.mode === "forHandle"
        ? ref.value
        : null;

  return {
    channelId: item.id,
    title: item.snippet?.title || "قناة يوتيوب",
    handle,
    thumbnailUrl:
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.default?.url ||
      null,
    url: channelUrl,
  };
}

async function listAllPlaylists(channelId: string) {
  const out: ImportedPlaylist[] = [];
  let pageToken = "";
  let position = 0;

  do {
    const json = await yt<{
      nextPageToken?: string;
      items?: Array<{
        id: string;
        contentDetails?: { itemCount?: number };
        snippet?: {
          title?: string;
          thumbnails?: {
            high?: { url?: string };
            medium?: { url?: string };
            default?: { url?: string };
          };
        };
      }>;
    }>("playlists", {
      part: "snippet,contentDetails",
      channelId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });

    for (const p of json.items || []) {
      out.push({
        playlistId: p.id,
        title: p.snippet?.title || "قائمة تشغيل",
        itemCount: p.contentDetails?.itemCount || 0,
        thumbnailUrl:
          p.snippet?.thumbnails?.high?.url ||
          p.snippet?.thumbnails?.medium?.url ||
          p.snippet?.thumbnails?.default?.url ||
          null,
        position: position++,
        episodes: [],
      });
    }

    pageToken = json.nextPageToken || "";
  } while (pageToken);

  return out;
}

async function listAllPlaylistItems(playlistId: string) {
  const out: ImportedEpisode[] = [];
  let pageToken = "";

  do {
    const json = await yt<{
      nextPageToken?: string;
      items?: Array<{
        snippet?: {
          title?: string;
          position?: number;
          thumbnails?: {
            high?: { url?: string };
            medium?: { url?: string };
            default?: { url?: string };
          };
          resourceId?: { videoId?: string };
        };
      }>;
    }>("playlistItems", {
      part: "snippet",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });

    for (const item of json.items || []) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (!videoId) continue;

      out.push({
        title: item.snippet?.title || "حلقة",
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoId,
        position: item.snippet?.position ?? out.length,
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          null,
      });
    }

    pageToken = json.nextPageToken || "";
  } while (pageToken);

  return out.sort((a, b) => a.position - b.position);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { channelUrl?: string };
    const channelUrl = String(body.channelUrl || "").trim();

    if (!channelUrl) {
      return bad("أدخل رابط القناة.");
    }

    const channel = await resolveChannel(channelUrl);
    const playlists = await listAllPlaylists(channel.channelId);

    for (const playlist of playlists) {
      playlist.episodes = await listAllPlaylistItems(playlist.playlistId);
      playlist.itemCount = playlist.episodes.length;
    }

    const filteredPlaylists = playlists.filter((p) => p.episodes.length > 0);

    const payload: ImportedChannel = {
      ...channel,
      playlists: filteredPlaylists,
    };

    return NextResponse.json({ ok: true, data: payload });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "حدث خطأ غير متوقع أثناء استيراد القناة.";

    return bad(message, 500);
  }
}