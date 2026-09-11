import Lenis from 'lenis';
import { useCallback, useEffect, useRef } from 'react';

export function useLenisViewport<T extends HTMLElement>() {
  const elementRef = useRef<T | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const ref = useCallback((element: T | null) => {
    elementRef.current = element;
    lenisRef.current?.destroy();
    lenisRef.current = null;
    if (!element) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({
      wrapper: element,
      smoothWheel: true,
      touchMultiplier: 1,
    });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    lenisRef.current = lenis;
    const cancel = () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      if (lenisRef.current === lenis) lenisRef.current = null;
    };
    (element as unknown as { __tuhclipLenisCleanup?: () => void }).__tuhclipLenisCleanup = cancel;
  }, []);

  useEffect(() => {
    return () => {
      const element = elementRef.current as unknown as { __tuhclipLenisCleanup?: () => void } | null;
      element?.__tuhclipLenisCleanup?.();
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, []);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const element = elementRef.current;
    if (!element) return;
    const lenis = lenisRef.current;
    if (lenis && smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      lenis.scrollTo(element.scrollHeight, { immediate: false });
      return;
    }
    element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  return { ref, scrollToBottom };
}
