'use client';

import { motion } from 'framer-motion';

export function LoginDecorations() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <motion.div
        className="login-deco-ring"
        style={{ width: 420, height: 420, top: '-8%', right: '-5%', borderWidth: 1 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="login-deco-ring"
        style={{ width: 280, height: 280, bottom: '10%', left: '-4%', borderWidth: 1, opacity: 0.5 }}
        animate={{ rotate: -360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        style={{
          position: 'absolute', top: '18%', right: '22%',
          width: 120, height: 120, borderRadius: 24,
          background: 'linear-gradient(135deg, var(--brand-soft), transparent)',
          border: '1px solid var(--brand-border)',
        }}
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        style={{
          position: 'absolute', bottom: '22%', right: '12%',
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--brand-lime-soft), transparent)',
          border: '1px solid var(--brand-border)',
        }}
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
    </div>
  );
}
