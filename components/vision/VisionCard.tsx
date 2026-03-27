"use client";

import { useMemo, useState } from "react";
import type { Vision } from "./types";
import { isLoopExecutionAllowed } from "./utils";

type Props = {
  vision: Vision;
  onToggleDailyTask: (visionId: string, taskId: string) => void;
  onAdvanceLoop: (visionId: string) => void;
};

const SECTION_LABELS: Record<Vision["section"], string> = {
  daily: "مهام يومية",
  loop: "اللوب المتوالي",
  mindset: "نمط تفكير وحياة",
  identity: "هوية",
  goals: "أهداف",
};

const EXECUTION_LABELS: Record<Vision["executionType"], string> = {
  none: "بدون تنفيذ",
  daily_tasks: "مهام يومية",
  sequential_loop: "لوب متوالي",
};

export default function VisionCard({
  vision,
  onToggleDailyTask,
  onAdvanceLoop,
}: Props) {
  const [open, setOpen] = useState(false);

  const dailyTasks = vision.dailyTasks?.filter((t) => t.isActive) ?? [];
  const loopTasks = vision.loopTasks?.filter((t) => t.isActive) ?? [];

  const completedDailyIds = vision.completedDailyTaskIdsToday ?? [];
  const completedDailyCount = dailyTasks.filter((t) =>
    completedDailyIds.includes(t.id),
  ).length;

  const loopAllowed = isLoopExecutionAllowed(vision.allowedLoopDays);
  const currentLoopIndex = vision.loopState?.currentTaskIndex ?? 0;
  const currentLoopTask = loopTasks[currentLoopIndex] ?? null;
  const cycleCount = vision.loopState?.cycleCount ?? 0;

  const loopProgressText = useMemo(() => {
    if (!loopTasks.length) return "لا توجد مهام";
    return `${Math.min(currentLoopIndex + 1, loopTasks.length)} من ${loopTasks.length}`;
  }, [currentLoopIndex, loopTasks.length]);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">{vision.title}</h3>

            <span className="rounded-full border px-2 py-0.5 text-xs">
              {SECTION_LABELS[vision.section]}
            </span>

            <span className="rounded-full border px-2 py-0.5 text-xs">
              {EXECUTION_LABELS[vision.executionType]}
            </span>
          </div>

          {vision.executionType === "daily_tasks" && (
            <p className="text-sm text-muted-foreground">
              تم اليوم: {completedDailyCount} من {dailyTasks.length}
            </p>
          )}

          {vision.executionType === "sequential_loop" && (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>الختمات المكتملة: {cycleCount}</p>
              <p>التقدم الحالي: {loopProgressText}</p>
              {currentLoopTask ? (
                <p>المهمة الحالية: {currentLoopTask.title}</p>
              ) : null}
              <p>
                الحالة اليوم: {loopAllowed ? "متاح للتنفيذ" : "غير متاح اليوم"}
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-accent"
          >
            {open ? "طي" : "فتح"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 space-y-4 border-t pt-4">
          <div>
            <h4 className="mb-1 font-semibold">شرح مفصل للرؤية</h4>
            <p className="text-sm leading-7 text-muted-foreground">
              {vision.description}
            </p>
          </div>

          <div>
            <h4 className="mb-1 font-semibold">الترغيب</h4>
            <p className="text-sm leading-7 text-muted-foreground">
              {vision.motivation}
            </p>
          </div>

          <div>
            <h4 className="mb-1 font-semibold">الترهيب</h4>
            <p className="text-sm leading-7 text-muted-foreground">
              {vision.warning}
            </p>
          </div>

          <div>
            <h4 className="mb-1 font-semibold">كيف</h4>
            <p className="text-sm leading-7 text-muted-foreground">
              {vision.howTo}
            </p>
          </div>

          {vision.executionType === "daily_tasks" && (
            <div className="space-y-3">
              <h4 className="font-semibold">المهام اليومية</h4>

              {dailyTasks.length ? (
                <div className="space-y-2">
                  {dailyTasks.map((task) => {
                    const done = completedDailyIds.includes(task.id);

                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-xl border p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{task.title}</p>
                          {task.note ? (
                            <p className="text-sm text-muted-foreground">
                              {task.note}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => onToggleDailyTask(vision.id, task.id)}
                          className="rounded-xl border px-3 py-2 text-sm hover:bg-accent"
                        >
                          {done ? "إلغاء الإنجاز" : "تم الإنجاز"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  لا توجد مهام يومية مضافة بعد.
                </p>
              )}
            </div>
          )}

          {vision.executionType === "sequential_loop" && (
            <div className="space-y-3">
              <h4 className="font-semibold">اللوب المتوالي</h4>

              {!loopAllowed ? (
                <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                  هذا اللوب يعمل فقط الجمعة والسبت والإجازات.
                </div>
              ) : null}

              {currentLoopTask ? (
                <div className="rounded-xl border p-3">
                  <p className="mb-1 text-sm text-muted-foreground">
                    المهمة الحالية الآن
                  </p>
                  <p className="font-semibold">{currentLoopTask.title}</p>
                  {currentLoopTask.note ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {currentLoopTask.note}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    disabled={!loopAllowed}
                    onClick={() => onAdvanceLoop(vision.id)}
                    className="mt-3 rounded-xl border px-3 py-2 text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    تم إنجاز المهمة الحالية
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  لا توجد مهام متوالية مضافة بعد.
                </p>
              )}

              {loopTasks.length ? (
                <div className="space-y-2">
                  {loopTasks.map((task, index) => {
                    const isCurrent = index === currentLoopIndex;

                    return (
                      <div
                        key={task.id}
                        className={`rounded-xl border p-3 ${
                          isCurrent ? "border-foreground/30" : ""
                        }`}
                      >
                        <p className="font-medium">
                          {index + 1}. {task.title}
                        </p>
                        {task.note ? (
                          <p className="text-sm text-muted-foreground">
                            {task.note}
                          </p>
                        ) : null}
                        {isCurrent ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            هذه هي المهمة الحالية
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
