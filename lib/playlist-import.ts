import { db } from "@/lib/firebase";
import { collection, doc, writeBatch } from "firebase/firestore";

type Ep = {
  title: string;
  url: string;
  videoId: string;
  position?: number;
  thumbnailUrl?: string | null;
};

function chunks<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function padded(n: number, size = 6) {
  return String(n).padStart(size, "0");
}

export async function importPlaylistEpisodes(params: {
  tenantId: string;
  blockId: string;
  episodes: Ep[];
}) {
  const now = Date.now();
  const colRef = collection(db, "tenants", params.tenantId, "nodes");

  const normalized = [...params.episodes]
    .map((ep, index) => ({
      title: String(ep.title || "").trim() || `حلقة ${index + 1}`,
      url: String(ep.url || "").trim(),
      videoId: String(ep.videoId || "").trim(),
      position:
        typeof ep.position === "number" && Number.isFinite(ep.position)
          ? ep.position
          : index,
      thumbnailUrl: ep.thumbnailUrl ?? null,
    }))
    .filter((ep) => ep.url && ep.videoId)
    .sort((a, b) => a.position - b.position);

  for (const part of chunks(normalized, 450)) {
    const batch = writeBatch(db);

    part.forEach((ep) => {
      const ref = doc(colRef);

      batch.set(ref, {
        id: ref.id,
        tenantId: params.tenantId,
        parentId: params.blockId,
        type: "item",
        kind: "playlist_episode",
        title: ep.title,
        url: ep.url,
        videoId: ep.videoId,
        sourceType: "youtube",
        thumbnailUrl: ep.thumbnailUrl,

        orderKey: padded(ep.position),
        position: ep.position,
        archived: false,

        done: false,
        watchSeconds: 0,
        watchPercent: 0,
        completedAt: null,
        lastOpenedAt: null,

        createdAt: now,
        updatedAt: now,
        version: 1,
      });
    });

    await batch.commit();
  }
}