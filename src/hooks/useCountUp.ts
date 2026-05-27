import { useEffect, useRef, useState } from 'react';

/**
 * Animated count-up hook — from ui-ux-pro-max Financial Dashboard style.
 * Animates from 0 to target value with easing.
 */
export function useCountUp(
  target: number,
  duration = 800,
  decimals = 1,
): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);
  const startTime = useRef<number>(0);
  const startValue = useRef<number>(0);

  useEffect(() => {
    startValue.current = value;
    startTime.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = startValue.current + (target - startValue.current) * eased;
      setValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  if (target === 0 || isNaN(target) || !isFinite(target)) return target;
  return +value.toFixed(decimals);
}
