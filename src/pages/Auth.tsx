import { RabbitLogo } from "@/components/study/RabbitLogo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import {
  ArrowRight,
  AtSign,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Moon,
  User,
  UserX,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (
    lower.includes("missing environment variable") ||
    lower.includes("client_id") ||
    lower.includes("missing an `issuer`")
  ) {
    return "Google sign-in is not configured yet. Please continue with Guest mode or email!";
  }
  if (
    lower.includes("invalid credential") ||
    lower.includes("invalid_email_or_password") ||
    lower.includes("no password")
  ) {
    return "Incorrect email or password. You can also sign in as Guest instantly!";
  }
  return raw;
}

type Mode = "login" | "signup";
type Step = Mode | "otp" | { email: string };

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<Step>("login");
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const absoluteRedirect = new URL(
        redirect.startsWith("/") ? redirect : "/",
        window.location.origin,
      ).toString();
      await signIn("google", { redirectTo: absoluteRedirect });
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError(friendlyAuthError(err));
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const submittedEmail = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");
      setEmail(submittedEmail);
      if (mode === "signup") {
        const name = String(formData.get("name") ?? "").trim();
        await signIn("password", {
          email: submittedEmail,
          password,
          ...(name ? { name } : {}),
          flow: "signUp",
        });
      } else {
        await signIn("password", {
          email: submittedEmail,
          password,
          flow: "signIn",
        });
      }
    } catch (err) {
      console.error("Password sign-in error:", err);
      setError(friendlyAuthError(err));
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const submittedEmail =
        String(formData.get("email") ?? "").trim() || email;
      if (!submittedEmail) {
        setError("Please enter your email address.");
        setIsLoading(false);
        return;
      }
      await signIn("email-otp", {
        email: submittedEmail,
        code: String(formData.get("code") ?? otp),
      });
      navigate(redirect);
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("The verification code entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (err) {
      console.error("Guest login error:", err);
      setError(`Guest sign-in notice: ${friendlyAuthError(err)}`);
      setIsLoading(false);
    }
  };

  const showOtpView = step === "otp" || typeof step === "object";
  const otpEmail = typeof step === "object" ? step.email : email;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Decorative Blur Backgrounds */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-180px] h-[480px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-3xl" />
        <div className="absolute bottom-[-140px] right-[-120px] h-[360px] w-[360px] rounded-full bg-accent/30 blur-3xl" />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md rounded-3xl border-border/80 bg-card/90 shadow-2xl shadow-primary/10 backdrop-blur-md">
          {showOtpView ? (
            <>
              <CardHeader className="mt-4 text-center">
                <CardTitle className="text-xl font-bold tracking-tight">
                  Check your email
                </CardTitle>
                <CardDescription>
                  {otpEmail
                    ? `We've sent a 6-digit code to ${otpEmail}`
                    : "Enter your email to receive a login code"}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="space-y-4 pb-4">
                  {otpEmail ? (
                    <>
                      <input type="hidden" name="email" value={otpEmail} />
                      <input type="hidden" name="code" value={otp} />
                    </>
                  ) : (
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        name="email"
                        type="email"
                        placeholder="name@example.com"
                        autoComplete="email"
                        className="pl-9 rounded-xl"
                        disabled={isLoading}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  )}
                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) form.requestSubmit();
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && (
                    <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-center text-xs font-semibold text-destructive">
                      {error}
                    </p>
                  )}
                  <p className="text-center text-xs text-muted-foreground">
                    Didn&apos;t receive a code?{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs font-bold"
                      onClick={() => {
                        setOtp("");
                        if (otpEmail) {
                          void signIn("email-otp", { email: otpEmail })
                            .then(() => {
                              setError(null);
                            })
                            .catch((err) => {
                              console.error("Resend OTP error:", err);
                              setError(friendlyAuthError(err));
                            });
                        }
                      }}
                    >
                      Send again
                    </Button>
                  </p>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    type="submit"
                    className="w-full rounded-xl font-bold"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify code
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("login")}
                    disabled={isLoading}
                    className="w-full text-xs"
                  >
                    Back to sign in
                  </Button>
                </CardFooter>
              </form>
            </>
          ) : (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mb-3 flex justify-center">
                  <Link to="/" className="cursor-pointer">
                    <RabbitLogo size="lg" />
                  </Link>
                </div>
                <div className="inline-flex items-center justify-center gap-1.5 mx-auto rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary mb-2">
                  <Moon className="h-3 w-3" />
                  <span>Study smarter with a buddy who never sleeps</span>
                </div>
                <CardTitle className="text-2xl font-extrabold tracking-tight">
                  {mode === "login" ? "Welcome back" : "Create your account"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {mode === "login"
                    ? "Log in to access your notes, chats, and 24/7 offline study tools"
                    : "Sign up free — your revision library will be saved instantly"}
                </CardDescription>
              </CardHeader>

              {/* Login / Sign up Switcher */}
              <div className="mx-6 mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-muted/60 p-1">
                {(["login", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                      mode === m
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "login" ? "Log in" : "Sign up"}
                  </button>
                ))}
              </div>

              <form onSubmit={handlePasswordSubmit}>
                <CardContent className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleGoogleLogin()}
                    disabled={isLoading}
                    className="h-11 w-full gap-2.5 rounded-xl border-border/80 bg-card font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-muted/40"
                  >
                    <GoogleIcon className="h-4 w-4" />
                    Continue with Google
                  </Button>

                  <div className="relative py-0.5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/60" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-[10px] font-bold text-muted-foreground">
                        or with email
                      </span>
                    </div>
                  </div>

                  {mode === "signup" && (
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        name="name"
                        placeholder="Your name (optional)"
                        autoComplete="name"
                        className="pl-9 rounded-xl"
                        disabled={isLoading}
                      />
                    </div>
                  )}

                  <div className="relative">
                    <AtSign className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="email"
                      placeholder="name@example.com"
                      type="email"
                      autoComplete="email"
                      className="pl-9 rounded-xl h-11"
                      disabled={isLoading}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="password"
                      placeholder={
                        mode === "signup"
                          ? "Create a password (8+ chars)"
                          : "Your password"
                      }
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      className="pl-9 pr-10 rounded-xl h-11"
                      disabled={isLoading}
                      minLength={mode === "signup" ? 8 : 1}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-3.5 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {error && (
                    <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-center text-xs font-semibold text-destructive">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl font-bold shadow-md gap-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : mode === "login" ? (
                      <KeyRound className="h-4 w-4" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    {isLoading
                      ? "Signing in…"
                      : mode === "login"
                        ? "Sign In"
                        : "Create Free Account"}
                  </Button>

                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/60" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-[10px] font-bold text-muted-foreground">
                        Quick Shortcuts
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGuestLogin}
                      disabled={isLoading}
                      className="rounded-xl font-semibold text-xs border-border/80"
                    >
                      <UserX className="mr-2 h-4 w-4 text-primary" />
                      Instant Guest
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep("otp")}
                      disabled={isLoading}
                      className="rounded-xl font-semibold text-xs border-border/80"
                    >
                      <Mail className="mr-2 h-4 w-4 text-primary" />
                      Email Code
                    </Button>
                  </div>
                </CardContent>
              </form>
            </>
          )}

          <div className="rounded-b-3xl border-t border-border/60 bg-muted/40 px-6 py-3.5 text-center text-xs text-muted-foreground">
            Study Buddy is free & offline-capable.
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
