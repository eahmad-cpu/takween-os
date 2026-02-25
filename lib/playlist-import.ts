import { db } from "@/lib/firebase";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";

type Ep = { title: string; url: string; videoId: string };

function chunks<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function importPlaylistEpisodes(params: {
  tenantId: string;
  blockId: string;
  episodes: Ep[];
}) {
  const colRef = collection(db, "tenants", params.tenantId, "nodes");

  for (const part of chunks(params.episodes, 450)) {
    const batch = writeBatch(db);

    part.forEach((ep, idx) => {
      const ref = doc(colRef); // auto-id
      batch.set(ref, {
        id: ref.id,
        tenantId: params.tenantId,
        parentId: params.blockId,
        type: "item",
        title: ep.title,
        url: ep.url,
        videoId: ep.videoId,
        orderKey: idx.toString(36).padStart(4, "0"),
        archived: false,
        done: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        version: 1,
      });
    });

    await batch.commit();
  }
}