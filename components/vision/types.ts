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

export type VisionTask = {
  id: string;
  title: string;
  note?: string;
  sortOrder: number;
  isActive: boolean;
};

export type Vision = {
  id: string;
  title: string;
  description: string;
  motivation: string;
  warning: string;
  howTo: string;

  section: VisionSection;
  executionType: VisionExecutionType;

  isActive: boolean;
  sortOrder: number;

  dailyTasks?: VisionTask[];
  loopTasks?: VisionTask[];

  completedDailyTaskIdsToday?: string[];

  loopState?: {
    currentTaskIndex: number;
    cycleCount: number;
    lastCycleCompletedAt?: string | null;
  };

  allowedLoopDays?: Array<"friday" | "saturday" | "holiday">;

  createdAt?: string;
  updatedAt?: string;
};