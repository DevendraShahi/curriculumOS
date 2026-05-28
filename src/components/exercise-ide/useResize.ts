/**
 * useResize — pointer-based drag resize hook.
 * Mutates a CSS custom property on a container element directly via style.setProperty.
 * No state → no re-renders during drag.
 */
import { useRef, useCallback, useEffect } from "react";

interface UseColResizeOpts {
  containerRef: React.RefObject<HTMLElement | null>;
  cssVar: string;      // e.g. "--ide-sidebar-w"
  initial: number;     // initial px value
  min: number;
  max: number;
}

export function useColResize({ containerRef, cssVar, initial, min, max }: UseColResizeOpts) {
  const dragging = useRef(false);
  const startX   = useRef(0);
  const startVal = useRef(initial);
  const live     = useRef(initial);

  useEffect(() => {
    containerRef.current?.style.setProperty(cssVar, `${initial}px`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    dragging.current = true;
    startX.current   = e.clientX;
    startVal.current = live.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!dragging.current || !containerRef.current) return;
    const next = Math.min(max, Math.max(min, startVal.current + (e.clientX - startX.current)));
    live.current = next;
    containerRef.current.style.setProperty(cssVar, `${next}px`);
  }, [containerRef, cssVar, min, max]);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}

interface UseRowResizeOpts {
  containerRef: React.RefObject<HTMLElement | null>;
  cssVar: string;
  initial: number;
  min: number;
  max: number;
}

export function useRowResize({ containerRef, cssVar, initial, min, max }: UseRowResizeOpts) {
  const dragging = useRef(false);
  const startY   = useRef(0);
  const startVal = useRef(initial);
  const live     = useRef(initial);

  useEffect(() => {
    containerRef.current?.style.setProperty(cssVar, `${initial}px`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    dragging.current = true;
    startY.current   = e.clientY;
    startVal.current = live.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!dragging.current || !containerRef.current) return;
    const next = Math.min(max, Math.max(min, startVal.current + (e.clientY - startY.current)));
    live.current = next;
    containerRef.current.style.setProperty(cssVar, `${next}px`);
  }, [containerRef, cssVar, min, max]);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}

/** 
 * useEditorFraction — like useColResize but stores % of a container rather than px.
 * Used for the editor/preview horizontal split.
 */
export function useEditorFraction(containerRef: React.RefObject<HTMLElement | null>, initial = 50) {
  const dragging  = useRef(false);
  const startX    = useRef(0);
  const startFrac = useRef(initial);
  const live      = useRef(initial);

  useEffect(() => {
    containerRef.current?.style.setProperty("--ide-editor-w", `${initial}%`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    dragging.current  = true;
    startX.current    = e.clientX;
    startFrac.current = live.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!dragging.current || !containerRef.current) return;
    const total = containerRef.current.getBoundingClientRect().width;
    if (!total) return;
    const deltaPct = ((e.clientX - startX.current) / total) * 100;
    const next = Math.min(80, Math.max(20, startFrac.current + deltaPct));
    live.current = next;
    containerRef.current.style.setProperty("--ide-editor-w", `${next}%`);
  }, [containerRef]);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}
