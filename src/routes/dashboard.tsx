import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Plus,
  Search,
  Gauge,
  Star,
  Copy,
  Trash2,
  Pencil,
  ExternalLink,
  Clock,
  TrendingUp,
  CheckCircle2,
  Layers,
  SlidersHorizontal,
  ArrowUpRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { resumeStore, newId, type SavedResume } from "@/components/builder/resumeStore";
import { computeScore } from "@/components/builder/atsScore";
import { defaultResume, type ResumeData, type TemplateId } from "@/components/builder/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  codeSplitGroupings: [["loader", "component"]],
  head: () => ({
    meta: [
      { title: "Dashboard — ResumeForge" },
      {
        name: "description",
        content:
          "Manage your resumes, track ATS scores and completion, and jump back into editing.",
      },
    ],
  }),
  component: DashboardPage,
});

type SortKey = "updated" | "ats" | "name" | "completion";

/** Lightweight resume completion estimator (0–100). */
function completionPct(d: ResumeData): number {
  const checks: boolean[] = [
    !!d.name?.trim(),
    !!d.headline?.trim(),
    !!d.email?.trim(),
    !!d.phone?.trim(),
    !!d.location?.trim(),
    !!d.summary && d.summary.trim().length >= 60,
    (d.experience?.length ?? 0) >= 1,
    (d.experience?.[0]?.bullets ?? "").trim().split("\n").filter(Boolean).length >= 2,
    (d.education?.length ?? 0) >= 1,
    !!d.skills && d.skills.split(/[,|]/).filter(s => s.trim()).length >= 5,
    (d.projects?.length ?? 0) + (d.certifications?.length ?? 0) + (d.awards?.length ?? 0) >= 1,
    !!d.links?.trim(),
  ];
  const pct = (checks.filter(Boolean).length / checks.length) * 100;
  return Math.round(pct);
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

type Row = {
  resume: SavedResume;
  ats: number;
  completion: number;
  isPrimary: boolean;
};

function DashboardPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedResume[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tpl, setTpl] = useState<"all" | TemplateId>("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [profile, setProfile] = useState<{ name: string | null; email: string | null; lastSignInAt: string | null } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) { setProfile(null); return; }
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const name = (meta.full_name as string) || (meta.name as string) || (u.email ? u.email.split("@")[0] : null);
      setProfile({ name, email: u.email ?? null, lastSignInAt: u.last_sign_in_at ?? null });
    });
  }, []);

  const refresh = () => {
    setItems(resumeStore.list());
    setPrimaryId(resumeStore.getPrimaryId());
  };
  useEffect(() => {
    refresh();
    const onSync = () => refresh();
    window.addEventListener("resumeforge:refresh", onSync);
    return () => window.removeEventListener("resumeforge:refresh", onSync);
  }, []);

  const rows: Row[] = useMemo(
    () =>
      items.map(r => ({
        resume: r,
        ats: computeScore(r.data).score,
        completion: completionPct(r.data),
        isPrimary: r.id === primaryId,
      })),
    [items, primaryId],
  );

  const templates = useMemo(() => {
    const set = new Set<TemplateId>();
    items.forEach(r => set.add(r.data.template));
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter(r => {
      if (tpl !== "all" && r.resume.data.template !== tpl) return false;
      if (!needle) return true;
      const hay = [
        r.resume.name,
        r.resume.data.name,
        r.resume.data.headline,
        r.resume.data.skills,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "ats":
          return b.ats - a.ats;
        case "completion":
          return b.completion - a.completion;
        case "name":
          return a.resume.name.localeCompare(b.resume.name);
        case "updated":
        default:
          return b.resume.updatedAt - a.resume.updatedAt;
      }
    });
    return out;
  }, [rows, q, tpl, sort]);

  const analytics = useMemo(() => {
    const total = rows.length;
    const avgAts = total ? Math.round(rows.reduce((n, r) => n + r.ats, 0) / total) : 0;
    const avgCompletion = total
      ? Math.round(rows.reduce((n, r) => n + r.completion, 0) / total)
      : 0;
    const best = rows.reduce<Row | null>((acc, r) => (!acc || r.ats > acc.ats ? r : acc), null);
    return { total, avgAts, avgCompletion, best };
  }, [rows]);

  const focus =
    rows.find(r => r.isPrimary) ??
    analytics.best ??
    rows[0] ??
    null;

  const recent = useMemo(
    () => [...rows].sort((a, b) => b.resume.updatedAt - a.resume.updatedAt).slice(0, 6),
    [rows],
  );

  const createNew = () => {
    const id = newId();
    const data: ResumeData = { ...defaultResume, name: "", headline: "", summary: "" };
    resumeStore.upsert({ id, name: "Untitled resume", updatedAt: Date.now(), data });
    resumeStore.saveDraft(data);
    navigate({ to: "/builder", search: { open: id } as never });
  };

  const openResume = (id: string) => {
    const entry = resumeStore.get(id);
    if (entry) resumeStore.saveDraft(entry.data);
    navigate({ to: "/builder", search: { open: id } as never });
  };

  const duplicate = (id: string) => {
    const existing = resumeStore.get(id);
    if (!existing) return;
    const suggested = `${existing.name} (copy)`;
    const name = typeof window !== "undefined"
      ? window.prompt("Name for the duplicated resume:", suggested)
      : suggested;
    if (name === null) return;
    const copy = resumeStore.duplicate(id, name);
    if (copy) toast.success(`Duplicated as "${copy.name}"`);
    refresh();
  };

  const remove = (id: string, name: string) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    resumeStore.remove(id);
    refresh();
    toast.success("Resume deleted");
  };

  const setPrimary = (id: string, name: string) => {
    resumeStore.setPrimary(id);
    refresh();
    toast.success(`"${name}" is now your primary resume`);
  };

  const rename = (id: string, name: string) => {
    const next = typeof window !== "undefined" ? window.prompt("Rename resume", name) : null;
    if (!next?.trim() || next.trim() === name) return;
    resumeStore.rename(id, next.trim());
    refresh();
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Workspace
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {profile?.name ? `Welcome back, ${profile.name}` : "My Resumes"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile?.lastSignInAt
              ? `Last sign-in ${relTime(new Date(profile.lastSignInAt).getTime())} · synced across your devices.`
              : "Manage every version, track ATS scores, and pick up editing where you left off."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/jobs">
              Browse jobs <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button onClick={createNew}>
            <Plus className="h-4 w-4" /> New resume
          </Button>
        </div>
      </header>

      {/* Analytics row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Total resumes"
          value={analytics.total.toString()}
          hint={analytics.total ? `${templates.length} template${templates.length === 1 ? "" : "s"} in use` : "Start with your first"}
        />
        <StatCard
          icon={<Gauge className="h-4 w-4" />}
          label="Average ATS"
          value={`${analytics.avgAts}`}
          suffix="/100"
          tone={analytics.avgAts >= 75 ? "good" : analytics.avgAts >= 50 ? "warn" : "bad"}
          hint="Across all versions"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Avg completion"
          value={`${analytics.avgCompletion}%`}
          tone={analytics.avgCompletion >= 80 ? "good" : analytics.avgCompletion >= 50 ? "warn" : "bad"}
          hint="Profile sections filled"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Best ATS score"
          value={`${analytics.best?.ats ?? 0}`}
          suffix="/100"
          tone="good"
          hint={analytics.best ? analytics.best.resume.name : "No resumes yet"}
        />
      </section>

      {/* ATS focus + activity */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AtsFocusWidget focus={focus} onOpen={openResume} />
        <RecentActivity recent={recent} onOpen={openResume} />
      </section>

      {/* Search + filters */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by resume name, headline, or skill…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={tpl} onValueChange={(v: string) => setTpl(v as typeof tpl)}>
              <SelectTrigger className="w-[160px]">
                <Layers className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {templates.map(t => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t.replace(/-/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v: string) => setSort(v as SortKey)}>
              <SelectTrigger className="w-[170px]">
                <SlidersHorizontal className="h-4 w-4 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Recently updated</SelectItem>
                <SelectItem value="ats">Highest ATS</SelectItem>
                <SelectItem value="completion">Most complete</SelectItem>
                <SelectItem value="name">Name (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section>
        {filtered.length === 0 ? (
          <EmptyState hasAny={rows.length > 0} onCreate={createNew} onClear={() => { setQ(""); setTpl("all"); }} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(r => (
              <ResumeCard
                key={r.resume.id}
                row={r}
                onOpen={() => openResume(r.resume.id)}
                onDuplicate={() => duplicate(r.resume.id)}
                onDelete={() => remove(r.resume.id, r.resume.name)}
                onPrimary={() => setPrimary(r.resume.id, r.resume.name)}
                onRename={() => rename(r.resume.id, r.resume.name)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ===================== Sub-components ===================== */

function StatCard({
  icon,
  label,
  value,
  suffix,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "bad"
          ? "text-rose-600"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">{icon}{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={cn("text-3xl font-semibold tabular-nums", toneClass)}>{value}</span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}

function ScoreRing({ value, size = 64, stroke = 6 }: { value: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c * (1 - pct / 100);
  const tone =
    pct >= 75 ? "stroke-emerald-500" : pct >= 50 ? "stroke-amber-500" : "stroke-rose-500";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-muted/60" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-700", tone)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
        {pct}
      </span>
    </div>
  );
}

function AtsFocusWidget({
  focus,
  onOpen,
}: {
  focus: Row | null;
  onOpen: (id: string) => void;
}) {
  if (!focus) {
    return (
      <div className="lg:col-span-2 rounded-xl border border-dashed border-border bg-card p-6 flex flex-col items-center justify-center text-center">
        <Gauge className="h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first resume to see your ATS health.
        </p>
      </div>
    );
  }
  const score = computeScore(focus.resume.data);
  const passing = score.checks.filter(c => c.pass).length;
  const failing = score.checks.filter(c => !c.pass);
  return (
    <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">ATS Health · Focus resume</h2>
            {focus.isPrimary && (
              <Badge variant="secondary" className="gap-1">
                <Star className="h-3 w-3" /> Primary
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {focus.resume.name} · updated {relTime(focus.resume.updatedAt)}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => onOpen(focus.resume.id)}>
          Edit <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-[auto,1fr] gap-5 items-start">
        <div className="flex items-center gap-4">
          <ScoreRing value={focus.ats} size={96} stroke={8} />
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">ATS Score</div>
            <div className="text-xs text-muted-foreground mt-2">
              {passing}/{score.checks.length} checks passing
            </div>
            <div className="text-xs text-muted-foreground">
              {Math.round(score.coverage * 100)}% JD keyword coverage
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Resume completion</span>
            <span className="tabular-nums">{focus.completion}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                focus.completion >= 80
                  ? "bg-emerald-500"
                  : focus.completion >= 50
                    ? "bg-amber-500"
                    : "bg-rose-500",
              )}
              style={{ width: `${focus.completion}%` }}
            />
          </div>

          <div className="mt-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Top improvements
            </div>
            {failing.length === 0 ? (
              <p className="text-xs text-emerald-600 inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Everything looks great
              </p>
            ) : (
              <ul className="space-y-1.5">
                {failing.slice(0, 4).map(c => (
                  <li key={c.label} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
                    <span className="text-foreground">
                      <span className="font-medium">{c.label}.</span>{" "}
                      <span className="text-muted-foreground">{c.hint ?? "Improve this section."}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentActivity({ recent, onOpen }: { recent: Row[]; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Recent activity</h2>
      </div>
      <p className="text-sm text-muted-foreground mt-0.5">Your latest edits and updates.</p>
      <ul className="mt-4 space-y-2">
        {recent.length === 0 && (
          <li className="text-xs text-muted-foreground">No activity yet.</li>
        )}
        {recent.map(r => (
          <li key={r.resume.id}>
            <button
              onClick={() => onOpen(r.resume.id)}
              className="w-full flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left hover:border-border hover:bg-secondary/40 transition-colors"
            >
              <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{r.resume.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  Edited {relTime(r.resume.updatedAt)} · {r.completion}% complete
                </div>
              </div>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {r.ats}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResumeCard({
  row,
  onOpen,
  onDuplicate,
  onDelete,
  onPrimary,
  onRename,
}: {
  row: Row;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPrimary: () => void;
  onRename: () => void;
}) {
  const { resume, ats, completion, isPrimary } = row;
  const skills = resume.data.skills
    ?.split(/[,|]/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 4) ?? [];

  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 hover:border-[var(--navy-light)] hover:shadow-[var(--shadow-soft)] transition-all flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="text-left min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-semibold truncate">{resume.name}</h3>
            {isPrimary && (
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {resume.data.headline || resume.data.name || "No headline"}
          </p>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7 -mr-1">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={onOpen}>
              <ExternalLink className="h-3.5 w-3.5" /> Open in builder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="h-3.5 w-3.5" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPrimary} disabled={isPrimary}>
              <Star className="h-3.5 w-3.5" /> Set as primary
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button onClick={onOpen} className="mt-3 flex items-center gap-4 text-left">
        <ScoreRing value={ats} size={56} stroke={5} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>Completion</span>
            <span className="tabular-nums">{completion}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                completion >= 80
                  ? "bg-emerald-500"
                  : completion >= 50
                    ? "bg-amber-500"
                    : "bg-rose-500",
              )}
              style={{ width: `${completion}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{relTime(resume.updatedAt)}</span>
            <span>·</span>
            <span className="capitalize truncate">{resume.data.template.replace(/-/g, " ")}</span>
          </div>
        </div>
      </button>

      {skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {skills.map(s => (
            <Badge key={s} variant="outline" className="font-normal text-[10px] py-0">
              {s}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" variant="default" className="flex-1" onClick={onOpen}>
          Open <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={onDuplicate}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function EmptyState({
  hasAny,
  onCreate,
  onClear,
}: {
  hasAny: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  if (hasAny) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <Search className="h-6 w-6 mx-auto text-muted-foreground" />
        <h3 className="mt-2 font-semibold">No matches</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Try a different search or template filter.
        </p>
        <Button variant="outline" className="mt-4" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-3 font-semibold">No resumes yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        Create your first resume to start tracking ATS scores, completion, and recent activity.
      </p>
      <Button className="mt-4" onClick={onCreate}>
        <Plus className="h-4 w-4" /> Create resume
      </Button>
    </div>
  );
}
