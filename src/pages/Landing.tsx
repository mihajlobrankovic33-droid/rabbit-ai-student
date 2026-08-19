import React, { useState } from "react";
import { RabbitLogo } from "@/components/study/RabbitLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  Flame,
  Library,
  Moon,
  ShieldCheck,
  Sparkles,
  Wand2,
  WifiOff,
} from "lucide-react";
import { Link } from "react-router";

const VIEWPORT = { once: true, margin: "-60px" as const };

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const FEATURES = [
  {
    icon: Clock,
    badge: "24/7 Available",
    title: "Never Sleeps, Never Tires",
    description:
      "Whether it's 2 PM in class or 3 AM before finals, your study buddy is always online, patient, and ready to explain tough concepts step-by-step.",
  },
  {
    icon: Cpu,
    badge: "Free Local AI",
    title: "Lightweight Ollama Models",
    description:
      "Run ultra-compact models like Qwen 2.5 (0.5B) and SmolLM (135M) locally on your laptop with zero cost, zero lag, and no internet required.",
  },
  {
    icon: Download,
    badge: "PWA Service Worker",
    title: "100% Offline Capability",
    description:
      "One click caches the entire app, notes generator, and built-in AI brain to your device. Study seamlessly on planes, trains, or weak WiFi.",
  },
  {
    icon: Wand2,
    badge: "Exam-Ready",
    title: "Instant Structured Notes",
    description:
      "Transform broad chapters into concise study guides featuring core formulas, step-by-step mechanisms, active recall quizzes, and executive summaries.",
  },
  {
    icon: Library,
    badge: "Private & Local",
    title: "Saved Session Library",
    description:
      "All your study notes, questions, and chat histories are securely stored in your browser storage with zero external tracking.",
  },
  {
    icon: Sparkles,
    badge: "Multi-Subject",
    title: "STEM to Humanities",
    description:
      "From Calculus derivations and Physics free-body diagrams to Organic Chemistry, Python coding, and World History.",
  },
];

const SAMPLE_SUBJECTS = [
  { name: "Calculus", prompt: "Explain the chain rule with an intuitive analogy" },
  { name: "Physics", prompt: "How does conservation of momentum work in collisions?" },
  { name: "Chemistry", prompt: "What is Le Chatelier's principle and equilibrium shift?" },
  { name: "Biology", prompt: "Break down the stages of cellular respiration" },
  { name: "Computer Science", prompt: "Compare Merge Sort vs Quick Sort with Big-O" },
  { name: "History", prompt: "What were the main catalysts of the Industrial Revolution?" },
];

