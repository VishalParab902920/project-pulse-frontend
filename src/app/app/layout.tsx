"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import HydrationGuard from "@/components/HydrationGuard";
import AppNavigation from "@/components/AppNavigation";
import DateSwitcher from "@/components/DateSwitcher";
import ConnectionMonitor from "@/components/ConnectionMonitor";
import PerformanceMonitor from "@/components/PerformanceMonitor";
import OmnibarModal from "@/components/OmnibarModal";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";
import { useUIStore } from "@/store/useUIStore";

/**
 * App Shell Layout — Tech-Noir Glassmorphic Design System
 *
 * Conditionally renders navigation elements:
 * - On /app/onboarding: renders only the child (no nav, no date switcher)
 * - On all other /app/* routes: full shell with sidebar, tab bar, date strip
 */

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: "easeIn" as const },
  },
};

function LoadingFallback() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#050505]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full ai-glow animate-pulse" />
        <span className="text-xs text-gray-500 tracking-wide">Loading...</span>
      </div>
    </div>
  );
}

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isResolving } = useOnboardingGuard();
  const { isOmnibarOpen, closeOmnibar, isModalOpen } = useUIStore();

  if (isResolving) {
    return <LoadingFallback />;
  }

  const isOnboarding = pathname === "/app/onboarding";

  // Onboarding: render child only, no navigation chrome
  if (isOnboarding) {
    return (
      <div className="bg-[#050505] min-h-[100dvh] w-full text-white">
        <ConnectionMonitor />
        <PerformanceMonitor />
        {children}
      </div>
    );
  }

  // Standard app shell with full navigation
  const isWorkoutSubRoute = pathname !== "/app/workout" && pathname?.startsWith("/app/workout/");

  return (
    <div className="min-h-[100dvh] bg-base text-white">
      <ConnectionMonitor />
      <PerformanceMonitor />
      {!isWorkoutSubRoute && <AppNavigation />}

      <div className={`${!isWorkoutSubRoute ? "md:ml-20" : ""} flex flex-col min-h-[100dvh]`}>
        {pathname !== "/app/profile" && !isWorkoutSubRoute && !isModalOpen && (
          <header className="sticky top-0 z-40">
            <DateSwitcher />
          </header>
        )}

        <main className={`flex-1 overflow-y-auto ${isWorkoutSubRoute ? "pb-6" : "pb-20 md:pb-6"}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Global Omnibar Modal — mounted at layout level */}
      <OmnibarModal isOpen={isOmnibarOpen} onClose={closeOmnibar} />
    </div>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HydrationGuard fallback={<LoadingFallback />}>
      <AppShellContent>{children}</AppShellContent>
    </HydrationGuard>
  );
}
