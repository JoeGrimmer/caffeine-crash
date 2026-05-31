export type CaffeineEntry = {
  id: string;
  drinkType: string;
  time: string;
  caffeineMg: number;
};

export type CurvePoint = {
  time: string;
  caffeine: number;
  crash: boolean;
};

export type CrashResults = {
  totalMg: number;
  peakTime: Date;
  crashStart: Date;
  crashEnd: Date;
  regretScore: number;
  sleepRisk: "Low" | "Medium" | "High" | "Very high";
  status: "Mild buzz" | "Wired" | "Danger zone" | "Send help";
  chartData: CurvePoint[];
};

export const HALF_LIFE_HOURS = 5.5;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export function todayAt(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * HOUR);
}

export function caffeineRemainingAt(entries: CaffeineEntry[], at: Date) {
  return entries.reduce((sum, entry) => {
    const consumedAt = todayAt(entry.time);
    if (at < consumedAt) return sum;
    const elapsedHours = (at.getTime() - consumedAt.getTime()) / HOUR;
    return sum + entry.caffeineMg * Math.pow(0.5, elapsedHours / HALF_LIFE_HOURS);
  }, 0);
}

export function getCrashResults(entries: CaffeineEntry[]): CrashResults | null {
  if (entries.length === 0) return null;

  const totalMg = entries.reduce((sum, entry) => sum + entry.caffeineMg, 0);
  const primaryEntry = [...entries].sort((a, b) => {
    if (b.caffeineMg !== a.caffeineMg) return b.caffeineMg - a.caffeineMg;
    return todayAt(b.time).getTime() - todayAt(a.time).getTime();
  })[0];

  const latestEntry = [...entries].sort((a, b) => todayAt(b.time).getTime() - todayAt(a.time).getTime())[0];
  const peakBase = todayAt(primaryEntry.time);
  const peakTime = addHours(peakBase, primaryEntry.caffeineMg >= 160 ? 1 : 0.6);
  const latestPeak = addHours(todayAt(latestEntry.time), 0.5);
  const adjustedPeak = latestPeak > peakTime ? latestPeak : peakTime;
  const crashStart = addHours(adjustedPeak, totalMg >= 300 ? 4 : 4.7);
  const crashEnd = addHours(adjustedPeak, totalMg >= 300 ? 6 : 6.4);
  const lastCupHour = todayAt(latestEntry.time).getHours() + todayAt(latestEntry.time).getMinutes() / 60;
  const remainingAtBedtime = caffeineRemainingAt(entries, bedtimeToday());

  let sleepRisk: CrashResults["sleepRisk"] = "Low";
  if (remainingAtBedtime > 180 || lastCupHour >= 17) sleepRisk = "Very high";
  else if (remainingAtBedtime > 100 || lastCupHour >= 15) sleepRisk = "High";
  else if (remainingAtBedtime > 50 || totalMg > 250) sleepRisk = "Medium";

  const regretScore = Math.min(
    100,
    Math.round(totalMg / 5 + Math.max(0, lastCupHour - 12) * 6 + remainingAtBedtime / 4),
  );

  const status = totalMg >= 450 ? "Send help" : totalMg >= 300 ? "Danger zone" : totalMg >= 150 ? "Wired" : "Mild buzz";
  const startHour = Math.max(6, Math.min(...entries.map((entry) => todayAt(entry.time).getHours())) - 1);
  const chartData = Array.from({ length: 17 }, (_, index) => {
    const time = new Date();
    time.setHours(startHour + index, 0, 0, 0);
    return {
      time: formatTime(time).replace(":00", ""),
      caffeine: Math.round(caffeineRemainingAt(entries, time)),
      crash: time >= crashStart && time <= crashEnd,
    };
  });

  return {
    totalMg,
    peakTime: adjustedPeak,
    crashStart,
    crashEnd,
    regretScore,
    sleepRisk,
    status,
    chartData,
  };
}

function bedtimeToday() {
  const date = new Date();
  date.setHours(23, 0, 0, 0);
  return date;
}
