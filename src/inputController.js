const GAMEPLAY_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'
]);

export function getAnalogStickVector(dx, dy, maxDistance, deadZoneRatio = 0.18) {
  const distance = Math.hypot(dx, dy);
  const deadZone = maxDistance * deadZoneRatio;
  if (distance <= deadZone || maxDistance <= deadZone) {
    return { x: 0, y: 0, strength: 0 };
  }

  const strength = Math.min(1, (distance - deadZone) / (maxDistance - deadZone));
  return {
    x: (dx / distance) * strength,
    y: (dy / distance) * strength,
    strength
  };
}

export function createInputController({ getGameState, onPause, onResume }) {
  const keys = {};
  let activeMovePointerId = null;
  let mobileOriginX = 0;
  let mobileOriginY = 0;
  let initialized = false;

  function clearKeys() {
    Object.keys(keys).forEach(key => {
      delete keys[key];
    });
    keys.__mobileMoveActive = false;
    keys.__mobileMoveX = 0;
    keys.__mobileMoveY = 0;
  }

  function setMobileMoveVector(vector) {
    keys.__mobileMoveX = vector.x;
    keys.__mobileMoveY = vector.y;
    keys.__mobileMoveActive = vector.strength > 0;
  }

  function reset() {
    clearKeys();
    activeMovePointerId = null;
    const knob = document.getElementById('mobileStickKnob');
    const control = document.getElementById('mobileMoveControl');
    if (knob) {
      knob.style.transform = 'translate(-50%, -50%)';
    }
    control?.classList.remove('active');
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
    const gameContainer = document.getElementById('gameContainer');
    const control = document.getElementById('mobileMoveControl');
    const knob = document.getElementById('mobileStickKnob');
    if (!gameContainer || !control || !knob) return;

    const placeControl = event => {
      const gameRect = gameContainer.getBoundingClientRect();
      mobileOriginX = event.clientX;
      mobileOriginY = event.clientY;
      control.style.left = `${event.clientX - gameRect.left}px`;
      control.style.top = `${event.clientY - gameRect.top}px`;
      control.classList.add('active');
    };

    const updateMobileMove = event => {
      const maxDistance = control.offsetWidth * 0.32;
      const rawDx = event.clientX - mobileOriginX;
      const rawDy = event.clientY - mobileOriginY;
      const distance = Math.hypot(rawDx, rawDy);
      const clampedDistance = Math.min(maxDistance, distance);
      const angle = Math.atan2(rawDy, rawDx);
      const knobX = distance > 0 ? Math.cos(angle) * clampedDistance : 0;
      const knobY = distance > 0 ? Math.sin(angle) * clampedDistance : 0;
      const vector = getAnalogStickVector(rawDx, rawDy, maxDistance);

      knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
      setMobileMoveVector(getGameState() === 'play' ? vector : { x: 0, y: 0, strength: 0 });
    };

    gameContainer.addEventListener('pointerdown', event => {
      if (
        event.pointerType !== 'touch' ||
        getGameState() !== 'play' ||
        activeMovePointerId !== null ||
        event.target.closest?.('button, input, select, a, .modal')
      ) return;

      event.preventDefault();
      activeMovePointerId = event.pointerId;
      placeControl(event);
      if (event.isTrusted) gameContainer.setPointerCapture?.(event.pointerId);
      updateMobileMove(event);
    });

    gameContainer.addEventListener('pointermove', event => {
      if (activeMovePointerId !== event.pointerId) return;
      event.preventDefault();
      updateMobileMove(event);
    });

    const endMobileMove = event => {
      if (activeMovePointerId !== event.pointerId) return;
      reset();
    };

    gameContainer.addEventListener('pointerup', endMobileMove);
    gameContainer.addEventListener('pointercancel', endMobileMove);
    gameContainer.addEventListener('lostpointercapture', reset);
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
