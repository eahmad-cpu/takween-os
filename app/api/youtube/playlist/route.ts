import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getPlaylistIdFromUrl(value: string) {
  try {
    const url = new URL(value.trim());

    // الشكل المعتاد:
    // https://www.youtube.com/playlist?list=...
    // https://www.youtube.com/watch?v=...&list=...
    const list = url.searchParams.get("list");
    if (list) return list;

    return null;
  } catch {
    return null;
  }
}

type EpisodeRow = {
  title: string;
  videoId: string;
  url: string;
  position: number;
  thumbnailUrl: string | null;
};

async function fetchPlaylistItems(params: {
  playlistId: string;
  key: string;
  pageToken?: string;
}) {
  const api = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  api.searchParams.set("part", "snippet,contentDetails");
  api.searchParams.set("maxResults", "50");
  api.searchParams.set("playlistId", params.playlistId);
  api.searchParams.set("key", params.key);

  if (params.pageToken) {
    api.searchParams.set("pageToken", params.pageToken);
  }

  const res = await fetch(api.toString(), { cache: "no-store" });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.error?.message || "YouTube API error");
  }

  return json;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const rawUrl = String(searchParams.get("url") || "").trim();
    const rawPlaylistId = String(searchParams.get("playlistId") || "").trim();

    const playlistId = rawPlaylistId || getPlaylistIdFromUrl(rawUrl);

    if (!playlistId) {
      return NextResponse.json(
        { error: "أرسل playlistId أو رابط قائمة تشغيل صحيح." },
        { status: 400 },
      );
    }

    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Missing YOUTUBE_API_KEY" },
        { status: 500 },
      );
    }

    const episodes: EpisodeRow[] = [];
    let pageToken = "";
    let guard = 0;

    do {
      const data = await fetchPlaylistItems({
        playlistId,
        key,
        pageToken: pageToken || undefined,
      });

      for (const it of data.items || []) {
        const title = String(it?.snippet?.title || "").trim();
        const videoId = String(
          it?.contentDetails?.videoId || it?.snippet?.resourceId?.videoId || "",
        ).trim();

        if (!title || !videoId) continue;
        if (title === "Deleted video" || title === "Private video") continue;

        episodes.push({
          title,
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          position:
            typeof it?.snippet?.position === "number"
              ? it.snippet.position
              : episodes.length,
          thumbnailUrl:
            it?.snippet?.thumbnails?.high?.url ||
            it?.snippet?.thumbnails?.medium?.url ||
            it?.snippet?.thumbnails?.default?.url ||
            null,
        });
      }

      pageToken = data.nextPageToken || "";
      guard += 1;
    } while (pageToken && guard < 50);

    episodes.sort((a, b) => a.position - b.position);

    return NextResponse.json({
      ok: true,
      playlistId,
      count: episodes.length,
      episodes,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء استيراد قائمة التشغيل",
      },
      { status: 500 },
    );
  }
}