import { collection, doc, increment, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ResetDayStatus } from "@/lib/reset-day";

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function sessionsCollection(tenantId: string) {
  return collection(db, "tenants", tenantId, "resetDaySessions");
}

export async function createResetDaySession(tenantId: string) {
  const now = Date.now();
  const sessionDate = localDateKey();
  const sessionRef = doc(sessionsCollection(tenantId));

  await setDoc(sessionRef, {
    id: sessionRef.id,
    tenantId,
    title: "يوم إعادة ضبط المسار",
    sessionDate,
    status: "MORNING" satisfies ResetDayStatus,
    currentPhase: "morning",
    currentMorningQuestion: 0,
    answers: {},
    daytime: { interruptions: {} },
    evening: { answers: {} },
    finalPathMap: null,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    morningCompletedAt: null,
    completedAt: null,
    version: 1,
  });

  return sessionRef.id;
}

export async function saveResetDayMorningProgress(params: {
  tenantId: string;
  sessionId: string;
  answers: Record<string, string>;
  currentMorningQuestion: number;
}) {
  await updateDoc(doc(sessionsCollection(params.tenantId), params.sessionId), {
    answers: params.answers,
    currentMorningQuestion: params.currentMorningQuestion,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function completeResetDayMorning(params: {
  tenantId: string;
  sessionId: string;
  answers: Record<string, string>;
  currentMorningQuestion: number;
}) {
  const now = Date.now();
  await updateDoc(doc(sessionsCollection(params.tenantId), params.sessionId), {
    answers: params.answers,
    currentMorningQuestion: params.currentMorningQuestion,
    status: "DAYTIME" satisfies ResetDayStatus,
    currentPhase: "daytime",
    morningCompletedAt: now,
    updatedAt: now,
    version: increment(1),
  });
}
