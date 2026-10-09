"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { ArrowLeft, ArrowRight, Check, CirclePause, Moon, Play, Sun, Sunrise } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { auth, db } from "@/lib/firebase";
import {
  MORNING_QUESTIONS,
  MORNING_SECTIONS,
  type ResetDaySession,
  type ResetDayStatus,
  resetDayStatusLabel,
} from "@/lib/reset-day";
import {
  completeResetDayMorning,
  createResetDaySession,
  saveResetDayMorningProgress,
} from "@/lib/reset-day-actions";

type SaveState = "idle" | "saving" | "saved" | "error";

function sessionFromSnapshot(id: string, data: Record<string, unknown>): ResetDaySession | null {
  const status = data.status;
  if (
    typeof data.tenantId !== "string" ||
    typeof data.sessionDate !== "string" ||
    !["MORNING", "DAYTIME", "EVENING", "COMPLETED"].includes(String(status))
  ) {
    return null;
  }

  const answers = data.answers;
  return {
    id,
    tenantId: data.tenantId,
    title: typeof data.title === "string" ? data.title : "يوم إعادة ضبط المسار",
    sessionDate: data.sessionDate,
    status: status as ResetDayStatus,
    currentPhase:
      data.currentPhase === "daytime" || data.currentPhase === "evening" || data.currentPhase === "final_path_map"
        ? data.currentPhase
        : "morning",
    currentMorningQuestion:
      typeof data.currentMorningQuestion === "number" ? data.currentMorningQuestion : 0,
    answers:
      answers && typeof answers === "object"
        ? Object.fromEntries(
            Object.entries(answers).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
          )
        : {},
    createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
    startedAt: typeof data.startedAt === "number" ? data.startedAt : 0,
    morningCompletedAt: typeof data.morningCompletedAt === "number" ? data.morningCompletedAt : null,
    completedAt: typeof data.completedAt === "number" ? data.completedAt : null,
  };
}

function formatSessionDate(session: ResetDaySession) {
  const date = session.startedAt ? new Date(session.startedAt) : new Date(`${session.sessionDate}T12:00:00`);
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    dateStyle: "medium",
  }).format(date);
}

