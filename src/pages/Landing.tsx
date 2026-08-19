import { RabbitLogo } from "@/components/study/RabbitLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  Library,
  MessageSquareText,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Link } from "react-router";

const VIEWPORT = { once: true, margin: "-80px" as const };

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: "easeOut" as const },
};

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "AI Chat that explains",
    description:
      "Ask anything about any subject. Study Buddy breaks down tough concepts into simple, friendly explanations — one step at a time.",
  },
  {
    icon: Wand2,
    title: "Instant study notes",
    description:
      "Turn any topic into clean, structured notes with key points and a summary you can actually revise from.",
  },
  {
    icon: Library,
    title: "Your library, saved",
    description:
      "Save notes and chat sessions and revisit them anytime. Everything persists right in your browser.",
  },
  {
    icon: BookOpenCheck,
    title: "Works everywhere",
    description:
      "No installs, no setup. A built-in study brain always responds, with cloud AI when it's available.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Sign in — or hop in as a guest",
    description: "Create an account in seconds with your email, or continue anonymously.",
  },
  {
    step: "02",
    title: "Ask, chat, and generate",
    description: "Chat with Study Buddy or type a topic to generate structured study notes.",
  },
  {
    step: "03",
    title: "Save, review, and grow",
    description: "Keep notes and sessions in your library, then revisit them before exams.",
  },
];

export default function Landing() {
  const { isLoading, isAuthenticated } = useAuth();

  const primaryCta = {
    to: isAuthenticated ? "/dashboard" : "/auth",
    label: isLoading ? "Loading…" : isAuthenticated ? "Open your dashboard" : "Get started free",
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      {/* Decorative background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute right-[-160px] top-1/3 h-[380px] w-[380px] rounded-full bg-accent/40 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[-120px] h-[360px] w-[360px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <RabbitLogo className="h-9 w-9" />
            <span className="text-base font-bold tracking-tight text-foreground">
              Study Buddy
            </span>
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
          </div>
          <Button asChild className="gap-1.5">
            <Link to={primaryCta.to}>
              {primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Your friendly AI study companion
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-6 max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-6xl"
          >
            Study smarter with a buddy who{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              never gets tired
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg"
          >
            Chat, learn, and turn any topic into clear study notes. Study Buddy explains
            anything, works offline, and keeps your library ready whenever you are.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Button asChild size="lg" className="gap-2 px-6 text-base">
              <Link to={primaryCta.to}>
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="px-6 text-base">
              <a href="#how">See how it works</a>
            </Button>
          </motion.div>
        </div>

        {/* Mascot + chat preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="relative mx-auto mt-16 max-w-3xl"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-16 left-1/2 z-10 -translate-x-1/2"
          >
            <RabbitLogo className="h-24 w-24 rounded-3xl shadow-2xl shadow-primary/20" />
          </motion.div>

          <div className="rounded-3xl border border-border/70 bg-card/90 p-4 shadow-xl shadow-primary/5 backdrop-blur sm:p-6">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
                  Explain quantum entanglement like I&apos;m five
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs">
                  🐰
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border/70 bg-muted/50 px-4 py-2.5 text-sm leading-relaxed text-foreground/90">
                  Great question! Imagine two magical dice that are linked — roll one and the
                  other instantly matches, no matter how far apart. That&apos;s the spooky idea
                  behind entanglement! 🎲✨ Want to dive deeper?
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3.5 py-2.5">
                <span className="flex-1 text-sm text-muted-foreground/70">
                  Ask a study question…
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Trust strip */}
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="whileInView"
          viewport={VIEWPORT}
          className="mx-auto mt-14 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
        >
          {["20+ built-in topics", "Works fully offline", "No downloads", "100% free"].map(
            (item) => (
              <span key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {item}
              </span>
            ),
          )}
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="whileInView"
          viewport={VIEWPORT}
          className="text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Features
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need to study better
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            A warm, patient study buddy that turns confusion into confidence.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <motion.div
              key={title}
              variants={fadeUp}
              initial="initial"
              whileInView="whileInView"
              viewport={VIEWPORT}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="group rounded-2xl border border-border/70 bg-card p-6 transition-colors hover:border-primary/25"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold tracking-tight text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="whileInView"
          viewport={VIEWPORT}
          className="text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            How it works
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            From question to confidence in three hops
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ step, title, description }) => (
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
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="whileInView"
          viewport={VIEWPORT}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent p-8 text-center sm:p-12"
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
          <h2 className="mx-auto max-w-xl text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Ready to hop into your next study session?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/85">
            Join Study Buddy today — ask your first question in under a minute.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-7 gap-2 border border-white/20 bg-white text-foreground hover:bg-white/90"
          >
            <Link to={primaryCta.to}>
              {primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <RabbitLogo className="h-6 w-6" />
            <span className="font-medium text-foreground">Study Buddy</span>
          </div>
          <p>Built with love for curious minds 🐰</p>
          <p>Powered by freebuff.com</p>
        </div>
      </footer>
    </div>
  );
}
