"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, UserPlus, Eye, EyeOff, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/store/useUserStore";

/**
 * Register Page — Tech-Noir Glassmorphic Auth Interface
 *
 * Creates a new user account via Supabase, sets the access token cookie,
 * updates Zustand auth state, and redirects to onboarding.
 * Shows a "Check Your Inbox" splash when email verification is required.
 */

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useUserStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerificationSent, setIsVerificationSent] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: `${window.location.origin}/app/dashboard`
        }
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (!data.session) {
        // Email confirmation required — show verification splash
        setIsVerificationSent(true);
        return;
      }

      const token = data.session.access_token;

      // Set cookie for middleware auth guard
      document.cookie = `sb-access-token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;

      // Update Zustand store
      setAuth(token, {
        id: data.user!.id,
        timezone: "UTC",
        created_at: data.user!.created_at,
        updated_at: data.user!.updated_at || data.user!.created_at,
      });

      // Redirect to onboarding
      router.push("/app/onboarding");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("[REGISTER]", err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Verification Sent Splash ---
  if (isVerificationSent) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <div className="glass-card p-8 text-center">
            {/* Pulsing Mail Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="h-16 w-16 rounded-2xl bg-gradient-to-br from-accent-indigo/20 via-accent-purple/20 to-accent-cyan/20 border border-accent-purple/30 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                >
                  <Mail className="h-7 w-7 text-accent-purple" />
                </motion.div>
                {/* Glow ring */}
                <div className="absolute inset-0 rounded-2xl shadow-[0_0_40px_rgba(168,85,247,0.2)] pointer-events-none" />
              </div>
            </div>

            {/* Header */}
            <h1 className="text-xl font-bold text-white mb-2">Check your inbox</h1>

            {/* Message */}
            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              A verification link has been sent to{" "}
              <span className="font-medium text-white">{email}</span>.
              Please click the link inside the email to confirm your account and begin your Kayan journey.
            </p>

            {/* Back to Sign In */}
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 text-sm font-medium text-gray-300 hover:text-white hover:border-white/20 transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl ai-glow mb-4">
            <UserPlus className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-sm text-gray-500 mt-1">
            Start your transformation journey
          </p>
        </div>

        {/* Form Card */}
        <div className="glass-card p-6">
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-gray-400 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-gray-400 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Min. 6 characters"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-10 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-medium text-gray-400 mb-1.5"
              >
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Repeat password"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50"
              />
            </div>

            {/* Error Message */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-status-rose bg-status-rose/10 border border-status-rose/20 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !email || !password || !confirmPassword}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-cyan py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(168,85,247,0.3)]"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create Account
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-accent-purple hover:text-accent-cyan transition-colors"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