function PhaseCard({
  title,
  subtitle,
  icon: Icon,
  active = false,
}: {
  title: string;
  subtitle: string;
  icon: typeof Sunrise;
  active?: boolean;
}) {
  return (
    <Card className={active ? "border-primary/50 bg-primary/5" : ""}>
      <CardContent className="flex gap-3 pt-6">
        <Icon className="mt-0.5 size-5 text-primary" aria-hidden="true" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MorningJourney({
  tenantId,
  session,
  onBack,
}: {
  tenantId: string;
  session: ResetDaySession;
  onBack: () => void;
}) {
  const initialIndex = Math.min(
    Math.max(session.currentMorningQuestion, 0),
    MORNING_QUESTIONS.length - 1,
  );
  const [answers, setAnswers] = useState<Record<string, string>>(session.answers);
  const [questionIndex, setQuestionIndex] = useState(initialIndex);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [completing, setCompleting] = useState(false);
  const answersRef = useRef(answers);
  const indexRef = useRef(questionIndex);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const nextIndex = Math.min(
      Math.max(session.currentMorningQuestion, 0),
      MORNING_QUESTIONS.length - 1,
    );
    setAnswers(session.answers);
    setQuestionIndex(nextIndex);
    answersRef.current = session.answers;
    indexRef.current = nextIndex;
    dirtyRef.current = false;
    setSaveState("idle");
  }, [session.id]);

  const persist = useCallback(
    async (nextAnswers: Record<string, string>, nextIndex: number) => {
      setSaveState("saving");
      try {
        await saveResetDayMorningProgress({
          tenantId,
          sessionId: session.id,
          answers: nextAnswers,
          currentMorningQuestion: nextIndex,
        });
        if (answersRef.current === nextAnswers && indexRef.current === nextIndex) {
          dirtyRef.current = false;
        }
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [session.id, tenantId],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current) {
        void persist(answersRef.current, indexRef.current);
      }
    };
  }, [persist]);

  function scheduleSave(nextAnswers: Record<string, string>) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void persist(nextAnswers, indexRef.current);
    }, 800);
  }

  function updateAnswer(event: ChangeEvent<HTMLTextAreaElement>) {
    const questionId = MORNING_QUESTIONS[questionIndex].id;
    const nextAnswers = { ...answersRef.current, [questionId]: event.target.value };
    answersRef.current = nextAnswers;
    dirtyRef.current = true;
    setAnswers(nextAnswers);
    setSaveState("saving");
    scheduleSave(nextAnswers);
  }

  async function moveTo(nextIndex: number) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    indexRef.current = nextIndex;
    setQuestionIndex(nextIndex);
    await persist(answersRef.current, nextIndex);
  }

  async function completeMorning() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCompleting(true);
    setSaveState("saving");
    try {
      await completeResetDayMorning({
        tenantId,
        sessionId: session.id,
        answers: answersRef.current,
        currentMorningQuestion: questionIndex,
      });
      dirtyRef.current = false;
      setSaveState("saved");
    } catch {
      setSaveState("error");
    } finally {
      setCompleting(false);
    }
  }

  if (session.status !== "MORNING") {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>اكتمل صباحك بهدوء</CardTitle>
          <CardDescription>
            سجّلت ما تحتاجه من كشف الواقع والرؤية. مرحلة النهار ستأتي لاحقًا لتساعدك على ملاحظة مقاطعات الطيار الآلي.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={onBack}>العودة إلى الجلسات</Button>
        </CardContent>
      </Card>
    );
  }

  const question = MORNING_QUESTIONS[questionIndex];
  const progress = ((questionIndex + 1) / MORNING_QUESTIONS.length) * 100;
  const canGoBack = questionIndex > 0;
  const isLastQuestion = questionIndex === MORNING_QUESTIONS.length - 1;

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <button type="button" className="hover:text-foreground" onClick={onBack}>العودة إلى الجلسات</button>
        <span>{saveState === "saving" ? "جارٍ الحفظ..." : saveState === "saved" ? "تم الحفظ" : saveState === "error" ? "تعذر الحفظ" : ""}</span>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{MORNING_SECTIONS[question.sectionId]}</span>
            <span>محطة {questionIndex + 1} من {MORNING_QUESTIONS.length}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <CardTitle className="text-xl leading-relaxed sm:text-2xl">{question.text}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Textarea
            value={answers[question.id] ?? ""}
            onChange={updateAnswer}
            placeholder="اكتب بهدوء وبصدق…"
            className="min-h-56 resize-y text-base leading-8"
            aria-label={question.text}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => void moveTo(questionIndex - 1)} disabled={!canGoBack || saveState === "saving"}>
              <ArrowRight />
              السابق
            </Button>
            {isLastQuestion ? (
              <Button type="button" onClick={() => void completeMorning()} disabled={completing || saveState === "saving"}>
                <Check />
                {completing ? "جارٍ الإكمال..." : "إنهاء مرحلة الصباح"}
              </Button>
            ) : (
              <Button type="button" onClick={() => void moveTo(questionIndex + 1)} disabled={saveState === "saving"}>
                التالي
                <ArrowLeft />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function ResetDayClient() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ResetDaySession[]>([]);
  const [openedSessionId, setOpenedSessionId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUid(user?.uid ?? null);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!uid) {
      setSessions([]);
      return;
    }

    setError(null);
    const sessionsRef = collection(db, "tenants", uid, "resetDaySessions");
    return onSnapshot(
      query(sessionsRef, orderBy("updatedAt", "desc"), limit(50)),
      (snapshot) => {
        setSessions(
          snapshot.docs
            .map((item) => sessionFromSnapshot(item.id, item.data() as Record<string, unknown>))
            .filter((session): session is ResetDaySession => session !== null),
        );
      },
      () => setError("تعذر تحميل جلسات إعادة ضبط المسار. حاول مرة أخرى."),
    );
  }, [uid]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.status !== "COMPLETED") ?? null,
    [sessions],
  );
  const openedSession = useMemo(
    () => sessions.find((session) => session.id === openedSessionId) ?? null,
    [openedSessionId, sessions],
  );

  async function startNewSession() {
    if (!uid) return;
    setCreating(true);
    setError(null);
    try {
      const sessionId = await createResetDaySession(uid);
      setOpenedSessionId(sessionId);
    } catch {
      setError("تعذر بدء يوم جديد. حاول مرة أخرى.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="text-muted-foreground">جارٍ التحميل...</div>;
  if (!uid) return <div dir="rtl" className="text-muted-foreground">سجّل الدخول.</div>;
  if (openedSession) {
    return <MorningJourney tenantId={uid} session={openedSession} onBack={() => setOpenedSessionId(null)} />;
  }

  return (
    <main dir="rtl" className="mx-auto max-w-5xl space-y-6 pb-20">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">يوم إعادة ضبط المسار</h1>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
          رحلة هادئة ليوم واحد: ترى واقعك كما هو، تلاحظ ما يقطع طيارك الآلي، ثم تخرج بخيط أوضح لمسارك.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <PhaseCard title="الصباح — التنقيب النفسي" subtitle="كشف الواقع، والرؤية المضادة، والرؤية الأولية." icon={Sunrise} active />
        <PhaseCard title="النهار — مقاطعة الطيار الآلي" subtitle="مساحة ستأتي لاحقًا لملاحظة المقاطعات لحظة حدوثها." icon={Sun} />
        <PhaseCard title="المساء — صهر الاستبصار" subtitle="مساحة ستأتي لاحقًا لجمع ما ظهر وتحويله إلى مسار." icon={Moon} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div>
            <p className="font-semibold">خذ اليوم على مهل</p>
            <p className="mt-1 text-sm text-muted-foreground">ستبدأ الآن برحلة الصباح فقط، وتحفظ إجاباتك تلقائيًا.</p>
          </div>
          <Button type="button" onClick={() => void startNewSession()} disabled={creating}>
            <Play />
            {creating ? "جارٍ البدء..." : "ابدأ يومًا جديدًا"}
          </Button>
        </CardContent>
      </Card>

      {activeSession && (
        <Card className="border-primary/35">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div>
              <p className="font-semibold">لديك يوم لم يكتمل بعد</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatSessionDate(activeSession)} · {resetDayStatusLabel(activeSession.status)}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setOpenedSessionId(activeSession.id)}>
              <CirclePause />
              استكمل يومك
            </Button>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">الجلسات السابقة</h2>
        {sessions.length === 0 ? (
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">لم تبدأ يوم إعادة ضبط المسار بعد.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                  <div>
                    <p className="font-semibold">{session.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatSessionDate(session)} · {resetDayStatusLabel(session.status)}</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setOpenedSessionId(session.id)}>
                    {session.status === "COMPLETED" ? "فتح" : "استكمل"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
