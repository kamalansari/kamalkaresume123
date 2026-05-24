import { useEffect, useRef, useState } from "react";
import { TrendingUp, Users, FileCheck2, Timer } from "lucide-react";

type Stat = { id: string; label: string; value: number; suffix: string; icon: typeof TrendingUp; tint: string };

const STATS: Stat[] = [
  { id: "users", label: "Resumes built", value: 240000, suffix: "+", icon: Users, tint: "from-[oklch(0.58_0.13_252)] to-[oklch(0.45_0.12_256)]" },
  { id: "ats", label: "Avg. ATS score", value: 94, suffix: "/100", icon: FileCheck2, tint: "from-[oklch(0.65_0.14_180)] to-[oklch(0.5_0.13_220)]" },
  { id: "interview", label: "Interview rate", value: 3, suffix: "×", icon: TrendingUp, tint: "from-[oklch(0.7_0.17_70)] to-[oklch(0.55_0.18_30)]" },
  { id: "time", label: "Build time", value: 8, suffix: " min", icon: Timer, tint: "from-[oklch(0.65_0.15_300)] to-[oklch(0.45_0.18_280)]" },
];

function useCount(target: number, run: boolean, duration = 1400) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);
  return n;
}

function format(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return n.toString();
}

export function AnimatedStats() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { threshold: 0.2 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {STATS.map((s, i) => (
          <StatCard key={s.id} stat={s} run={visible} delay={i * 120} />
        ))}
      </div>
    </section>
  );
}

function StatCard({ stat, run, delay }: { stat: Stat; run: boolean; delay: number }) {
  const Icon = stat.icon;
  const n = useCount(stat.value, run);
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-5 md:p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]"
      style={{ animation: run ? `fade-in 0.6s ease-out ${delay}ms both` : undefined }}
    >
      <div aria-hidden className={`absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${stat.tint} opacity-20 blur-2xl group-hover:opacity-40 transition-opacity`} />
      <div className={`relative h-10 w-10 rounded-xl grid place-items-center text-primary-foreground bg-gradient-to-br ${stat.tint} shadow-lg`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="relative mt-4 font-display text-3xl md:text-4xl font-bold tracking-tight tabular-nums">
        {stat.value >= 1000 ? format(n) : n}
        <span className="text-base text-muted-foreground font-medium">{stat.suffix}</span>
      </div>
      <div className="relative mt-1 text-sm text-muted-foreground">{stat.label}</div>
    </div>
  );
}