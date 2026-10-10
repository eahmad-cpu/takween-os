"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { auth, db } from "@/lib/firebase";
import {
  DEFAULT_ELASTIC_LEVELS,
  ELASTIC_HABITS_ROOT_ID,
  addElasticHabitGroup,
  addElasticMajorGroup,
  archiveElasticHabitGroup,
  archiveElasticMajorGroup,
  clearElasticHabitSelection,
  ensureElasticHabitsRoot,
  recordElasticHabitSelection,
  saveElasticHabitGroup,
  swapElasticOrderKeys,
  updateElasticMajorGroup,
  type ElasticHabitDraft,
} from "@/lib/elastic-habit-actions";

type MajorGroup = { id: string; title: string; orderKey: string };
type HabitGroup = { id: string; parentId: string; title: string; orderKey: string };
type SubHabit = { id: string; parentId: string; title: string; levels: string[]; orderKey: string };
type DailySelection = { habitGroupId: string; subHabitId: string; level: number };
type HabitEditDraft = {
  groupId: string;
  title: string;
  subHabits: ElasticHabitDraft[];
  archivedSubHabitIds: string[];
};

function localDateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function normalizeLevels(levels: unknown) {
  if (!Array.isArray(levels)) return [...DEFAULT_ELASTIC_LEVELS];
  return Array.from({ length: 7 }, (_, index) =>
    typeof levels[index] === "string" && levels[index].trim() ? levels[index] : DEFAULT_ELASTIC_LEVELS[index],
  );
}

