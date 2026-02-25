import { NextResponse } from "next/server";

function getPlaylistIdFromUrl(u: string) {
  try {
    const url = new URL(u);
    return url.searchParams.get("list");
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url") || "";
  const playlistId = searchParams.get("playlistId") || getPlaylistIdFromUrl(url);

  if (!playlistId) {
    return NextResponse.json({ error: "Missing playlistId" }, { status: 400 });
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Missing YOUTUBE_API_KEY" }, { status: 500 });
  }

  const episodes: { title: string; videoId: string; url: string }[] = [];
  let pageToken = "";
  let guard = 0;

  while (guard++ < 20) {
    const api = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    api.searchParams.set("part", "snippet,contentDetails");
    api.searchParams.set("maxResults", "50");
    api.searchParams.set("playlistId", playlistId);
    api.searchParams.set("key", key);
    if (pageToken) api.searchParams.set("pageToken", pageToken);

    const r = await fetch(api.toString(), { cache: "no-store" });
    const data = await r.json();

    if (!r.ok) {
      return NextResponse.json({ error: data?.error?.message || "YouTube API error" }, { status: 400 });
    }

    for (const it of data.items || []) {
      const title = it?.snippet?.title;
      const videoId = it?.contentDetails?.videoId;
      if (!title || !videoId) continue;
      episodes.push({
        title,
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }

    pageToken = data.nextPageToken || "";
    if (!pageToken) break;
  }

  return NextResponse.json({ playlistId, count: episodes.length, episodes });
}