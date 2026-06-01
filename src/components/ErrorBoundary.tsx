"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Kayan PWA Error Boundary — Tech-Noir Glassmorphic Fallback
 *
 * Catches unhandled rendering/state errors in child components,
 * prevents white-screen crashes, and renders a branded recovery UI.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Unhandled rendering error:", error, errorInfo);
  }

  handleRestart = (): void => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/app/dashboard";
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050505]">
          {/* Background mesh gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.08)_0%,_transparent_50%),_radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.06)_0%,_transparent_50%)]" />

          {/* Glassmorphic fallback card */}
          <div className="relative mx-4 max-w-md w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-8">
            {/* Glow accent line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[2px] rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 opacity-80" />

            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-cyan-500/20 border border-white/[0.08] flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-center text-lg font-semibold text-white mb-2">
              Kayan AI baseline interrupted
            </h1>

            {/* Message */}
            <p className="text-center text-sm text-gray-400 leading-relaxed mb-6">
              An unexpected rendering error occurred. Wiping local session and reloading may resolve this.
            </p>

            {/* Error detail (collapsed) */}
            {this.state.error && (
              <div className="mb-6 rounded-lg bg-white/[0.02] border border-white/[0.05] px-3 py-2 overflow-hidden">
                <p className="text-[10px] text-gray-600 font-mono truncate">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {/* Restart button */}
            <button
              onClick={this.handleRestart}
              className="w-full relative rounded-xl py-3 px-6 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] overflow-hidden group"
            >
              {/* Button glow background */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 opacity-90 group-hover:opacity-100 transition-opacity" />
              {/* Animated glow ring */}
              <div className="absolute inset-0 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.4),_0_0_40px_rgba(99,102,241,0.2)] group-hover:shadow-[0_0_30px_rgba(168,85,247,0.6),_0_0_60px_rgba(99,102,241,0.3)] transition-shadow" />
              <span className="relative z-10">Restart App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
