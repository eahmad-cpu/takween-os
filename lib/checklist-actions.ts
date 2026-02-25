import { db } from "@/lib/firebase";
import { collection, doc, increment, setDoc, updateDoc } from "firebase/firestore";

export async function addChecklistItem(tenantId: string, blockId: string, title: string) {
  const now = Date.now();
  const colRef = collection(db, "tenants", tenantId, "nodes");
  const ref = doc(colRef); // auto-id
  const id = ref.id;

  await setDoc(ref, {
    id,
    tenantId,
    parentId: blockId,
    type: "item",
    title,
    orderKey: `${now.toString(36)}_${id}`,
    archived: false,
    done: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  return id;
}

export async function toggleChecklistDone(tenantId: string, itemId: string, currentDone: boolean) {
  await updateDoc(doc(db, "tenants", tenantId, "nodes", itemId), {
    done: !currentDone,
    updatedAt: Date.now(),
    version: increment(1),
  });
}