export function getTodayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDayType(date = new Date()) {
  const day = date.getDay();

  // JavaScript:
  // 0 = Sunday
  // 5 = Friday
  // 6 = Saturday
  if (day === 5) return "friday";
  if (day === 6) return "saturday";
  return "weekday";
}

export function isLoopExecutionAllowed(
  allowedDays: Array<"friday" | "saturday" | "holiday"> = []
) {
  const dayType = getDayType();

  if (dayType === "friday" && allowedDays.includes("friday")) return true;
  if (dayType === "saturday" && allowedDays.includes("saturday")) return true;

  // لاحقًا سنربط الإجازات الحقيقية
  return false;
}