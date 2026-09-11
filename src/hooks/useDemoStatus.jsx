import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";

const TRIAL_DURATION_HOURS = 24;

export function useDemoStatus() {
  const { isDemo, trialStartedAt } = useAuth();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isDemo) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, [isDemo]);

  const trialStart = trialStartedAt ? new Date(trialStartedAt).getTime() : null;
  const elapsed = trialStart ? Date.now() - trialStart : 0;
  const isExpired = isDemo && trialStart ? elapsed > TRIAL_DURATION_HOURS * 60 * 60 * 1000 : false;
  const hoursRemaining = trialStart
    ? Math.max(0, Math.ceil((TRIAL_DURATION_HOURS * 60 * 60 * 1000 - elapsed) / (60 * 60 * 1000)))
    : TRIAL_DURATION_HOURS;

  return { isDemo, isExpired, hoursRemaining };
}