import { RabbitLogo } from "@/components/study/RabbitLogo";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 text-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[450px] w-[750px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.08] blur-3xl"
      />

      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <RabbitLogo size="xl" />
      </motion.div>

      <h1 className="mt-8 text-7xl font-extrabold tracking-tight text-foreground">404</h1>
      <h2 className="mt-2 text-xl font-bold text-foreground">This page hopped away!</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
        We couldn&apos;t find the study page you were looking for. Let&apos;s hop back to your study session!
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="gap-2 rounded-xl font-bold">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2 rounded-xl font-semibold">
          <Link to="/dashboard">
            <MessageSquare className="h-4 w-4 text-primary" />
            Open Study Dashboard
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
