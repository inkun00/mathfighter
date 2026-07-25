const ARENA_SCALE = 2;

export function createCameraController({ getCanvas, getPlayer, getWorldSize, setWorldSize }) {
  let offset = { x: 0, y: 0, initialized: false };

  function isMobileBrowserViewport() {
    return window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth <= 760;
  }

  function resetCameraOffset() {
    offset = { x: 0, y: 0, initialized: false };
  }

  function resizeCanvas() {
    const canvas = getCanvas();
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.getContext('2d').imageSmoothingEnabled = false;
    setWorldSize(canvas.width * ARENA_SCALE, canvas.height * ARENA_SCALE);
    resetCameraOffset();
  }

  function getTargetCameraOffset() {
    const canvas = getCanvas();
    const player = getPlayer();
    const { worldWidth, worldHeight } = getWorldSize();
    if (!player) return { x: 0, y: 0 };

    return {
      x: Math.max(0, Math.min(worldWidth - canvas.width, player.x - canvas.width / 2)),
      y: Math.max(0, Math.min(worldHeight - canvas.height, player.y - canvas.height / 2))
    };
  }

  function getCameraOffset() {
    const canvas = getCanvas();
    const { worldWidth, worldHeight } = getWorldSize();
    const target = getTargetCameraOffset();
    if (!offset.initialized) {
      offset = { ...target, initialized: true };
      return target;
    }

    const smoothing = isMobileBrowserViewport() ? 0.12 : 1;
    offset.x += (target.x - offset.x) * smoothing;
    offset.y += (target.y - offset.y) * smoothing;
    return {
      x: Math.max(0, Math.min(worldWidth - canvas.width, offset.x)),
      y: Math.max(0, Math.min(worldHeight - canvas.height, offset.y))
    };
  }

  return { getCameraOffset, isMobileBrowserViewport, resetCameraOffset, resizeCanvas };
}
