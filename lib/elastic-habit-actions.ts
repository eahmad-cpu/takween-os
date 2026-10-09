import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

export const ELASTIC_HABITS_ROOT_ID = "elastic_habits_root";
const DEFAULT_MAJOR_GROUP_ID = "elastic_habits_default_major_group";

export const DEFAULT_ELASTIC_LEVELS = [
  "المستوى الأول",
  "المستوى الثاني",
  "المستوى الثالث",
  "المستوى الرابع",
  "المستوى الخامس",
  "المستوى السادس",
  "المستوى السابع",
];

export type ElasticHabitDraft = {
  id: string;
  title: string;
  levels: string[];
  isNew?: boolean;
};

function nodesCollection(tenantId: string) {
  return collection(db, "tenants", tenantId, "nodes");
}

function normalizedLevels(levels: string[]) {
  return Array.from({ length: 7 }, (_, index) =>
    levels[index]?.trim() || DEFAULT_ELASTIC_LEVELS[index],
  );
}

function orderKey(index: number, id: string) {
  return `${String(index).padStart(4, "0")}_${id}`;
}

export function elasticHabitDayId(dateKey: string, habitGroupId: string) {
  return `elastic_habit_day__${dateKey}__${habitGroupId}`;
}

async function migrateLegacyHabitGroups(tenantId: string) {
  const nodesRef = nodesCollection(tenantId);
  const legacySnapshot = await getDocs(
    query(nodesRef, where("kind", "==", "elastic_habit_group")),
  );
  const legacyGroups = legacySnapshot.docs.filter((item) => {
    const data = item.data();
    return data.archived !== true && data.parentId === ELASTIC_HABITS_ROOT_ID;
  });
  if (legacyGroups.length === 0) return;

  const now = Date.now();
  const defaultMajorRef = doc(nodesRef, DEFAULT_MAJOR_GROUP_ID);
  const defaultMajorSnapshot = await getDoc(defaultMajorRef);
  const batch = writeBatch(db);

  if (!defaultMajorSnapshot.exists()) {
    batch.set(defaultMajorRef, {
      id: DEFAULT_MAJOR_GROUP_ID,
      tenantId,
      parentId: ELASTIC_HABITS_ROOT_ID,
      type: "item",
      kind: "elastic_major_group",
      title: "عاداتي",
      orderKey: "0000_default",
      archived: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  }

  legacyGroups.forEach((group) => {
    batch.update(group.ref, {
      parentId: DEFAULT_MAJOR_GROUP_ID,
      updatedAt: now,
      version: increment(1),
    });
  });
  await batch.commit();
}

export async function ensureElasticHabitsRoot(tenantId: string) {
  const rootRef = doc(db, "tenants", tenantId, "nodes", ELASTIC_HABITS_ROOT_ID);
  const rootSnapshot = await getDoc(rootRef);

  if (!rootSnapshot.exists()) {
    const now = Date.now();
    await setDoc(rootRef, {
      id: ELASTIC_HABITS_ROOT_ID,
      tenantId,
      parentId: null,
      type: "block",
      blockType: "elastic_habits_hidden",
      hidden: true,
      title: "العادات المطاطية",
      archived: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  }

  await migrateLegacyHabitGroups(tenantId);
}

export async function addElasticMajorGroup(tenantId: string) {
  const now = Date.now();
  const majorGroupRef = doc(nodesCollection(tenantId));
  await setDoc(majorGroupRef, {
    id: majorGroupRef.id,
    tenantId,
    parentId: ELASTIC_HABITS_ROOT_ID,
    type: "item",
    kind: "elastic_major_group",
    title: "مجموعة كبرى جديدة",
    orderKey: `${now.toString(36)}_${majorGroupRef.id}`,
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });
  return majorGroupRef.id;
}

export async function updateElasticMajorGroup(params: {
  tenantId: string;
  majorGroupId: string;
  title: string;
}) {
  await updateDoc(doc(nodesCollection(params.tenantId), params.majorGroupId), {
    title: params.title.trim() || "مجموعة كبرى بلا عنوان",
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function addElasticHabitGroup(params: {
  tenantId: string;
  majorGroupId: string;
}) {
  const now = Date.now();
  const groupRef = doc(nodesCollection(params.tenantId));
  await setDoc(groupRef, {
    id: groupRef.id,
    tenantId: params.tenantId,
    parentId: params.majorGroupId,
    type: "item",
    kind: "elastic_habit_group",
    title: "مجموعة عادات جديدة",
    orderKey: `${now.toString(36)}_${groupRef.id}`,
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });
  return groupRef.id;
}

export async function saveElasticHabitGroup(params: {
  tenantId: string;
  groupId: string;
  title: string;
  subHabits: ElasticHabitDraft[];
  archivedSubHabitIds: string[];
}) {
  const now = Date.now();
  const nodesRef = nodesCollection(params.tenantId);
  const batch = writeBatch(db);

  batch.update(doc(nodesRef, params.groupId), {
    title: params.title.trim() || "مجموعة عادات بلا عنوان",
    updatedAt: now,
    version: increment(1),
  });

  params.subHabits.forEach((subHabit, index) => {
    const title = subHabit.title.trim() || "عادة فرعية بلا عنوان";
    const levels = normalizedLevels(subHabit.levels);

    if (subHabit.isNew) {
      const subHabitRef = doc(nodesRef);
      batch.set(subHabitRef, {
        id: subHabitRef.id,
        tenantId: params.tenantId,
        parentId: params.groupId,
        type: "item",
        kind: "elastic_sub_habit",
        title,
        levels,
        orderKey: orderKey(index, subHabitRef.id),
        archived: false,
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
      return;
    }

    batch.update(doc(nodesRef, subHabit.id), {
      title,
      levels,
      orderKey: orderKey(index, subHabit.id),
      updatedAt: now,
      version: increment(1),
    });
  });

  params.archivedSubHabitIds.forEach((subHabitId) => {
    batch.update(doc(nodesRef, subHabitId), {
      archived: true,
      archivedAt: now,
      updatedAt: now,
      version: increment(1),
    });
  });

  await batch.commit();
}

export async function archiveElasticHabitGroup(params: {
  tenantId: string;
  groupId: string;
  subHabitIds: string[];
}) {
  const now = Date.now();
  const nodesRef = nodesCollection(params.tenantId);
  const batch = writeBatch(db);
  const archivePatch = {
    archived: true,
    archivedAt: now,
    updatedAt: now,
    version: increment(1),
  };

  batch.update(doc(nodesRef, params.groupId), archivePatch);
  params.subHabitIds.forEach((subHabitId) => {
    batch.update(doc(nodesRef, subHabitId), archivePatch);
  });
  await batch.commit();
}

export async function archiveElasticMajorGroup(params: {
  tenantId: string;
  majorGroupId: string;
  habitGroupIds: string[];
  subHabitIds: string[];
}) {
  const now = Date.now();
  const nodesRef = nodesCollection(params.tenantId);
  const batch = writeBatch(db);
  const archivePatch = {
    archived: true,
    archivedAt: now,
    updatedAt: now,
    version: increment(1),
  };

  batch.update(doc(nodesRef, params.majorGroupId), archivePatch);
  params.habitGroupIds.forEach((habitGroupId) => batch.update(doc(nodesRef, habitGroupId), archivePatch));
  params.subHabitIds.forEach((subHabitId) => batch.update(doc(nodesRef, subHabitId), archivePatch));
  await batch.commit();
}

export async function swapElasticOrderKeys(params: {
  tenantId: string;
  firstId: string;
  firstOrderKey: string;
  secondId: string;
  secondOrderKey: string;
}) {
  const now = Date.now();
  const nodesRef = nodesCollection(params.tenantId);
  const batch = writeBatch(db);
  batch.update(doc(nodesRef, params.firstId), {
    orderKey: params.secondOrderKey,
    updatedAt: now,
    version: increment(1),
  });
  batch.update(doc(nodesRef, params.secondId), {
    orderKey: params.firstOrderKey,
    updatedAt: now,
    version: increment(1),
  });
  await batch.commit();
}

export async function recordElasticHabitSelection(params: {
  tenantId: string;
  dateKey: string;
  majorGroupId: string;
  habitGroupId: string;
  subHabitId: string;
  level: number;
}) {
  const now = Date.now();
  const recordId = elasticHabitDayId(params.dateKey, params.habitGroupId);
  const recordRef = doc(db, "tenants", params.tenantId, "nodes", recordId);
  const recordSnapshot = await getDoc(recordRef);

  if (recordSnapshot.exists()) {
    await updateDoc(recordRef, {
      majorGroupId: params.majorGroupId,
      habitGroupId: params.habitGroupId,
      subHabitId: params.subHabitId,
      level: params.level,
      archived: false,
      archivedAt: null,
      updatedAt: now,
      version: increment(1),
    });
    return;
  }

  await setDoc(recordRef, {
    id: recordId,
    tenantId: params.tenantId,
    parentId: ELASTIC_HABITS_ROOT_ID,
    type: "item",
    kind: "elastic_habit_day",
    dateKey: params.dateKey,
    majorGroupId: params.majorGroupId,
    habitGroupId: params.habitGroupId,
    subHabitId: params.subHabitId,
    level: params.level,
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });
}

export async function clearElasticHabitSelection(params: {
  tenantId: string;
  dateKey: string;
  habitGroupId: string;
}) {
  const now = Date.now();
  await updateDoc(
    doc(db, "tenants", params.tenantId, "nodes", elasticHabitDayId(params.dateKey, params.habitGroupId)),
    {
      archived: true,
      archivedAt: now,
      updatedAt: now,
      version: increment(1),
    },
  );
}
