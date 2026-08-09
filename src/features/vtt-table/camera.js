function clampNumber(value, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.max(minimum, Math.min(maximum, numeric));
}

export function constrainVttCamera(camera, dimensions) {
  const minimumZoom = Number(dimensions.minimumZoom);
  const maximumZoom = Number(dimensions.maximumZoom);
  const scale = clampNumber(camera.scale, minimumZoom, maximumZoom);
  const stageWidth = Math.max(0, Number(dimensions.stageWidth) || 0);
  const stageHeight = Math.max(0, Number(dimensions.stageHeight) || 0);
  const viewportWidth = Math.max(0, Number(dimensions.viewportWidth) || 0);
  const viewportHeight = Math.max(0, Number(dimensions.viewportHeight) || 0);
  const overflowX = Math.max(0, (stageWidth * scale - viewportWidth) / 2);
  const overflowY = Math.max(0, (stageHeight * scale - viewportHeight) / 2);
  return {
    scale,
    x: overflowX > 0 ? clampNumber(camera.x, -overflowX, overflowX) : 0,
    y: overflowY > 0 ? clampNumber(camera.y, -overflowY, overflowY) : 0,
  };
}

export function zoomVttCameraAtPoint(camera, input) {
  const nextScale = clampNumber(
    Number(camera.scale) * Math.exp(-Number(input.deltaY) * 0.0015),
    Number(input.minimumZoom),
    Number(input.maximumZoom),
  );
  const ratio = nextScale / Number(camera.scale);
  return constrainVttCamera({
    scale: nextScale,
    x: Number(input.pointerX) - (Number(input.pointerX) - Number(camera.x)) * ratio,
    y: Number(input.pointerY) - (Number(input.pointerY) - Number(camera.y)) * ratio,
  }, input);
}
