import type { Vision } from "./types";

export const mockVisions: Vision[] = [
  {
    id: "v1",
    title: "رؤية حافظ للقرآن",
    description:
      "أريد من كثرة مراجعة القرآن أن يصبح حفظي له ثابتًا ورسخًا قويًا بإذن الله.",
    motivation:
      "الماهر بالقرآن مع السفرة الكرام البررة، ويقال لقارئ القرآن اقرأ وارتق.",
    warning:
      "التفريط في المراجعة يؤدي إلى التفلت والضعف والندم عند الحاجة إلى العمل.",
    howTo:
      "أقسم التنفيذ إلى نوعين: مهام يومية خفيفة طوال الأسبوع، ولوب متوالٍ أثقل في الجمعة والسبت والإجازات.",
    section: "goals",
    executionType: "sequential_loop",
    isActive: true,
    sortOrder: 1,
    completedDailyTaskIdsToday: [],
    loopTasks: [
      {
        id: "lt1",
        title: "مراجعة من الناس إلى النبأ",
        sortOrder: 1,
        isActive: true,
      },
      {
        id: "lt2",
        title: "مراجعة من عم إلى الملك",
        sortOrder: 2,
        isActive: true,
      },
      {
        id: "lt3",
        title: "مراجعة من تبارك إلى المجادلة",
        sortOrder: 3,
        isActive: true,
      },
    ],
    loopState: {
      currentTaskIndex: 0,
      cycleCount: 0,
      lastCycleCompletedAt: null,
    },
    allowedLoopDays: ["friday", "saturday", "holiday"],
  },
  {
    id: "v2",
    title: "ثبات يومي مع القرآن",
    description:
      "رؤية تجعل علاقتي بالقرآن يومية ولو بقدر ثابت لا ينقطع.",
    motivation:
      "خير الأعمال أدومها وإن قل، والثبات اليومي يصنع أثرًا عظيمًا على المدى الطويل.",
    warning:
      "الانقطاع المتكرر يضعف البناء ويجعل العودة أصعب.",
    howTo:
      "أربط التنفيذ اليومي بوقت محدد بعد الفجر أو بعد صلاة العشاء.",
    section: "daily",
    executionType: "daily_tasks",
    isActive: true,
    sortOrder: 1,
    dailyTasks: [
      {
        id: "dt1",
        title: "مراجعة وجهين",
        sortOrder: 1,
        isActive: true,
      },
      {
        id: "dt2",
        title: "تسميع ربع حزب",
        sortOrder: 2,
        isActive: true,
      },
      {
        id: "dt3",
        title: "قراءة تفسير مختصر",
        sortOrder: 3,
        isActive: true,
      },
    ],
    completedDailyTaskIdsToday: [],
  },
  {
    id: "v3",
    title: "أنا شخص هادئ ومنظم",
    description:
      "أريد أن تكون هويتي قائمة على الهدوء والترتيب وحسن إدارة الوقت.",
    motivation:
      "النفس إذا استقامت على نظام واضح أصبحت أقدر على الإنجاز والثبات.",
    warning:
      "الفوضى المتكررة تستهلك التركيز وتبدد الطاقة.",
    howTo:
      "أكرر المعنى على نفسي، وأبني له عادات صغيرة متدرجة.",
    section: "identity",
    executionType: "none",
    isActive: true,
    sortOrder: 1,
  },
];