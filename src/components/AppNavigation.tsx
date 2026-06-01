"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Sparkles,
  Dumbbell,
  User,
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";

/**
 * AppNavigation — Responsive navigation shell.
 *
 * Desktop/Tablet: Vertical glassmorphic sidebar on the left.
 * Mobile: Fixed bottom glassmorphic tab bar with safe-area padding.
 *
 * The central Omnibar button features an active purple-to-cyan gradient
 * shadow that pulses to draw attention. Clicking it opens the global
 * OmnibarModal overlay without navigating to a sub-route.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isOmnibar?: boolean;
}

const navItems: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/diary", label: "Diary", icon: BookOpen },
  { href: "#omnibar", label: "Capture", icon: Sparkles, isOmnibar: true },
  { href: "/app/workout", label: "Workouts", icon: Dumbbell },
  { href: "/app/profile", label: "Profile", icon: User },
];

export default function AppNavigation() {
  const pathname = usePathname();
  const { openOmnibar, isNavHidden } = useUIStore();

  return (
    <>
      {/* Desktop/Tablet Sidebar — hidden on mobile */}
      <aside className="hidden md:flex fixed left-0 top-0 h-[100dvh] w-20 flex-col items-center justify-center gap-2 z-50 border-r border-white/5 bg-surface-glass backdrop-blur-xl">
        <nav className="flex flex-col items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/app" && !item.isOmnibar && pathname?.startsWith(item.href));
            const Icon = item.icon;

            if (item.isOmnibar) {
              return (
                <button key={item.href} onClick={openOmnibar}>
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative my-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-indigo via-accent-purple to-accent-cyan shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                  >
                    <Icon className="h-5 w-5 text-white" />
                    {/* Pulsing glow ring */}
                    <motion.div
                      className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent-indigo via-accent-purple to-accent-cyan opacity-40"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.4, 0.1, 0.4],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  </motion.div>
                </button>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`
                    relative flex h-12 w-12 items-center justify-center rounded-xl
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-accent-purple"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Tab Bar — hidden on desktop or when nav is hidden */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-surface-glass backdrop-blur-xl pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ${isNavHidden ? "translate-y-full" : "translate-y-0"}`}>
        <div className="flex items-center justify-around px-2 h-16">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/app" && !item.isOmnibar && pathname?.startsWith(item.href));
            const Icon = item.icon;

            if (item.isOmnibar) {
              return (
                <button key={item.href} onClick={openOmnibar}>
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className="relative -mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent-indigo via-accent-purple to-accent-cyan shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                  >
                    <Icon className="h-6 w-6 text-white" />
                    {/* Pulsing glow ring */}
                    <motion.div
                      className="absolute inset-0 rounded-full bg-gradient-to-br from-accent-indigo via-accent-purple to-accent-cyan opacity-40"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.4, 0, 0.4],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  </motion.div>
                </button>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                <div className="flex flex-col items-center gap-0.5 py-1">
                  <div
                    className={`
                      relative flex h-8 w-8 items-center justify-center rounded-lg
                      transition-colors duration-200
                      ${isActive ? "text-white" : "text-gray-500"}
                    `}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-[10px] font-medium ${
                      isActive ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-accent-purple"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
