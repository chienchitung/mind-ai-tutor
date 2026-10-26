'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadLectureAudio } from '@/lib/lecture-audio';

export type LectureAudio = ReturnType<typeof useLectureAudio>;

// Plays a recording's lesson audio from the cloud copy, for following along
// with the transcript. Loaded only once `enabled` (the transcript is shown or
// a time was clicked), and fetched whole: browser-recorded WebM carries no
// duration or index, so the known lesson length drives the progress bar.
export function useLectureAudio(userId: string | null, recordingId: string | null, durationSeconds: number, enabled: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'missing'>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  // A seek asked for before the audio was ready.
  const pendingSeek = useRef<{ seconds: number; play: boolean } | null>(null);

  // Once asked for, a recording's audio stays loaded while the dialog shows it.
  const [requestedFor, setRequestedFor] = useState<string | null>(null);
  useEffect(() => { if (enabled && recordingId) setRequestedFor(recordingId); }, [enabled, recordingId]);
  const active = requestedFor === recordingId ? recordingId : null;

  useEffect(() => {
    setTime(0);
    setPlaying(false);
    pendingSeek.current = null;
  }, [recordingId]);

  useEffect(() => {
    if (!userId || !active) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setStatus('loading');
    void loadLectureAudio(userId, active).then((blob) => {
      if (cancelled) return;
      if (!blob) { setStatus('missing'); return; }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      setStatus('ready');
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
      setStatus('idle');
    };
  }, [userId, active]);

  const seek = useCallback((seconds: number, play = true) => {
    const audio = audioRef.current;
    if (!audio || status !== 'ready') {
      pendingSeek.current = { seconds, play };
      return;
    }
    audio.currentTime = Math.max(0, seconds);
    setTime(audio.currentTime);
    if (play) void audio.play().catch(() => undefined);
  }, [status]);

  // Once ready, honour a time clicked while it was loading.
  useEffect(() => {
    if (status !== 'ready' || !pendingSeek.current) return;
    const { seconds, play } = pendingSeek.current;
    pendingSeek.current = null;
    seek(seconds, play);
  }, [status, seek]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  }, []);

  const setRate = useCallback((value: number) => {
    setRateState(value);
    if (audioRef.current) audioRef.current.playbackRate = value;
  }, []);

  const finite = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);
  const audioProps = {
    ref: audioRef,
    src: url ?? undefined,
    preload: 'auto' as const,
    onTimeUpdate: () => setTime(audioRef.current?.currentTime ?? 0),
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
    onLoadedMetadata: () => { if (audioRef.current) audioRef.current.playbackRate = rate; },
  };

  return {
    status,
    time,
    playing,
    rate,
    duration: Math.max(durationSeconds, finite(audioRef.current?.duration ?? 0)),
    audioProps,
    seek,
    toggle,
    setRate,
  };
}
