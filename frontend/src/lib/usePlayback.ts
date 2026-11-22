"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Playback is driven by match-relative seconds, not fixed frames. This keeps
 * the speed honest (1x is real time) and lets the slider land anywhere.
 */
export function usePlayback(duration: number, resetKey?: string) {
  const [playhead, setPlayheadState] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const playheadRef = useRef(0);

  const setPlayhead = useCallback((value: number) => {
    const next = Math.max(0, Math.min(duration, value));
    playheadRef.current = next;
    setPlayheadState(next);
  }, [duration]);

  useEffect(() => {
    playheadRef.current = 0;
    // Resetting playback to the start is required when a match changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayheadState(0);
    setIsPlaying(false);
  }, [duration, resetKey]);

  useEffect(() => {
    if (!isPlaying || duration <= 0) return;
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = Math.min(duration, playheadRef.current + delta * speed);
      playheadRef.current = next;
      setPlayheadState(next);
      if (next >= duration) {
        setIsPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, speed, duration]);

  const play = useCallback(() => {
    if (duration <= 0) return;
    if (playheadRef.current >= duration - 0.05) {
      playheadRef.current = 0;
      setPlayheadState(0);
    }
    setIsPlaying(true);
  }, [duration]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const toggle = useCallback(() => {
    if (isPlaying) setIsPlaying(false);
    else play();
  }, [isPlaying, play]);

  const seek = useCallback((value: number) => {
    setPlayhead(value);
  }, [setPlayhead]);

  // const seek = useCallback((value: number) => {
  //   setIsPlaying(false);
  //   setPlayhead(value);
  // }, [setPlayhead]);

  return {
    playhead,
    isPlaying,
    speed,
    setSpeed,
    play,
    pause,
    toggle,
    seek,
  };
}