export default function Landing() {
  const { isLoading, isAuthenticated } = useAuth();
  const [activeDemoTab, setActiveDemoTab] = useState<"chat" | "notes" | "offline">("chat");

  const primaryCta = {
    to: isAuthenticated ? "/dashboard" : "/auth",
    label: isLoading ? "Loading…" : isAuthenticated ? "Open Your Dashboard" : "Start Studying Free",
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background font-sans text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Dynamic atmospheric background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[560px] w-[880px] -translate-x-1/2 rounded-full bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-3xl" />
        <div className="absolute top-1/4 -right-40 h-[450px] w-[450px] rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute top-2/3 -left-40 h-[400px] w-[400px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.035] dark:opacity-[0.07]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3 group">
            <RabbitLogo className="h-9 w-9 transition-transform group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-foreground">
                Study Buddy
              </span>
              <span className="text-[10px] font-medium text-muted-foreground -mt-1 flex items-center gap-1">
                <Moon className="h-2.5 w-2.5 text-primary" /> Always Awake 24/7
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#demo" className="transition-colors hover:text-foreground">
              Live Preview
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How It Works
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild className="gap-2 shadow-sm font-semibold">
              <Link to={primaryCta.to}>
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-20">
        <div className="flex flex-col items-center text-center">
          {/* Night Owl / 24/7 Badge */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur shadow-sm"
          >
            <Moon className="h-3.5 w-3.5 fill-primary/20 text-primary" />
            <span>24/7 AI Companion</span>
            <span className="text-muted-foreground/60">•</span>
            <span className="text-foreground/90 font-medium">Free • 100% Offline Ready</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="mt-6 max-w-4xl text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-6xl md:text-7xl"
          >
            Study smarter with a buddy who{" "}
            <span className="relative inline-block bg-gradient-to-r from-primary via-indigo-500 to-purple-600 bg-clip-text text-transparent">
              never sleeps
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Ask any question, break down complex topics step-by-step, and generate instant revision notes. Powered by lightweight Ollama models and built-in offline intelligence that works anywhere without WiFi.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Button asChild size="lg" className="h-12 px-7 text-base font-semibold shadow-md gap-2">
              <Link to={primaryCta.to}>
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base font-medium">
              <a href="#demo">Explore Live Preview</a>
            </Button>
          </motion.div>

          {/* Feature Highlights Pills */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.32 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground"
          >
            <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1 font-medium shadow-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Free Forever</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1 font-medium shadow-xs">
              <WifiOff className="h-3.5 w-3.5 text-indigo-500" />
              <span>100% Offline with Service Worker</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1 font-medium shadow-xs">
              <Cpu className="h-3.5 w-3.5 text-purple-500" />
              <span>Lightest Ollama Models (0.5B)</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1 font-medium shadow-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
              <span>Private In-Browser Storage</span>
            </div>
          </motion.div>
        </div>

        {/* Interactive Live Preview Mockup */}
        <motion.div
          id="demo"
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.35 }}
          className="relative mx-auto mt-14 max-w-4xl"
        >
          {/* Floating mascot */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-12 left-1/2 z-20 -translate-x-1/2"
          >
            <RabbitLogo className="h-20 w-20 rounded-3xl shadow-xl shadow-primary/20 ring-4 ring-background" />
          </motion.div>

          <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl shadow-primary/10">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-5 py-3.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400/80" />
                <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                <span className="ml-2 font-semibold text-foreground/80">Study Buddy Workspace</span>
              </div>

              {/* Demo Mode Tabs */}
              <div className="flex rounded-lg bg-background/80 p-0.5 border border-border/60">
                <button
                  type="button"
                  onClick={() => setActiveDemoTab("chat")}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                    activeDemoTab === "chat"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  AI Chat
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDemoTab("notes")}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                    activeDemoTab === "notes"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Study Notes
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDemoTab("offline")}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                    activeDemoTab === "offline"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Offline & Ollama
                </button>
              </div>
            </div>

            {/* Dynamic Interactive Preview Body */}
            <div className="p-5 sm:p-7 min-h-[290px] flex flex-col justify-between">
              {activeDemoTab === "chat" && (
                <div className="space-y-3.5">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm font-medium leading-relaxed text-primary-foreground shadow-sm">
                      Explain quantum entanglement with an everyday analogy
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-border/70 bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
                      <p className="font-semibold text-primary mb-1">
                        Imagine a pair of magic shoes in two sealed boxes 👟✨
                      </p>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        One box travels to Tokyo, the other to New York. The moment you open the Tokyo box and see a <strong>left shoe</strong>, you instantly know the New York box holds the <strong>right shoe</strong> at zero delay — even across the universe!
                      </p>
                      <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Instant explanation ready for exams</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeDemoTab === "notes" && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-foreground">
                        📝 Photosynthesis & Light Reactions
                      </span>
                      <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                        Exam Review Card
                      </span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                      <li>
                        <strong>Core Equation:</strong> 6CO₂ + 6H₂O + photons → C₆H₁₂O₆ + 6O₂
                      </li>
                      <li>
                        <strong>Thylakoid Membrane:</strong> Light reactions generate ATP and NADPH via electron transport.
                      </li>
                      <li>
                        <strong>Calvin Cycle:</strong> Fixes carbon dioxide in the stroma into glucose without direct light.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {activeDemoTab === "offline" && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
                    <div className="flex items-center gap-2">
                      <WifiOff className="h-4 w-4 text-emerald-500" />
                      <div>
                        <p className="font-bold">100% Offline Mode Active</p>
                        <p className="text-[11px] opacity-90">
                          App shell cached via Service Worker. Using Ollama model <code>qwen2.5:0.5b</code>.
                        </p>
                      </div>
                    </div>
                    <span className="rounded bg-emerald-500/20 px-2 py-1 font-bold text-[10px]">
                      0ms Ping
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-border/70 bg-card p-3">
                      <p className="font-semibold text-foreground">Lightweight Ollama</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Runs on 0.5GB RAM with anti-repetition protection.
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card p-3">
                      <p className="font-semibold text-foreground">Built-in Brain</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Zero install, instant offline comprehension.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sample Prompt Selector */}
              <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-medium">Try asking:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_SUBJECTS.slice(0, 3).map((item) => (
                    <Link
                      key={item.name}
                      to={primaryCta.to}
                      className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-1 text-xs text-foreground/80 transition-colors hover:border-primary hover:text-primary"
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="whileInView"
          viewport={VIEWPORT}
          className="text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Why Students Love Study Buddy
          </p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Everything you need for stress-free revision
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground text-sm sm:text-base">
            Built for late-night exam cramming, daytime lectures, and offline study sessions anywhere.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, badge, title, description }) => (
            <motion.div
              key={title}
              variants={fadeUp}
              initial="initial"
              whileInView="whileInView"
              viewport={VIEWPORT}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="group rounded-2xl border border-border/70 bg-card p-6 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {badge}
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold tracking-tight text-foreground">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works Section */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="whileInView"
          viewport={VIEWPORT}
          className="text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            How It Works
          </p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            From confusion to mastery in 3 simple steps
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Open & Ask",
              description: "Hop in as a guest or sign in. Type any question or paste a difficult concept.",
            },
            {
              step: "02",
              title: "Learn & Generate",
              description: "Receive intuitive step-by-step breakdowns or turn whole topics into structured notes.",
            },
            {
              step: "03",
              title: "Study Offline Anywhere",
              description: "Download the app for 100% offline access. Revisit your saved library before exams.",
            },
          ].map(({ step, title, description }) => (
            <motion.div
              key={step}
              variants={fadeUp}
              initial="initial"
              whileInView="whileInView"
              viewport={VIEWPORT}
              className="relative rounded-2xl border border-border/70 bg-card p-6"
            >
              <span className="text-4xl font-extrabold tracking-tight text-primary/15">
                {step}
              </span>
              <h3 className="mt-3 text-base font-bold tracking-tight text-foreground">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="whileInView"
          viewport={VIEWPORT}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-indigo-600 to-purple-700 p-8 text-center sm:p-12 shadow-xl"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_45%)]"
          />
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur"
          >
            <RabbitLogo className="h-12 w-12" />
          </motion.div>
          <h2 className="mx-auto max-w-xl text-balance text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
            Your 24/7 AI study buddy is ready
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/90">
            Study smarter with a buddy who never sleeps. Free, instant, and works fully offline.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-7 gap-2 bg-white text-foreground hover:bg-white/95 font-bold shadow-md"
          >
            <Link to={primaryCta.to}>
              {primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-background/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <RabbitLogo className="h-6 w-6" />
            <span className="font-bold text-foreground">Study Buddy</span>
          </div>
          <p className="flex items-center gap-1">
            Study smarter with a buddy who never sleeps <Moon className="h-3 w-3 text-primary inline" />
          </p>
          <p>Powered by freebuff.com</p>
        </div>
      </footer>
    </div>
  );
}
