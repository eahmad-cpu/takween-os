import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  increment,
  setDoc,
  updateDoc,
} from "firebase/firestore";

export const VISION_ROOT_ID = "vision_root_main";

export type VisionSection =
  | "daily"
  | "loop"
  | "mindset"
  | "identity"
  | "goals";

export type VisionExecutionType =
  | "none"
  | "daily_tasks"
  | "sequential_loop";

export type VisionAllowedDay = "friday" | "saturday" | "holiday";

export type VisionTask = {
  id: string;
  title: string;
  note?: string;
  sortOrder: number;
  isActive: boolean;
};

export type VisionRow = {
  id: string;
  tenantId: string;
  parentId: string;
  type: "item";
  kind: "vision";
  title: string;
  description: string;
  motivation: string;
  warning: string;
  howTo: string;
  section: VisionSection;
  executionType: VisionExecutionType;
  isActive: boolean;
  orderKey: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;

  dailyTasks?: VisionTask[];
  loopTasks?: VisionTask[];

  dailyDoneDateKey?: string | null;
  dailyDoneTaskIds?: string[];

  loopState?: {
  currentTaskIndex: number;
  cycleCount: number;
  lastCycleCompletedAt: number | null;
} | null;

  allowedLoopDays?: VisionAllowedDay[];
};

function mkOrderKey(now: number, id: string) {
  return `${now.toString(36)}_${id}`;
}

function mkTaskId(index: number, title: string) {
  const safe = title
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 24);

  return `task_${index + 1}_${safe || "item"}`;
}

export function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseVisionTasks(text: string): VisionTask[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [titlePart, notePart] = line.split("|");
      const title = (titlePart || "").trim();

      return {
        id: mkTaskId(index, title),
        title,
        note: notePart?.trim() || "",
        sortOrder: index + 1,
        isActive: true,
      };
    })
    .filter((task) => task.title);
}

export async function ensureVisionRoot(tenantId: string) {
  const ref = doc(db, "tenants", tenantId, "nodes", VISION_ROOT_ID);
  const snap = await getDoc(ref);

  if (snap.exists()) return;

  const now = Date.now();

  await setDoc(ref, {
    id: VISION_ROOT_ID,
    tenantId,
    parentId: null,
    type: "block",
    title: "تنفيذ الرؤية",
    blockType: "vision_root_hidden",
    hidden: true,
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });
}

export async function addVision(
  tenantId: string,
  payload: {
    title: string;
    description: string;
    motivation: string;
    warning: string;
    howTo: string;
    section: VisionSection;
    executionType: VisionExecutionType;
    dailyTasks?: VisionTask[];
    loopTasks?: VisionTask[];
    allowedLoopDays?: VisionAllowedDay[];
  }
) {
  const now = Date.now();
  const colRef = collection(db, "tenants", tenantId, "nodes");
  const ref = doc(colRef);

  await setDoc(ref, {
    id: ref.id,
    tenantId,
    parentId: VISION_ROOT_ID,
    type: "item",
    kind: "vision",

    title: payload.title.trim(),
    description: payload.description.trim(),
    motivation: payload.motivation.trim(),
    warning: payload.warning.trim(),
    howTo: payload.howTo.trim(),

    section: payload.section,
    executionType: payload.executionType,

    isActive: true,
    orderKey: mkOrderKey(now, ref.id),
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,

    dailyTasks: payload.executionType === "daily_tasks" ? (payload.dailyTasks ?? []) : [],
    loopTasks:
      payload.executionType === "sequential_loop" ? (payload.loopTasks ?? []) : [],

    dailyDoneDateKey: null,
    dailyDoneTaskIds: [],

    loopState:
      payload.executionType === "sequential_loop"
        ? {
            currentTaskIndex: 0,
            cycleCount: 0,
            lastCycleCompletedAt: null,
          }
        : null,

    allowedLoopDays:
      payload.executionType === "sequential_loop"
        ? (payload.allowedLoopDays ?? ["friday", "saturday", "holiday"])
        : [],
  });

  return ref.id;
}

export async function updateVision(
  tenantId: string,
  visionId: string,
  patch: Partial<VisionRow>
) {
  await updateDoc(doc(db, "tenants", tenantId, "nodes", visionId), {
    ...patch,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function archiveVision(tenantId: string, visionId: string) {
  await updateDoc(doc(db, "tenants", tenantId, "nodes", visionId), {
    archived: true,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function toggleDailyTaskDone(
  tenantId: string,
  visionId: string,
  taskId: string,
  dateKey: string
) {
  const ref = doc(db, "tenants", tenantId, "nodes", visionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data() as VisionRow;
  const currentDone =
    data.dailyDoneDateKey === dateKey ? (data.dailyDoneTaskIds ?? []) : [];

  const nextDone = currentDone.includes(taskId)
    ? currentDone.filter((id) => id !== taskId)
    : [...currentDone, taskId];

  await updateDoc(ref, {
    dailyDoneDateKey: dateKey,
    dailyDoneTaskIds: nextDone,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function advanceVisionLoop(tenantId: string, visionId: string) {
  const ref = doc(db, "tenants", tenantId, "nodes", visionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data() as VisionRow;
  const tasks = (data.loopTasks ?? []).filter((t) => t.isActive);
  if (!tasks.length) return;

  const now = Date.now();
  const currentIndexRaw = data.loopState?.currentTaskIndex ?? 0;
  const currentIndex = Math.min(
    Math.max(currentIndexRaw, 0),
    Math.max(tasks.length - 1, 0)
  );

  const isLast = currentIndex >= tasks.length - 1;

  await updateDoc(ref, {
    loopState: {
      currentTaskIndex: isLast ? 0 : currentIndex + 1,
      cycleCount: isLast
        ? (data.loopState?.cycleCount ?? 0) + 1
        : (data.loopState?.cycleCount ?? 0),
      lastCycleCompletedAt: isLast
        ? now
        : (data.loopState?.lastCycleCompletedAt ?? null),
    },
    updatedAt: now,
    version: increment(1),
  });
}