function newSubHabitDraft(): ElasticHabitDraft {
  return {
    id: `new_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    title: "عادة فرعية جديدة",
    levels: [...DEFAULT_ELASTIC_LEVELS],
    isNew: true,
  };
}

function toggleId(current: Set<string>, id: string) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function swapInList<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export default function ElasticHabitsPage() {
  const todayKey = localDateKey();
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [majorGroups, setMajorGroups] = useState<MajorGroup[]>([]);
  const [habitGroups, setHabitGroups] = useState<HabitGroup[]>([]);
  const [subHabits, setSubHabits] = useState<SubHabit[]>([]);
  const [dailySelections, setDailySelections] = useState<DailySelection[]>([]);
  const [openMajorIds, setOpenMajorIds] = useState<Set<string>>(new Set());
  const [openHabitIds, setOpenHabitIds] = useState<Set<string>>(new Set());
  const [editingMajorId, setEditingMajorId] = useState<string | null>(null);
  const [majorTitle, setMajorTitle] = useState("");
  const [editingHabit, setEditingHabit] = useState<HabitEditDraft | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addingMajor, setAddingMajor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setUid(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        await ensureElasticHabitsRoot(user.uid);
        if (!cancelled) setUid(user.uid);
      } catch {
        if (!cancelled) setError("تعذر تجهيز العادات المطاطية. حاول مرة أخرى.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!uid) {
      setMajorGroups([]);
      setHabitGroups([]);
      setSubHabits([]);
      setDailySelections([]);
      return;
    }

    const nodesRef = collection(db, "tenants", uid, "nodes");
    const unsubscribeMajorGroups = onSnapshot(
      query(nodesRef, where("kind", "==", "elastic_major_group")),
      (snapshot) => setMajorGroups(snapshot.docs
        .map((item) => {
          const data = item.data();
          if (data.archived === true || data.parentId !== ELASTIC_HABITS_ROOT_ID || typeof data.title !== "string") return null;
          return { id: item.id, title: data.title, orderKey: typeof data.orderKey === "string" ? data.orderKey : item.id } satisfies MajorGroup;
        })
        .filter((item): item is MajorGroup => item !== null)
        .sort((a, b) => a.orderKey.localeCompare(b.orderKey, "ar"))),
      () => setError("تعذر تحميل المجموعات الكبرى."),
    );
    const unsubscribeHabitGroups = onSnapshot(
      query(nodesRef, where("kind", "==", "elastic_habit_group")),
      (snapshot) => setHabitGroups(snapshot.docs
        .map((item) => {
          const data = item.data();
          if (data.archived === true || typeof data.parentId !== "string" || typeof data.title !== "string") return null;
          return { id: item.id, parentId: data.parentId, title: data.title, orderKey: typeof data.orderKey === "string" ? data.orderKey : item.id } satisfies HabitGroup;
        })
        .filter((item): item is HabitGroup => item !== null)
        .sort((a, b) => a.orderKey.localeCompare(b.orderKey, "ar"))),
      () => setError("تعذر تحميل مجموعات العادات."),
    );
    const unsubscribeSubHabits = onSnapshot(
      query(nodesRef, where("kind", "==", "elastic_sub_habit")),
      (snapshot) => setSubHabits(snapshot.docs
        .map((item) => {
          const data = item.data();
          if (data.archived === true || typeof data.parentId !== "string" || typeof data.title !== "string") return null;
          return { id: item.id, parentId: data.parentId, title: data.title, levels: normalizeLevels(data.levels), orderKey: typeof data.orderKey === "string" ? data.orderKey : item.id } satisfies SubHabit;
        })
        .filter((item): item is SubHabit => item !== null)
        .sort((a, b) => a.orderKey.localeCompare(b.orderKey, "ar"))),
      () => setError("تعذر تحميل العادات الفرعية."),
    );
    const unsubscribeSelections = onSnapshot(
      query(nodesRef, where("dateKey", "==", todayKey)),
      (snapshot) => setDailySelections(snapshot.docs
        .map((item) => {
          const data = item.data();
          const habitGroupId = typeof data.habitGroupId === "string" ? data.habitGroupId : data.groupId;
          if (data.archived === true || data.kind !== "elastic_habit_day" || data.parentId !== ELASTIC_HABITS_ROOT_ID || typeof habitGroupId !== "string" || typeof data.subHabitId !== "string" || typeof data.level !== "number") return null;
          return { habitGroupId, subHabitId: data.subHabitId, level: data.level } satisfies DailySelection;
        })
        .filter((item): item is DailySelection => item !== null)),
      () => setError("تعذر تحميل اختيارات اليوم."),
    );

    return () => {
      unsubscribeMajorGroups();
      unsubscribeHabitGroups();
      unsubscribeSubHabits();
      unsubscribeSelections();
    };
  }, [uid, todayKey]);

  const habitsByMajor = useMemo(() => {
    const grouped = new Map<string, HabitGroup[]>();
    habitGroups.forEach((group) => grouped.set(group.parentId, [...(grouped.get(group.parentId) ?? []), group]));
    return grouped;
  }, [habitGroups]);
  const subHabitsByHabit = useMemo(() => {
    const grouped = new Map<string, SubHabit[]>();
    subHabits.forEach((habit) => grouped.set(habit.parentId, [...(grouped.get(habit.parentId) ?? []), habit]));
    return grouped;
  }, [subHabits]);
  const selectionByHabit = useMemo(
    () => new Map(dailySelections.map((selection) => [selection.habitGroupId, selection])),
    [dailySelections],
  );
  const today = useMemo(() => {
    const parts = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "numeric", year: "numeric" }).formatToParts(new Date());
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
    return { weekday: get("weekday"), date: `${get("day")} / ${get("month")} / ${get("year")}` };
  }, []);

  function startEditingMajor(major: MajorGroup) {
    setEditingMajorId(major.id);
    setMajorTitle(major.title);
    setOpenMajorIds((current) => new Set(current).add(major.id));
    setError(null);
  }

  function startEditingHabit(group: HabitGroup) {
    setEditingHabit({
      groupId: group.id,
      title: group.title,
      subHabits: (subHabitsByHabit.get(group.id) ?? []).map((item) => ({ id: item.id, title: item.title, levels: [...item.levels] })),
      archivedSubHabitIds: [],
    });
    setOpenHabitIds((current) => new Set(current).add(group.id));
    setError(null);
  }

  function updateHabitEdit(update: (current: HabitEditDraft) => HabitEditDraft) {
    setEditingHabit((current) => current ? update(current) : current);
  }

  async function addMajorGroup() {
    if (!uid) return;
    setAddingMajor(true);
    setError(null);
    try {
      await addElasticMajorGroup(uid);
    } catch {
      setError("تعذر إضافة المجموعة الكبرى. حاول مرة أخرى.");
    } finally {
      setAddingMajor(false);
    }
  }

  async function saveMajorGroup(event: FormEvent<HTMLFormElement>, majorGroupId: string) {
    event.preventDefault();
    if (!uid) return;
    setPendingId(majorGroupId);
    setError(null);
    try {
      await updateElasticMajorGroup({ tenantId: uid, majorGroupId, title: majorTitle });
      setEditingMajorId(null);
    } catch {
      setError("تعذر حفظ المجموعة الكبرى. حاول مرة أخرى.");
    } finally {
      setPendingId(null);
    }
  }

  async function addHabitGroup(majorGroupId: string) {
    if (!uid) return;
    setPendingId(majorGroupId);
    setError(null);
    try {
      await addElasticHabitGroup({ tenantId: uid, majorGroupId });
      setOpenMajorIds((current) => new Set(current).add(majorGroupId));
    } catch {
      setError("تعذر إضافة مجموعة العادات. حاول مرة أخرى.");
    } finally {
      setPendingId(null);
    }
  }

  async function chooseLevel(majorGroupId: string, habitGroupId: string, subHabitId: string, level: number) {
    if (!uid) return;
    setPendingId(habitGroupId);
    setError(null);
    try {
      await recordElasticHabitSelection({ tenantId: uid, dateKey: todayKey, majorGroupId, habitGroupId, subHabitId, level });
    } catch {
      setError("تعذر حفظ اختيار اليوم. حاول مرة أخرى.");
    } finally {
      setPendingId(null);
    }
  }

  async function clearSelection(habitGroupId: string) {
    if (!uid) return;
    setPendingId(habitGroupId);
    setError(null);
    try {
      await clearElasticHabitSelection({ tenantId: uid, dateKey: todayKey, habitGroupId });
    } catch {
      setError("تعذر مسح اختيار اليوم. حاول مرة أخرى.");
    } finally {
      setPendingId(null);
    }
  }

  async function saveHabitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uid || !editingHabit) return;
    setPendingId(editingHabit.groupId);
    setError(null);
    try {
      await saveElasticHabitGroup({ tenantId: uid, ...editingHabit });
      setEditingHabit(null);
    } catch {
      setError("تعذر حفظ تعديلات مجموعة العادات. حاول مرة أخرى.");
    } finally {
      setPendingId(null);
    }
  }

  async function archiveHabitGroup(groupId: string) {
    if (!uid) return;
    setPendingId(groupId);
    setError(null);
    try {
      await archiveElasticHabitGroup({ tenantId: uid, groupId, subHabitIds: (subHabitsByHabit.get(groupId) ?? []).map((item) => item.id) });
      if (editingHabit?.groupId === groupId) setEditingHabit(null);
    } catch {
      setError("تعذر حذف مجموعة العادات. حاول مرة أخرى.");
    } finally {
      setPendingId(null);
    }
  }

  async function archiveMajorGroup(majorGroupId: string) {
    if (!uid) return;
    const groups = habitsByMajor.get(majorGroupId) ?? [];
    setPendingId(majorGroupId);
    setError(null);
    try {
      await archiveElasticMajorGroup({
        tenantId: uid,
        majorGroupId,
        habitGroupIds: groups.map((group) => group.id),
        subHabitIds: groups.flatMap((group) => (subHabitsByHabit.get(group.id) ?? []).map((habit) => habit.id)),
      });
      setEditingMajorId(null);
      setEditingHabit(null);
    } catch {
      setError("تعذر حذف المجموعة الكبرى. حاول مرة أخرى.");
    } finally {
      setPendingId(null);
    }
  }

  async function moveItem(items: Array<{ id: string; orderKey: string }>, currentId: string, direction: -1 | 1) {
    if (!uid) return;
    const index = items.findIndex((item) => item.id === currentId);
    const other = items[index + direction];
    const current = items[index];
    if (!current || !other) return;
    setPendingId(currentId);
    try {
      await swapElasticOrderKeys({ tenantId: uid, firstId: current.id, firstOrderKey: current.orderKey, secondId: other.id, secondOrderKey: other.orderKey });
    } catch {
      setError("تعذر تغيير الترتيب. حاول مرة أخرى.");
    } finally {
      setPendingId(null);
    }
  }

  if (loading) return <div className="text-muted-foreground">جارٍ التحميل...</div>;
  if (!uid) return <div dir="rtl" className="text-muted-foreground">سجّل الدخول.</div>;

  return (
    <main dir="rtl" className="mx-auto max-w-5xl space-y-5 pb-20">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-4xl font-black tracking-tight sm:text-5xl">{today.weekday}</p>
          <p className="mt-1 text-3xl font-bold text-primary sm:text-4xl" dir="ltr">{today.date}</p>
          <h1 className="mt-4 text-lg font-semibold text-muted-foreground">العادات المطاطية</h1>
          <p className="text-sm text-muted-foreground">قم بإضافة جانب معين ثم إضافة عادات داخله</p>
        </div>
        <Button type="button" onClick={() => void addMajorGroup()} disabled={addingMajor}>
          <Plus />
          {addingMajor ? "جارٍ الإضافة..." : "إضافة جانب معين"}
        </Button>
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {majorGroups.length === 0 ? (
        <Card><CardContent className="space-y-3 pt-6"><p className="font-medium">لا توجد مجموعات بعد.</p><Button type="button" onClick={() => void addMajorGroup()} disabled={addingMajor}><Plus />إضافة جانب معين</Button></CardContent></Card>
      ) : (
        <section className="space-y-3">
          {majorGroups.map((major, majorIndex) => {
            const isMajorOpen = openMajorIds.has(major.id);
            const isMajorEditing = editingMajorId === major.id;
            const groups = habitsByMajor.get(major.id) ?? [];
            const isMajorPending = pendingId === major.id;

            return (
              <Card key={major.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                  {isMajorEditing ? (
                    <form onSubmit={(event) => void saveMajorGroup(event, major.id)} className="flex min-w-0 flex-1 items-center gap-2">
                      <Input value={majorTitle} onChange={(event) => setMajorTitle(event.target.value)} aria-label="اسم المجموعة الكبرى" />
                      <Button type="submit" size="sm" disabled={isMajorPending}>حفظ</Button>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditingMajorId(null)} aria-label="إلغاء"><X /></Button>
                    </form>
                  ) : (
                    <Button type="button" variant="ghost" className="h-auto min-w-0 flex-1 justify-start px-0 text-right text-lg" onClick={() => setOpenMajorIds((current) => toggleId(current, major.id))}>
                      {isMajorOpen ? <ChevronDown /> : <ChevronLeft />}
                      <span className="truncate">{major.title}</span>
                    </Button>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => void moveItem(majorGroups, major.id, -1)} disabled={majorIndex === 0 || isMajorPending} aria-label="نقل للأعلى"><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => void moveItem(majorGroups, major.id, 1)} disabled={majorIndex === majorGroups.length - 1 || isMajorPending} aria-label="نقل للأسفل"><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => startEditingMajor(major)} aria-label="تعديل المجموعة الكبرى"><Pencil /></Button>
                  </div>
                </CardHeader>

                {isMajorOpen && (
                  <CardContent className="space-y-3">
                    {isMajorEditing && (
                      <div className="flex flex-wrap gap-2 border-b pb-3">
                        <Button type="button" variant="outline" onClick={() => void addHabitGroup(major.id)} disabled={isMajorPending}><Plus />إضافة مجموعة عادات</Button>
                        <Button type="button" variant="destructive" onClick={() => void archiveMajorGroup(major.id)} disabled={isMajorPending}><Trash2 />حذف المجموعة الكبرى</Button>
                      </div>
                    )}
                    {groups.length === 0 ? (
                      <p className="text-sm text-muted-foreground">لا توجد مجموعات عادات داخل هذه المجموعة.</p>
                    ) : groups.map((group, groupIndex) => {
                      const isHabitOpen = openHabitIds.has(group.id);
                      const isHabitEditing = editingHabit?.groupId === group.id;
                      const isPending = pendingId === group.id;
                      const groupSubHabits = subHabitsByHabit.get(group.id) ?? [];
                      const selection = selectionByHabit.get(group.id);
                      const selectedSubHabit = groupSubHabits.find((item) => item.id === selection?.subHabitId);

                      return (
                        <div key={group.id} className="rounded-lg border bg-background/40">
                          <div className="flex items-center justify-between gap-2 p-3">
                            <Button type="button" variant="ghost" className="h-auto min-w-0 flex-1 justify-start px-0 text-right" onClick={() => setOpenHabitIds((current) => toggleId(current, group.id))}>
                              {isHabitOpen ? <ChevronDown /> : <ChevronLeft />}
                              <span className="truncate font-semibold">{group.title}</span>
                            </Button>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button type="button" variant="ghost" size="icon-sm" onClick={() => void moveItem(groups, group.id, -1)} disabled={groupIndex === 0 || isPending} aria-label="نقل للأعلى"><ArrowUp /></Button>
                              <Button type="button" variant="ghost" size="icon-sm" onClick={() => void moveItem(groups, group.id, 1)} disabled={groupIndex === groups.length - 1 || isPending} aria-label="نقل للأسفل"><ArrowDown /></Button>
                              <Button type="button" variant="ghost" size="icon-sm" onClick={() => startEditingHabit(group)} aria-label="تعديل مجموعة العادات"><Pencil /></Button>
                            </div>
                          </div>

                          {isHabitOpen && (
                            <div className="space-y-4 border-t p-3">
                              {selection && selectedSubHabit && <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 p-2 text-sm"><span>اختيار اليوم: {selectedSubHabit.title} - المستوى {selection.level} - {selectedSubHabit.levels[selection.level - 1]}</span><Button type="button" size="sm" variant="ghost" onClick={() => void clearSelection(group.id)} disabled={isPending}>مسح اختيار اليوم</Button></div>}

                              {isHabitEditing && editingHabit ? (
                                <form onSubmit={saveHabitGroup} className="space-y-4">
                                  <label className="grid gap-1.5 text-sm font-medium"><span>اسم مجموعة العادات</span><Input value={editingHabit.title} onChange={(event) => updateHabitEdit((current) => ({ ...current, title: event.target.value }))} /></label>
                                  {editingHabit.subHabits.map((subHabit, subHabitIndex) => (
                                    <div key={subHabit.id} className="space-y-3 rounded-md border p-3">
                                      <div className="flex items-center gap-2"><Input value={subHabit.title} onChange={(event) => updateHabitEdit((current) => ({ ...current, subHabits: current.subHabits.map((item) => item.id === subHabit.id ? { ...item, title: event.target.value } : item) }))} aria-label="اسم العادة الفرعية" /><Button type="button" variant="ghost" size="icon-sm" onClick={() => updateHabitEdit((current) => ({ ...current, subHabits: current.subHabits.filter((item) => item.id !== subHabit.id), archivedSubHabitIds: subHabit.isNew ? current.archivedSubHabitIds : [...current.archivedSubHabitIds, subHabit.id] }))} aria-label="حذف العادة الفرعية"><Trash2 /></Button></div>
                                      <div className="flex gap-1"><Button type="button" variant="ghost" size="icon-sm" disabled={subHabitIndex === 0} onClick={() => updateHabitEdit((current) => ({ ...current, subHabits: swapInList(current.subHabits, subHabitIndex, -1) }))} aria-label="نقل للأعلى"><ArrowUp /></Button><Button type="button" variant="ghost" size="icon-sm" disabled={subHabitIndex === editingHabit.subHabits.length - 1} onClick={() => updateHabitEdit((current) => ({ ...current, subHabits: swapInList(current.subHabits, subHabitIndex, 1) }))} aria-label="نقل للأسفل"><ArrowDown /></Button></div>
                                      <div className="grid gap-2 sm:grid-cols-2">{subHabit.levels.map((label, levelIndex) => <label key={levelIndex} className="grid gap-1 text-xs text-muted-foreground"><span>المستوى {levelIndex + 1}</span><Input value={label} onChange={(event) => updateHabitEdit((current) => ({ ...current, subHabits: current.subHabits.map((item) => item.id === subHabit.id ? { ...item, levels: item.levels.map((value, index) => index === levelIndex ? event.target.value : value) } : item) }))} /></label>)}</div>
                                    </div>
                                  ))}
                                  <Button type="button" variant="outline" onClick={() => updateHabitEdit((current) => ({ ...current, subHabits: [...current.subHabits, newSubHabitDraft()] }))}><Plus />إضافة عادة فرعية</Button>
                                  <div className="flex flex-wrap justify-between gap-2 border-t pt-3"><Button type="button" variant="destructive" onClick={() => void archiveHabitGroup(group.id)} disabled={isPending}><Trash2 />حذف مجموعة العادات</Button><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setEditingHabit(null)} disabled={isPending}>إلغاء</Button><Button type="submit" disabled={isPending}>{isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button></div></div>
                                </form>
                              ) : groupSubHabits.length === 0 ? (
                                <p className="text-sm text-muted-foreground">لا توجد عادات فرعية داخل هذه المجموعة.</p>
                              ) : groupSubHabits.map((subHabit) => (
                                <div key={subHabit.id} className="space-y-2"><h3 className="font-medium">{subHabit.title}</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{subHabit.levels.map((label, index) => { const level = index + 1; const selected = selection?.subHabitId === subHabit.id && selection.level === level; return <Button key={level} type="button" variant={selected ? "default" : "outline"} className="h-auto min-h-12 whitespace-normal px-2 py-2 text-right text-xs" onClick={() => void chooseLevel(major.id, group.id, subHabit.id, level)} disabled={isPending}><span className="font-bold">{level}</span> · {label}</Button>; })}</div></div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </section>
      )}
    </main>
  );
}
