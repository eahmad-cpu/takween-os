"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { auth, db } from "@/lib/firebase";
import {
  addTimeAuditEntry,
  archiveTimeAuditEntry,
  type TimeAuditValueType,
} from "@/lib/time-audit-actions";

const CATEGORIES = [
  "عبادة وإصلاح",
  "عمل / وظيفة",
  "تعلم",
  "صحة ورياضة",
  "أسرة",
  "علاقات",
  "نوم",
  "أكل وشرب",
  "تنقل ومشاوير",
  "ترفيه",
  "سوشيال ميديا",
  "أعمال منزلية",
  "هدر / لا شيء",
  "أخرى",
] as const;

const VALUE_TYPES: Array<{ value: TimeAuditValueType; label: string }> = [
  { value: "investment", label: "استثمار" },
  { value: "necessity", label: "ضرورة" },
  { value: "entertainment", label: "ترفيه" },
  { value: "waste", label: "هدر" },
];

type TimeAuditEntry = {
  id: string;
  dateKey: string;
  title: string;
  category: string;
  durationMinutes: number;
  valueType: TimeAuditValueType;
  note: string;
  createdAt: number;
};

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthKeyFromDate(dateKey: string) {
  return dateKey.slice(0, 7);
}

function dateForMonth(monthKey: string, preferredDay: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const day = Math.min(Number(preferredDay) || 1, new Date(year, month, 0).getDate());
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining}د`;
  return remaining === 0 ? `${hours}س` : `${hours}س ${remaining}د`;
}

function percentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

function valueTypeLabel(valueType: TimeAuditValueType) {
  return VALUE_TYPES.find((item) => item.value === valueType)?.label ?? valueType;
}

export default function TimeAuditPage() {
  const today = localDateKey();
  const [uid, setUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entries, setEntries] = useState<TimeAuditEntry[]>([]);
  const [monthKey, setMonthKey] = useState(monthKeyFromDate(today));
  const [dateKey, setDateKey] = useState(today);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(CATEGORIES[0]);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [valueType, setValueType] = useState<TimeAuditValueType>("investment");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUid(user?.uid ?? null);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!uid) {
      setEntries([]);
      return;
    }

    let cancelled = false;
    setEntriesLoading(true);
    setError(null);

    void (async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, "tenants", uid, "timeAuditEntries"),
            where("monthKey", "==", monthKey),
          ),
        );
        if (cancelled) return;

        const loaded = snapshot.docs
          .map((entry) => {
            const data = entry.data();
            if (
              data.archived === true ||
              typeof data.dateKey !== "string" ||
              typeof data.title !== "string" ||
              typeof data.category !== "string" ||
              typeof data.durationMinutes !== "number" ||
              !VALUE_TYPES.some((item) => item.value === data.valueType)
            ) {
              return null;
            }

            return {
              id: entry.id,
              dateKey: data.dateKey,
              title: data.title,
              category: data.category,
              durationMinutes: data.durationMinutes,
              valueType: data.valueType as TimeAuditValueType,
              note: typeof data.note === "string" ? data.note : "",
              createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
            } satisfies TimeAuditEntry;
          })
          .filter((entry): entry is TimeAuditEntry => entry !== null)
          .sort((a, b) => b.createdAt - a.createdAt);

        setEntries(loaded);
      } catch {
        if (!cancelled) {
          setEntries([]);
          setError("تعذر تحميل أنشطة هذا الشهر. حاول مرة أخرى.");
        }
      } finally {
        if (!cancelled) setEntriesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, monthKey]);

  const todayEntries = useMemo(
    () => entries.filter((entry) => entry.dateKey === dateKey),
    [entries, dateKey],
  );

  const analytics = useMemo(() => {
    const totalMinutes = entries.reduce((total, entry) => total + entry.durationMinutes, 0);
    const valueTypeTotals = Object.fromEntries(
      VALUE_TYPES.map((item) => [item.value, 0]),
    ) as Record<TimeAuditValueType, number>;
    const categoryTotals = new Map<string, number>();
    const activityTotals = new Map<string, number>();

    for (const entry of entries) {
      valueTypeTotals[entry.valueType] += entry.durationMinutes;
      categoryTotals.set(entry.category, (categoryTotals.get(entry.category) ?? 0) + entry.durationMinutes);
      activityTotals.set(entry.title, (activityTotals.get(entry.title) ?? 0) + entry.durationMinutes);
    }

    return {
      totalMinutes,
      recordedDays: new Set(entries.map((entry) => entry.dateKey)).size,
      monthDays: daysInMonth(monthKey),
      valueTypeTotals,
      categories: [...categoryTotals.entries()]
        .map(([name, minutes]) => ({ name, minutes }))
        .sort((a, b) => b.minutes - a.minutes),
      topActivities: [...activityTotals.entries()]
        .map(([title, minutes]) => ({ title, minutes }))
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 5),
    };
  }, [entries, monthKey]);

  function changeMonth(nextMonthKey: string) {
    if (!nextMonthKey) return;
    setMonthKey(nextMonthKey);
    setDateKey(dateForMonth(nextMonthKey, dateKey.slice(-2)));
  }

  function changeDate(nextDateKey: string) {
    if (!nextDateKey) return;
    setDateKey(nextDateKey);
    setMonthKey(monthKeyFromDate(nextDateKey));
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uid) return;

    const minutes = Number(durationMinutes);
    if (!title.trim() || !Number.isInteger(minutes) || minutes < 1) {
      setError("اكتب عنوان النشاط ومدة صحيحة بالدقائق.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const entryId = await addTimeAuditEntry({
        tenantId: uid,
        dateKey,
        monthKey: monthKeyFromDate(dateKey),
        title,
        category,
        durationMinutes: minutes,
        valueType,
        note,
      });
      setEntries((current) => [
        {
          id: entryId,
          dateKey,
          title: title.trim(),
          category,
          durationMinutes: minutes,
          valueType,
          note: note.trim(),
          createdAt: Date.now(),
        },
        ...current,
      ]);
      setTitle("");
      setDurationMinutes("");
      setNote("");
    } catch {
      setError("تعذر حفظ النشاط. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entryId: string) {
    if (!uid) return;
    setDeletingId(entryId);
    setError(null);
    try {
      await archiveTimeAuditEntry({ tenantId: uid, entryId });
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
    } catch {
      setError("تعذر حذف النشاط. حاول مرة أخرى.");
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading) return <div className="text-muted-foreground">جارٍ التحميل...</div>;

  if (!uid) {
    return (
      <main dir="rtl" className="space-y-3">
        <p className="text-muted-foreground">سجّل الدخول.</p>
        <Button asChild><Link href="/login?next=/time-audit">تسجيل الدخول</Link></Button>
      </main>
    );
  }

  const summaryCards: Array<[string, number, boolean]> = [
    ["إجمالي الوقت المسجل", analytics.totalMinutes, true],
    ["عدد الأيام المسجلة", analytics.recordedDays, false],
    ["وقت الاستثمار", analytics.valueTypeTotals.investment, true],
    ["وقت الضرورة", analytics.valueTypeTotals.necessity, true],
    ["وقت الترفيه", analytics.valueTypeTotals.entertainment, true],
    ["وقت الهدر", analytics.valueTypeTotals.waste, true],
  ];

  return (
    <main dir="rtl" className="mx-auto max-w-5xl space-y-5 pb-20">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">أين يذهب وقتي؟</h1>
        <p className="text-sm text-muted-foreground">سجّل أنشطتك اليومية لمدة شهر، ثم راقب أين يذهب وقتك فعلًا.</p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              <span>الشهر</span>
              <Input type="month" value={monthKey} onChange={(event) => changeMonth(event.target.value)} className="w-full sm:w-52" />
            </label>
            <p className="text-sm text-muted-foreground">تم التسجيل في {analytics.recordedDays} يوم من {analytics.monthDays} يوم</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>إضافة نشاط</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveEntry} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1.5 text-sm font-medium"><span>التاريخ</span><Input type="date" value={dateKey} onChange={(event) => changeDate(event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm font-medium lg:col-span-2"><span>النشاط</span><Input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="مثال: قراءة كتاب" /></label>
            <label className="grid gap-1.5 text-sm font-medium"><span>المدة بالدقائق</span><Input type="number" min="1" inputMode="numeric" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} required placeholder="45" /></label>
            <label className="grid gap-1.5 text-sm font-medium lg:col-span-2"><span>التصنيف</span><Select value={category} onValueChange={(value) => setCategory(value as (typeof CATEGORIES)[number])}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label>
            <label className="grid gap-1.5 text-sm font-medium lg:col-span-2"><span>نوع الوقت</span><Select value={valueType} onValueChange={(value) => setValueType(value as TimeAuditValueType)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{VALUE_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></label>
            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2 lg:col-span-3"><span>ملاحظة <span className="font-normal text-muted-foreground">(اختياري)</span></span><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="أي تفاصيل مفيدة..." className="min-h-20" /></label>
            <div className="flex items-end"><Button type="submit" className="w-full" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ النشاط"}</Button></div>
          </form>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">أنشطة اليوم</h2>
        {entriesLoading ? <p className="text-sm text-muted-foreground">جارٍ تحميل الأنشطة...</p> : todayEntries.length === 0 ? (
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">لا توجد أنشطة مسجلة لهذا اليوم بعد.</CardContent></Card>
        ) : <div className="grid gap-3 sm:grid-cols-2">{todayEntries.map((entry) => (
          <Card key={entry.id}><CardContent className="space-y-3 pt-6"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{entry.title}</h3><p className="mt-1 text-sm text-muted-foreground">{entry.category} · {formatDuration(entry.durationMinutes)} · {valueTypeLabel(entry.valueType)}</p></div><Button type="button" variant="ghost" size="sm" onClick={() => void deleteEntry(entry.id)} disabled={deletingId === entry.id}>{deletingId === entry.id ? "جارٍ الحذف..." : "حذف"}</Button></div>{entry.note && <p className="text-sm text-muted-foreground">{entry.note}</p>}</CardContent></Card>
        ))}</div>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">ملخص الشهر</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{summaryCards.map(([label, value, isDuration]) => <Card key={label}><CardContent className="space-y-1 pt-6"><p className="text-xs text-muted-foreground">{label}</p><p className="font-bold">{isDuration ? formatDuration(value) : value}</p></CardContent></Card>)}</div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>التصنيفات</CardTitle></CardHeader><CardContent>{analytics.categories.length === 0 ? <p className="text-sm text-muted-foreground">ابدأ بإضافة نشاط لتظهر الملخصات هنا.</p> : <div className="space-y-3">{analytics.categories.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 text-sm"><span>{item.name}</span><span className="shrink-0 text-muted-foreground">{formatDuration(item.minutes)} · {percentage(item.minutes, analytics.totalMinutes)}%</span></div>)}</div>}</CardContent></Card>
        <Card><CardHeader><CardTitle>نوع الوقت</CardTitle></CardHeader><CardContent><div className="space-y-3">{VALUE_TYPES.map((item) => { const minutes = analytics.valueTypeTotals[item.value]; return <div key={item.value} className="flex items-center justify-between gap-3 text-sm"><span>{item.label}</span><span className="shrink-0 text-muted-foreground">{formatDuration(minutes)} · {percentage(minutes, analytics.totalMinutes)}%</span></div>; })}</div></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>أكثر الأنشطة وقتًا</CardTitle></CardHeader><CardContent>{analytics.topActivities.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد أنشطة مسجلة لهذا الشهر بعد.</p> : <ol className="space-y-3">{analytics.topActivities.map((item, index) => <li key={item.title} className="flex items-center justify-between gap-3 text-sm"><span>{index + 1}. {item.title}</span><span className="shrink-0 text-muted-foreground">{formatDuration(item.minutes)}</span></li>)}</ol>}</CardContent></Card>
    </main>
  );
}


