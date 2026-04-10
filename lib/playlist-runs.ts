import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  increment,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

function chunks<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function startNewPlaylistRun(tenantId: string, blockId: string) {
  const now = Date.now();
  const nodesRef = collection(db, "tenants", tenantId, "nodes");

  const qItems = query(
    nodesRef,
    where("parentId", "==", blockId),
    where("type", "==", "item"),
    where("archived", "==", false),
  );

  const snap = await getDocs(qItems);
  const docs = snap.docs;

  const hasItems = docs.length > 0;
  const allDone =
    hasItems &&
    docs.every((d) => {
      const data = d.data() as { done?: boolean };
      return data.done === true;
    });

  for (const part of chunks(docs, 450)) {
    const batch = writeBatch(db);

    part.forEach((d) => {
      batch.update(d.ref, {
        done: false,
        watchSeconds: 0,
        watchPercent: 0,
        completedAt: null,
        lastOpenedAt: null,
        updatedAt: now,
        version: increment(1),
      });
    });

    await batch.commit();
  }

  await updateDoc(doc(db, "tenants", tenantId, "nodes", blockId), {
    ...(allDone ? { runsCompleted: increment(1) } : {}),
    lastOpenedAt: null,
    lastOpenedEpisodeId: null,
    updatedAt: now,
    version: increment(1),
  });
}