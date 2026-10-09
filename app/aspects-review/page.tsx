"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { auth, db } from "@/lib/firebase";
import {
  saveAspectsCurrentReview,
  saveAspectsReviewHistory,
  type AspectsCurrentReview,
  type AspectsReviewHistory,
} from "@/lib/profile-actions";
import { ensureAspectsTemplate } from "@/lib/templates/aspects";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

type Aspect = {
  id: string;
  title: string;
};

type ReviewItem = {
  score: number | null;
  currentState: string;
  challenge: string;
  nextStep: string;
};

type ReviewSummary = {
  averageScore: number | null;
  strongCount: number;
  weakCount: number;
  needsImprovementCount: number;
  ratedCount: number;
  totalCount: number;
};

type HistoricalAssessment = AspectsReviewHistory & {
  id: string;
};

type LatestAssessment = ReviewSummary & {
  reviewDateLabel: string;
};

type StoredReview = Partial<AspectsCurrentReview>;

const emptyReviewItem = (): ReviewItem => ({
  score: null,
  currentState: "",
  challenge: "",
  nextStep: "",
});

function scoreStatus(score: number | null) {
  if (score === null) return "غير مقيّم";
  if (score <= 3) return "يحتاج إنقاذ";
  if (score <= 6) return "يحتاج تحسين";
  if (score <= 8) return "جيد";
  return "ممتاز";
}

function reviewItemFromStored(item: unknown): ReviewItem {
  if (!item || typeof item !== "object") return emptyReviewItem();

  const stored = item as Partial<ReviewItem>;
  const score =
    typeof stored.score === "number" &&
    Number.isInteger(stored.score) &&
    stored.score >= 1 &&
    stored.score <= 10
      ? stored.score
      : null;

  return {
    score,
    currentState:
      typeof stored.currentState === "string" ? stored.currentState : "",
    challenge: typeof stored.challenge === "string" ? stored.challenge : "",
    nextStep: typeof stored.nextStep === "string" ? stored.nextStep : "",
  };
}

function itemsForAspects(
  aspects: Aspect[],
  storedItems: Record<string, unknown> | undefined,
) {
  return Object.fromEntries(
    aspects.map((aspect) => [
      aspect.id,
      reviewItemFromStored(storedItems?.[aspect.id]),
    ]),
  ) as Record<string, ReviewItem>;
}

function calculateSummary(
  aspects: Aspect[],
  items: Record<string, ReviewItem>,
): ReviewSummary {
  const scores = aspects
    .map((aspect) => items[aspect.id]?.score)
    .filter((score): score is number => typeof score === "number");
  const ratedCount = scores.length;

  return {
    averageScore:
      ratedCount === 0
        ? null
        : Number(
            (
              scores.reduce((total, score) => total + score, 0) / ratedCount
            ).toFixed(1),
          ),
    strongCount: scores.filter((score) => score >= 8).length,
    weakCount: scores.filter((score) => score <= 3).length,
    needsImprovementCount: scores.filter(
      (score) => score >= 4 && score <= 7,
    ).length,
    ratedCount,
    totalCount: aspects.length,
  };
}

function reviewDateDetails(timestamp: number) {
  const date = new Date(timestamp);
  const reviewDateKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

  return {
    reviewDateKey,
    reviewDateLabel: new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date),
  };
}

function historicalAssessmentFromDocument(
  id: string,
  data: Record<string, unknown>,
): HistoricalAssessment | null {
  if (
    typeof data.reviewDateLabel !== "string" ||
    typeof data.reviewDateKey !== "string" ||
    !data.items ||
    typeof data.items !== "object"
  ) {
    return null;
  }

  return {
    id,
    parentId: "aspect_reviews",
    type: "aspect_review",
    title:
      typeof data.title === "string" ? data.title : "تقييم الوضع الحالي",
    reviewKind: "aspects_current_assessment",
    reviewDateKey: data.reviewDateKey,
    reviewDateLabel: data.reviewDateLabel,
    averageScore:
      typeof data.averageScore === "number" ? data.averageScore : null,
    strongCount: typeof data.strongCount === "number" ? data.strongCount : 0,
    weakCount: typeof data.weakCount === "number" ? data.weakCount : 0,
    needsImprovementCount:
      typeof data.needsImprovementCount === "number"
        ? data.needsImprovementCount
        : 0,
    ratedCount: typeof data.ratedCount === "number" ? data.ratedCount : 0,
    totalCount: typeof data.totalCount === "number" ? data.totalCount : 0,
    items: data.items as AspectsCurrentReview["items"],
    createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
    orderKey: typeof data.orderKey === "string" ? data.orderKey : "",
    archived: false,
    version: 1,
  };
}

