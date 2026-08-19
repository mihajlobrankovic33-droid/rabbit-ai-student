import { RabbitLogo } from "@/components/study/RabbitLogo";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.07] blur-3xl"
      />
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <RabbitLogo className="h-24 w-24 rounded-3xl" />
      </motion.div>
      <h1 className="mt-8 text-6xl font-extrabold tracking-tight text-foreground">404</h1>
      <p className="mt-3 text-center text-muted-foreground">
        This page hopped away. Let&apos;s get you back to studying.
      </p>
      <Button asChild className="mt-7 gap-2">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </Button>
    </motion.div>
  );
}
