'use client';
import { MotionConfig } from 'motion/react';
import { type PropsWithChildren, useEffect } from 'react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { NearProvider } from '@/providers/near-provider';

/** Feeds the pointer position to every .btn so the glass highlight follows the cursor. */
function useGlassSheen() {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const b = (e.target as Element | null)?.closest?.<HTMLElement>('.btn');
      if (!b) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty('--mx', `${e.clientX - r.left}px`);
      b.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', move, { passive: true });
    return () => document.removeEventListener('pointermove', move);
  }, []);
}

export function Providers({ children }: PropsWithChildren) {
  useGlassSheen();
  return (
    <MotionConfig reducedMotion="user">
      <NearProvider>
        <Navigation />
        {children}
        <Footer />
      </NearProvider>
    </MotionConfig>
  );
}
