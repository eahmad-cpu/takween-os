import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  increment,
  setDoc,
  updateDoc,
} from "firebase/firestore";

export type TimeAuditValueType =
  | "investment"
  | "necessity"
  | "entertainment"
  | "waste";

export type AddTimeAuditEntryParams = {
  tenantId: string;
  dateKey: string;
  monthKey: string;
  title: string;
  category: string;
  durationMinutes: number;
  valueType: TimeAuditValueType;
  note: string;
};

export async function addTimeAuditEntry(params: AddTimeAuditEntryParams) {
  const now = Date.now();
  const entryRef = doc(
    collection(db, "tenants", params.tenantId, "timeAuditEntries"),
  );

  await setDoc(entryRef, {
    id: entryRef.id,
    tenantId: params.tenantId,
    dateKey: params.dateKey,
    monthKey: params.monthKey,
    title: params.title.trim(),
    category: params.category,
    durationMinutes: params.durationMinutes,
    valueType: params.valueType,
    note: params.note.trim(),
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  return entryRef.id;
}

export async function archiveTimeAuditEntry(params: {
  tenantId: string;
  entryId: string;
}) {
  const now = Date.now();
  await updateDoc(
    doc(db, "tenants", params.tenantId, "timeAuditEntries", params.entryId),
    {
      archived: true,
      archivedAt: now,
      updatedAt: now,
      version: increment(1),
    },
  );
}
