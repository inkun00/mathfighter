const GAMEPLAY_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'
]);

export function createInputController({ getGameState, onPause, onResume }) {
  const keys = {};
  const mobileMoveKeys = new Set();
  let activeMovePointerId = null;
  let initialized = false;

  function clearKeys() {
    Object.keys(keys).forEach(key => {
      delete keys[key];
    });
    mobileMoveKeys.clear();
    keys.__mobileMoveActive = false;
  }

  function setMobileMoveKeys(nextKeys) {
    mobileMoveKeys.forEach(key => {
      keys[key] = false;
    });
    mobileMoveKeys.clear();

    nextKeys.forEach(key => {
      keys[key] = true;
      mobileMoveKeys.add(key);
    });
    keys.__mobileMoveActive = nextKeys.length > 0;
  }

  function reset() {
    clearKeys();
    activeMovePointerId = null;
    const knob = document.getElementById('mobileStickKnob');
    if (knob) {
      knob.style.transform = 'translate(-50%, -50%)';
    }
  }

  function setupKeyboard() {
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (getGameState() === 'play') onPause();
        else if (getGameState() === 'pause') onResume();
        return;
      }

      if (getGameState() === 'play' && GAMEPLAY_KEYS.has(event.key)) {
        event.preventDefault();
      }

      if (getGameState() !== 'start' && (event.key === 'Enter' || event.key === ' ')) {
        const active = document.activeElement;
        if (active?.tagName === 'BUTTON') {
          active.blur();
          event.preventDefault();
          return;
        }
      }

      keys[event.key] = true;
    });

    window.addEventListener('keyup', event => {
      keys[event.key] = false;
    });
  }

  function setupMobileMovement() {
    const control = document.getElementById('mobileMoveControl');
    const knob = document.getElementById('mobileStickKnob');
    if (!control || !knob) return;

    const updateMobileMove = event => {
      const rect = control.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxDistance = rect.width * 0.32;
      const rawDx = event.clientX - centerX;
      const rawDy = event.clientY - centerY;
      const distance = Math.hypot(rawDx, rawDy);
      const clampedDistance = Math.min(maxDistance, distance);
      const angle = Math.atan2(rawDy, rawDx);
      const knobX = distance > 0 ? Math.cos(angle) * clampedDistance : 0;
      const knobY = distance > 0 ? Math.sin(angle) * clampedDistance : 0;
      const deadZone = maxDistance * 0.24;
      const nextKeys = [];

      knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

      if (distance >= deadZone && getGameState() === 'play') {
        if (Math.sin(angle) < -0.35) nextKeys.push('ArrowUp');
        if (Math.sin(angle) > 0.35) nextKeys.push('ArrowDown');
        if (Math.cos(angle) < -0.35) nextKeys.push('ArrowLeft');
        if (Math.cos(angle) > 0.35) nextKeys.push('ArrowRight');
      }

      setMobileMoveKeys(nextKeys);
    };

    control.addEventListener('pointerdown', event => {
      event.preventDefault();
      activeMovePointerId = event.pointerId;
      control.setPointerCapture?.(event.pointerId);
      updateMobileMove(event);
    });

    control.addEventListener('pointermove', event => {
      if (activeMovePointerId !== event.pointerId) return;
      event.preventDefault();
      updateMobileMove(event);
    });

    const endMobileMove = event => {
      if (activeMovePointerId !== event.pointerId) return;
      reset();
    };

    control.addEventListener('pointerup', endMobileMove);
    control.addEventListener('pointercancel', endMobileMove);
    control.addEventListener('lostpointercapture', reset);
  }

  function setupMobilePause() {
    const pauseButton = document.getElementById('mobilePauseBtn');
    if (!pauseButton) return;

    const activatePause = event => {
      event.preventDefault();
      event.stopPropagation();
      onPause();
    };

    document.addEventListener('pointerup', event => {
      if (event.target.closest?.('#mobilePauseBtn')) activatePause(event);
    }, true);
    pauseButton.addEventListener('pointerup', activatePause);
    pauseButton.addEventListener('click', activatePause);
  }

  function setup() {
    if (initialized) return;
    initialized = true;
    setupKeyboard();
    setupMobileMovement();
    setupMobilePause();
  }

  return { keys, reset, setup };
}
