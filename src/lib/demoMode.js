const DEMO_KEY = 'reviso_demo_start';
const DEMO_DURATION_HOURS = 24;

let _demoActive = false;

export function isDemoUser(user) {
  if (!user) return false;
  const isPlatformOwner = user.role === 'admin' && !user.workshop_id;
  return !user.workshop_id && !isPlatformOwner;
}

export function setDemoModeActive(active) {
  _demoActive = active;
  if (active) {
    if (!getDemoStart()) {
      localStorage.setItem(DEMO_KEY, new Date().toISOString());
    }
  } else {
    localStorage.removeItem(DEMO_KEY);
  }
}

export function isDemoActive() {
  return _demoActive;
}

export function getDemoStart() {
  return localStorage.getItem(DEMO_KEY);
}

export function isDemoExpired() {
  if (!_demoActive) return false;
  const start = getDemoStart();
  if (!start) return false;
  const elapsed = Date.now() - new Date(start).getTime();
  return elapsed > DEMO_DURATION_HOURS * 60 * 60 * 1000;
}

export function getDemoHoursRemaining() {
  const start = getDemoStart();
  if (!start) return DEMO_DURATION_HOURS;
  const elapsed = Date.now() - new Date(start).getTime();
  const remaining = DEMO_DURATION_HOURS * 60 * 60 * 1000 - elapsed;
  return Math.max(0, Math.ceil(remaining / (60 * 60 * 1000)));
}