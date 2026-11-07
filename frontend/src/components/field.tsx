'use client';
import { motion, useScroll, useTransform } from 'motion/react';

type Orb = { kind: 'halo' | 'lens' | 'shade'; size: string; x: string; y: string; drift?: 1 | 2; ratio?: number };

/** The grainy yellow light from the brand image, built from three kinds of sphere. */
export function Field({ orbs, fixed, intro, parallax }: { orbs: Orb[]; fixed?: boolean; intro?: boolean; parallax?: boolean }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 900], [0, parallax ? 160 : 0]);
  const scale = useTransform(scrollY, [0, 900], [1, parallax ? 1.12 : 1]);
  return (
    <motion.div className={`field${fixed ? ' field--fixed' : ''}`} style={{ y, scale }} aria-hidden="true">
      {orbs.map((o, i) => (
        <div
          key={i}
          className={`orb orb--${o.kind}${o.drift === 2 ? ' drift-2' : o.drift ? ' drift' : ''}${intro ? ' orb-in' : ''}`}
          style={{ width: o.size, left: o.x, top: o.y, ['--ratio' as string]: o.ratio ?? 1, ['--d' as string]: `${i * 0.08}s` }}
        />
      ))}
    </motion.div>
  );
}

/** Dim version for app pages, so every screen sits in the same light. */
export function QuietField() {
  return (
    <div style={{ opacity: 0.38 }}>
      <Field
        fixed
        orbs={[
          { kind: 'halo', size: 'min(70vw, 820px)', x: '92%', y: '8%', drift: 1 },
          { kind: 'shade', size: 'min(26vw, 300px)', x: '84%', y: '16%', drift: 2 },
          { kind: 'halo', size: 'min(50vw, 600px)', x: '0%', y: '100%', drift: 2 },
        ]}
      />
    </div>
  );
}
