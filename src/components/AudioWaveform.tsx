"use client";

import { useEffect, useRef } from "react";

/**
 * AudioWaveform — GPU-accelerated real-time audio frequency visualizer.
 *
 * Connects to a live MediaStream via Web Audio API AnalyserNode,
 * extracts frequency byte data at 60fps, and renders a neon
 * purple-to-cyan sinusoidal bar visualizer on an HTML5 canvas.
 *
 * All resources (AudioContext, AnalyserNode, RAF loop) are safely
 * cleaned up when recording stops to prevent memory leaks.
 */

interface AudioWaveformProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

export default function AudioWaveform({ stream, isRecording }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRecording || !stream || !canvasRef.current) {
      // Cleanup when not recording
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
      sourceRef.current = null;
      return;
    }

    // Initialize Web Audio API
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    sourceRef.current = source;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Render loop
    const draw = () => {
      if (!analyserRef.current || !canvasRef.current) return;

      rafRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw frequency bars with gradient
      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height * 0.85;

        // Create gradient from indigo → purple → cyan
        const progress = i / bufferLength;
        const r = Math.round(99 + (6 - 99) * progress);
        const g = Math.round(102 + (182 - 102) * progress);
        const b = Math.round(241 + (212 - 241) * progress);
        const alpha = 0.6 + (dataArray[i] / 255) * 0.4;

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

        // Draw mirrored bars from center
        const centerY = height / 2;
        ctx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);

        // Add glow effect for active bars
        if (dataArray[i] > 128) {
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
          ctx.shadowBlur = 8;
          ctx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);
          ctx.shadowBlur = 0;
        }

        x += barWidth;
      }
    };

    draw();

    // Cleanup
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [isRecording, stream]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
      }
    });

    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-32 transform-gpu rounded-xl"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
