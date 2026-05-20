import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, FileText, Gauge, Sparkles, ShieldCheck, Download, Eye, GripVertical } from "lucide-react";
import { ResumePreviewMock } from "./ResumePreviewMock";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <LogoStrip />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="no-print sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md grid place-items-center text-primary-foreground font-display font-bold" style={{ background: "var(--gradient-hero)" }}>R</div>
          <span className="font-display font-bold text-lg tracking-tight">ResumeForge</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#cta" className="hover:text-foreground transition-colors">Pricing</a>
        </nav>
        <Link to="/builder">
          <Button variant="hero" style={{ background: "var(--gradient-hero)" }}>
            Start building <ArrowRight />
          </Button>
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 opacity-60"
        style={{ background: "radial-gradient(60% 80% at 20% 0%, color-mix(in oklab, var(--navy-light) 25%, transparent), transparent 60%), radial-gradient(40% 60% at 90% 20%, color-mix(in oklab, var(--navy-mid) 18%, transparent), transparent 70%)" }}
      />
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground mb-6">
            <Sparkles className="h-3.5 w-3.5" /> Trusted by 240,000+ job seekers
          </div>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.02]">
            Beat the bots.<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>
              Land the interview.
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
            A surgical resume builder engineered for applicant tracking systems.
            Live preview, real-time ATS scoring, and a clean PDF export—no fluff, no gimmicks.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/builder">
              <Button variant="hero" size="xl" style={{ background: "var(--gradient-hero)" }}>
                Build my resume <ArrowRight />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="xl">See how it works</Button>
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["Free forever", "No signup required", "Export as PDF"].map(t => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--navy-light)]" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-3xl opacity-30 blur-2xl" style={{ background: "var(--gradient-hero)" }} />
          <div className="relative rounded-2xl border border-border bg-card shadow-[var(--shadow-elegant)] overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-secondary/50">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--navy-light)]/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
              <div className="ml-auto text-xs text-muted-foreground">resume-preview.pdf</div>
            </div>
            <div className="p-6 bg-paper" style={{ background: "var(--paper)" }}>
              <ResumePreviewMock />
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 rounded-xl bg-card border border-border shadow-[var(--shadow-soft)] p-4 w-56">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Gauge className="h-4 w-4 text-[var(--navy-light)]" /> ATS Score
            </div>
            <div className="mt-1 font-display text-3xl font-bold">94<span className="text-base text-muted-foreground">/100</span></div>
            <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full" style={{ width: "94%", background: "var(--gradient-accent)" }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LogoStrip() {
  const companies = ["GOOGLE", "STRIPE", "AIRBNB", "META", "AMAZON", "SHOPIFY"];
  return (
    <section className="border-y border-border bg-secondary/30">
      <div className="mx-auto max-w-7xl px-6 py-8 flex flex-wrap items-center justify-between gap-6">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Hired at</span>
        {companies.map(c => (
          <span key={c} className="font-display font-semibold text-muted-foreground/70 tracking-wider">{c}</span>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const initial = [
    { id: "ats", icon: Gauge, title: "Real-time ATS score", text: "See how your resume parses through applicant tracking systems—and exactly what to fix." },
    { id: "templates", icon: FileText, title: "Recruiter-grade templates", text: "Single-column, ATS-safe layouts. No tables, no graphics that confuse parsers." },
    { id: "preview", icon: Eye, title: "Live preview", text: "Every keystroke updates the preview. What you see is what recruiters get." },
    { id: "keywords", icon: ShieldCheck, title: "Keyword coverage", text: "Paste a job description and we match it against your content automatically." },
    { id: "pdf", icon: Download, title: "Clean PDF export", text: "Pixel-perfect, selectable text. Parses cleanly in Workday, Greenhouse, Lever." },
    { id: "smart", icon: Sparkles, title: "Smart suggestions", text: "Action-verb hints and bullet rewrites tuned for impact and brevity." },
  ];
  const [items, setItems] = useState(initial);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems(arr => {
      const from = arr.findIndex(i => i.id === active.id);
      const to = arr.findIndex(i => i.id === over.id);
      return arrayMove(arr, from, to);
    });
  };

  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-[var(--navy-light)] font-semibold">Why ResumeForge</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl font-bold tracking-tight">Engineered to pass the filter.</h2>
          <p className="mt-4 text-muted-foreground text-lg">75% of resumes never reach a human. We're built to make sure yours does.</p>
        </div>
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <GripVertical className="h-3.5 w-3.5" /> Drag to reorder
        </p>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(item => <FeatureCard key={item.id} item={item} />)}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function FeatureCard({ item }: { item: { id: string; icon: typeof Gauge; title: string; text: string } }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const Icon = item.icon;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative p-6 rounded-xl border bg-card transition-colors ${isDragging ? "border-[var(--navy-light)] shadow-[var(--shadow-elegant)]" : "border-border hover:border-[var(--navy-light)]"}`}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-secondary cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="h-10 w-10 rounded-lg grid place-items-center text-primary-foreground mb-4" style={{ background: "var(--gradient-hero)" }}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-display font-semibold text-lg">{item.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.text}</p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "Fill in your details", d: "Guided sections for experience, education, skills and projects." },
    { n: "02", t: "Paste the job description", d: "We extract keywords and score your match instantly." },
    { n: "03", t: "Export and apply", d: "Download a clean, ATS-friendly PDF and submit with confidence." },
  ];
  return (
    <section id="how" className="border-t border-border" style={{ background: "linear-gradient(180deg, var(--secondary) 0%, transparent 100%)" }}>
      <div className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight max-w-xl">Three steps. One great resume.</h2>
        <div className="mt-14 grid md:grid-cols-3 gap-8">
          {steps.map(s => (
            <div key={s.n} className="relative pl-6 border-l-2 border-[var(--navy-light)]">
              <div className="font-display text-sm text-[var(--navy-light)] font-bold">{s.n}</div>
              <h3 className="mt-2 font-display text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="cta" className="mx-auto max-w-7xl px-6 py-24">
      <div className="relative rounded-3xl p-12 md:p-16 overflow-hidden text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
        <div aria-hidden className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white, transparent 40%)" }} />
        <div className="relative max-w-2xl">
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Your next interview is one resume away.</h2>
          <p className="mt-4 text-primary-foreground/80 text-lg">Free, no sign-up. Build in minutes. Export forever.</p>
          <div className="mt-8">
            <Link to="/builder">
              <Button variant="accent" size="xl" className="bg-background text-foreground hover:bg-background/90">
                Open the builder <ArrowRight />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div>© {new Date().getFullYear()} ResumeForge. Built for job seekers.</div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-foreground">Privacy</a>
          <a href="#" className="hover:text-foreground">Terms</a>
          <a href="#" className="hover:text-foreground">Contact</a>
        </div>
      </div>
    </footer>
  );
}