function summaryFromAssessment(assessment: HistoricalAssessment): ReviewSummary {
  return {
    averageScore: assessment.averageScore,
    strongCount: assessment.strongCount,
    weakCount: assessment.weakCount,
    needsImprovementCount: assessment.needsImprovementCount,
    ratedCount: assessment.ratedCount,
    totalCount: assessment.totalCount,
  };
}

function SummaryStats({ summary }: { summary: ReviewSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      <div>
        <div className="text-muted-foreground">متوسط التقييم</div>
        <div className="mt-1 font-bold">
          {summary.averageScore?.toFixed(1) ?? "—"} / 10
        </div>
      </div>
      <div>
        <div className="text-muted-foreground">جوانب قوية</div>
        <div className="mt-1 font-bold">{summary.strongCount}</div>
      </div>
      <div>
        <div className="text-muted-foreground">تحتاج تحسين</div>
        <div className="mt-1 font-bold">{summary.needsImprovementCount}</div>
      </div>
      <div>
        <div className="text-muted-foreground">تحتاج إنقاذ</div>
        <div className="mt-1 font-bold">{summary.weakCount}</div>
      </div>
    </div>
  );
}

export default function AspectsReviewPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [aspects, setAspects] = useState<Aspect[]>([]);
  const [history, setHistory] = useState<HistoricalAssessment[]>([]);
  const [latestAssessment, setLatestAssessment] =
    useState<LatestAssessment | null>(null);
  const [draftItems, setDraftItems] = useState<Record<string, ReviewItem>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (cancelled) return;

      if (!user) {
        setUid(null);
        setAspects([]);
        setHistory([]);
        setLatestAssessment(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);
      setUid(user.uid);

      try {
        const tenantId = user.uid;
        await ensureAspectsTemplate(tenantId);

        const nodesRef = collection(db, "tenants", tenantId, "nodes");
        const aspectsQuery = query(
          nodesRef,
          where("parentId", "==", "asp_sec_main"),
          where("type", "==", "card"),
          where("archived", "==", false),
          orderBy("orderKey"),
        );
        const historyQuery = query(
          nodesRef,
          where("type", "==", "aspect_review"),
          where("reviewKind", "==", "aspects_current_assessment"),
          where("archived", "==", false),
          orderBy("createdAt", "desc"),
          limit(10),
        );
        const fallbackHistoryQuery = query(
          nodesRef,
          orderBy("createdAt", "desc"),
        );

        const [aspectsSnapshot, userSnapshot] = await Promise.all([
          getDocs(aspectsQuery),
          getDoc(doc(db, "users", user.uid)),
        ]);
        const historyDocs = await (async () => {
          try {
            return (await getDocs(historyQuery)).docs;
          } catch {
            return (await getDocs(fallbackHistoryQuery)).docs
              .filter((assessment) => {
                const data = assessment.data();
                return (
                  data.type === "aspect_review" &&
                  data.reviewKind === "aspects_current_assessment" &&
                  data.archived === false
                );
              })
              .slice(0, 10);
          }
        })();

        if (cancelled) return;

        const loadedAspects = aspectsSnapshot.docs.map((aspect) => {
          const data = aspect.data();
          return {
            id: aspect.id,
            title: typeof data.title === "string" ? data.title : "جانب بلا عنوان",
          };
        });
        const savedReview = userSnapshot.exists()
          ? (userSnapshot.data().aspectsCurrentReview as StoredReview | undefined)
          : undefined;
        const savedItems = savedReview?.items as
          | Record<string, unknown>
          | undefined;
        const loadedHistory = historyDocs
          .map((assessment) =>
            historicalAssessmentFromDocument(
              assessment.id,
              assessment.data() as Record<string, unknown>,
            ),
          )
          .filter(
            (assessment): assessment is HistoricalAssessment => assessment !== null,
          );

        setAspects(loadedAspects);
        setHistory(loadedHistory);
        setDraftItems(itemsForAspects(loadedAspects, undefined));
        setLatestAssessment(() => {
          if (loadedHistory[0]) {
            return {
              reviewDateLabel: loadedHistory[0].reviewDateLabel,
              ...summaryFromAssessment(loadedHistory[0]),
            };
          }

          if (!savedReview) return null;

          const summary = calculateSummary(
            loadedAspects,
            itemsForAspects(loadedAspects, savedItems),
          );
          const updatedAt =
            typeof savedReview.updatedAt === "number"
              ? savedReview.updatedAt
              : Date.now();
          return {
            reviewDateLabel: reviewDateDetails(updatedAt).reviewDateLabel,
            ...summary,
          };
        });
      } catch {
        if (!cancelled) {
          setLoadError("تعذر تحميل الجوانب. حاول مرة أخرى.");
          setAspects([]);
          setHistory([]);
          setLatestAssessment(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const draftSummary = useMemo(
    () => calculateSummary(aspects, draftItems),
    [aspects, draftItems],
  );

  function startNewAssessment() {
    setDraftItems(itemsForAspects(aspects, undefined));
    setFormOpen(true);
    setSaveError(null);
    setSaveSuccess(false);
  }

  function cancelNewAssessment() {
    setFormOpen(false);
    setDraftItems(itemsForAspects(aspects, undefined));
    setSaveError(null);
  }

  function updateDraftItem(aspectId: string, update: Partial<ReviewItem>) {
    setDraftItems((current) => ({
      ...current,
      [aspectId]: { ...(current[aspectId] ?? emptyReviewItem()), ...update },
    }));
  }

  function buildCurrentReview(updatedAt: number): AspectsCurrentReview {
    return {
      updatedAt,
      averageScore: draftSummary.averageScore,
      items: Object.fromEntries(
        aspects.map((aspect) => {
          const item = draftItems[aspect.id] ?? emptyReviewItem();
          return [
            aspect.id,
            {
              aspectId: aspect.id,
              title: aspect.title,
              score: item.score,
              currentState: item.currentState,
              challenge: item.challenge,
              nextStep: item.nextStep,
              updatedAt,
            },
          ];
        }),
      ),
    };
  }

  async function saveNewAssessment() {
    if (!uid) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const now = Date.now();
      const currentReview = buildCurrentReview(now);
      const date = reviewDateDetails(now);
      const historicalAssessment: AspectsReviewHistory = {
        parentId: "aspect_reviews",
        type: "aspect_review",
        title: `تقييم الوضع الحالي - ${date.reviewDateKey}`,
        reviewKind: "aspects_current_assessment",
        ...date,
        averageScore: draftSummary.averageScore,
        strongCount: draftSummary.strongCount,
        weakCount: draftSummary.weakCount,
        needsImprovementCount: draftSummary.needsImprovementCount,
        ratedCount: draftSummary.ratedCount,
        totalCount: draftSummary.totalCount,
        items: currentReview.items,
        createdAt: now,
        updatedAt: now,
        orderKey: String(now),
        archived: false,
        version: 1,
      };
      const [, historyId] = await Promise.all([
        saveAspectsCurrentReview(uid, currentReview),
        saveAspectsReviewHistory(uid, historicalAssessment),
      ]);
      const savedAssessment = { id: historyId, ...historicalAssessment };

      setHistory((current) => [savedAssessment, ...current].slice(0, 10));
      setLatestAssessment({
        reviewDateLabel: savedAssessment.reviewDateLabel,
        ...summaryFromAssessment(savedAssessment),
      });
      setDraftItems(itemsForAspects(aspects, undefined));
      setFormOpen(false);
      setSaveSuccess(true);
    } catch {
      setSaveError("تعذر حفظ التقييم. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;
  }

  if (!uid) {
    return <div className="text-muted-foreground">سجّل الدخول.</div>;
  }

  return (
    <main className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">تقييم الوضع الحالي</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تابع تقييمات الجوانب وسجّل تقييمًا جديدًا عند الحاجة.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={startNewAssessment} disabled={formOpen || aspects.length === 0}>
            + تقييم جديد
          </Button>
          <Button asChild variant="outline">
            <Link href="/aspects">العودة إلى الجوانب</Link>
          </Button>
        </div>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {saveSuccess && <p className="text-sm text-primary">تم حفظ التقييم.</p>}

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-xl font-bold">آخر تقييم</h2>
        {latestAssessment ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {latestAssessment.reviewDateLabel}
            </p>
            <SummaryStats summary={latestAssessment} />
            <p className="text-sm text-muted-foreground">
              المقيّم: {latestAssessment.ratedCount} / {latestAssessment.totalCount}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            لا توجد تقييمات بعد. اضغط على + تقييم جديد لبدء أول تقييم.
          </p>
        )}
      </section>

      {formOpen && (
        <section className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">تقييم جديد</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                قيّم كل جانب وحدد خطوة تحسين عملية واحدة.
              </p>
            </div>
            {draftSummary.ratedCount > 0 && (
              <span className="text-sm text-muted-foreground">
                متوسط التقييم: {draftSummary.averageScore?.toFixed(1)} / 10
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {aspects.map((aspect) => {
              const item = draftItems[aspect.id] ?? emptyReviewItem();

              return (
                <article key={aspect.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold">{aspect.title}</h3>
                    <span className="text-sm text-muted-foreground">
                      {scoreStatus(item.score)}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-sm font-medium">التقييم من 1 إلى 10</div>
                    <div className="flex flex-wrap gap-2" dir="ltr">
                      {Array.from({ length: 10 }, (_, index) => index + 1).map(
                        (score) => (
                          <Button
                            key={score}
                            type="button"
                            size="sm"
                            variant={item.score === score ? "default" : "outline"}
                            onClick={() => updateDraftItem(aspect.id, { score })}
                            aria-pressed={item.score === score}
                          >
                            {score}
                          </Button>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span>الوضع الحالي</span>
                      <Input
                        value={item.currentState}
                        onChange={(event) =>
                          updateDraftItem(aspect.id, {
                            currentState: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span>أهم تحدي</span>
                      <Textarea
                        value={item.challenge}
                        onChange={(event) =>
                          updateDraftItem(aspect.id, { challenge: event.target.value })
                        }
                      />
                    </label>
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span>خطوة تحسين واحدة</span>
                      <Textarea
                        value={item.nextStep}
                        onChange={(event) =>
                          updateDraftItem(aspect.id, { nextStep: event.target.value })
                        }
                      />
                    </label>
                  </div>
                </article>
              );
            })}
          </div>

          {saveError && <p className="mt-4 text-sm text-destructive">{saveError}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={saveNewAssessment} disabled={saving || aspects.length === 0}>
              {saving ? "جارٍ الحفظ..." : "حفظ التقييم"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={cancelNewAssessment}
              disabled={saving}
            >
              إلغاء
            </Button>
          </div>
        </section>
      )}

      {aspects.length === 0 && !loadError && (
        <p className="text-sm text-muted-foreground">لا توجد جوانب متاحة بعد.</p>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">سجل التقييمات</h2>
        {history.length === 0 ? (
          <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            لا توجد تقييمات سابقة بعد.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {history.map((assessment) => {
              const isOpen = openHistoryId === assessment.id;

              return (
                <article key={assessment.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{assessment.reviewDateLabel}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        متوسط التقييم: {assessment.averageScore?.toFixed(1) ?? "—"} / 10
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        المقيّم: {assessment.ratedCount} / {assessment.totalCount}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setOpenHistoryId((current) =>
                          current === assessment.id ? null : assessment.id,
                        )
                      }
                    >
                      {isOpen ? "إغلاق التفاصيل" : "عرض التفاصيل"}
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      <SummaryStats summary={summaryFromAssessment(assessment)} />
                      <div className="space-y-3">
                        {Object.values(assessment.items).map((item) => (
                          <div key={item.aspectId} className="rounded-lg border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="font-medium">{item.title}</h4>
                              <span className="text-sm text-muted-foreground">
                                {item.score ?? "—"} · {scoreStatus(item.score)}
                              </span>
                            </div>
                            <dl className="mt-3 space-y-2 text-sm">
                              <div>
                                <dt className="text-muted-foreground">الوضع الحالي</dt>
                                <dd>{item.currentState || "—"}</dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">أهم تحدي</dt>
                                <dd>{item.challenge || "—"}</dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">خطوة تحسين واحدة</dt>
                                <dd>{item.nextStep || "—"}</dd>
                              </div>
                            </dl>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}