export const RESET_DAY_STATUSES = [
  "MORNING",
  "DAYTIME",
  "EVENING",
  "COMPLETED",
] as const;

export type ResetDayStatus = (typeof RESET_DAY_STATUSES)[number];

export type ResetDayPhase = "morning" | "daytime" | "evening" | "final_path_map";

export type ResetDayQuestion = {
  id: string;
  sectionId: "reality" | "anti_vision" | "initial_vision";
  text: string;
};

export const MORNING_SECTIONS = {
  reality: "كشف الواقع",
  anti_vision: "الرؤية المضادة",
  initial_vision: "الرؤية الأولية",
} as const;

export const MORNING_QUESTIONS: ResetDayQuestion[] = [
  {
    id: "morning_reality_01",
    sectionId: "reality",
    text: "ما الشيء الذي يزعجك باستمرار، لكنك اعتدت وجوده حتى صار جزءًا طبيعيًا من حياتك؟",
  },
  {
    id: "morning_reality_02",
    sectionId: "reality",
    text: "ما أكثر ثلاثة أشياء اشتكيت منها خلال السنة الماضية، ومع ذلك لم تغيّرها فعليًا؟",
  },
  {
    id: "morning_reality_03",
    sectionId: "reality",
    text: "لو راقب شخص أفعالك بدل كلامك، فماذا سيعتقد أنك تريده فعلًا من حياتك؟",
  },
  {
    id: "morning_reality_04",
    sectionId: "reality",
    text: "ما الحقيقة عن حياتك الحالية التي يصعب عليك الاعتراف بها أمام شخص تحترمه؟",
  },
  {
    id: "morning_anti_vision_01",
    sectionId: "anti_vision",
    text: "تخيّل أن حياتك استمرت خمس سنوات كما هي تمامًا. كيف سيكون يوم عادي من أيامك؟",
  },
  {
    id: "morning_anti_vision_02",
    sectionId: "anti_vision",
    text: "مدّد الصورة إلى عشر سنوات: ما الذي ستكون قد خسرته أو فوّتَّه؟",
  },
  {
    id: "morning_anti_vision_03",
    sectionId: "anti_vision",
    text: "تخيّل أنك وصلت إلى نهاية حياتك دون أن تكسر هذا النمط. ما أكثر شيء ستندم أنك لم تعشه أو تجربه؟",
  },
  {
    id: "morning_anti_vision_04",
    sectionId: "anti_vision",
    text: "هل تعرف شخصًا يسير الآن في الطريق الذي قد تنتهي إليه أنت بعد سنوات؟ ماذا تشعر وأنت تتخيل نفسك مكانه؟",
  },
  {
    id: "morning_anti_vision_05",
    sectionId: "anti_vision",
    text: "ما الهوية أو الصورة التي تتمسك بها الآن، وقد تحتاج إلى التخلي عنها حتى تتغير؟",
  },
  {
    id: "morning_anti_vision_06",
    sectionId: "anti_vision",
    text: "لو نزعت كل الأعذار المقبولة، فما السبب الحقيقي الذي يعطلك عن التغيير؟",
  },
  {
    id: "morning_anti_vision_07",
    sectionId: "anti_vision",
    text: "إن كان سلوكك الحالي يحميك من شيء ما، فما الذي يحميك منه؟ وما الثمن الذي تدفعه مقابل هذه الحماية؟",
  },
  {
    id: "morning_initial_vision_01",
    sectionId: "initial_vision",
    text: "لو لم تكن مقيدًا بما هو واقعي الآن، كيف تريد أن تبدو حياتك بعد ثلاث سنوات؟ صف يومًا عاديًا فيها.",
  },
  {
    id: "morning_initial_vision_02",
    sectionId: "initial_vision",
    text: "من يجب أن تصبح حتى تصبح هذه الحياة طبيعية بالنسبة لك؟ أكمل: «أنا شخص…»",
  },
  {
    id: "morning_initial_vision_03",
    sectionId: "initial_vision",
    text: "لو كنت بالفعل هذا الشخص، فما الشيء الواحد الذي كنت ستفعله هذا الأسبوع؟",
  },
];

export type ResetDaySession = {
  id: string;
  tenantId: string;
  title: string;
  sessionDate: string;
  status: ResetDayStatus;
  currentPhase: ResetDayPhase;
  currentMorningQuestion: number;
  answers: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  startedAt: number;
  morningCompletedAt: number | null;
  completedAt: number | null;
};

export function resetDayStatusLabel(status: ResetDayStatus) {
  if (status === "MORNING") return "الصباح";
  if (status === "DAYTIME") return "النهار";
  if (status === "EVENING") return "المساء";
  return "مكتمل";
}
