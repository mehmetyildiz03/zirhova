export const EMPTY_ACTIONS = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,
});

export function freshActions() {
  return { up: false, down: false, left: false, right: false, fire: false };
}

export function mergeActions(...sources) {
  const merged = freshActions();
  for (const source of sources) {
    if (!source) continue;
    for (const key of Object.keys(merged)) merged[key] ||= Boolean(source[key]);
  }
  return merged;
}

export function readGamepadActions(pad, threshold = 0.45) {
  const actions = freshActions();
  if (!pad || pad.connected === false) return actions;

  const axes = pad.axes || [];
  const buttons = pad.buttons || [];
  const pressed = index => Boolean(buttons[index]?.pressed || (buttons[index]?.value ?? 0) > 0.55);

  if (pressed(12)) actions.up = true;
  else if (pressed(13)) actions.down = true;
  else if (pressed(14)) actions.left = true;
  else if (pressed(15)) actions.right = true;
  else {
    const x = Number(axes[0] || 0);
    const y = Number(axes[1] || 0);

    if (Math.max(Math.abs(x), Math.abs(y)) >= threshold) {
      if (Math.abs(x) > Math.abs(y)) {
        actions[x > 0 ? 'right' : 'left'] = true;
      } else {
        actions[y > 0 ? 'down' : 'up'] = true;
      }
    }
  }

  actions.fire = pressed(0) || pressed(1) || pressed(2) || pressed(5);
  return actions;
}

export function gamepadPausePressed(pad) {
  if (!pad || pad.connected === false) return false;
  const buttons = pad.buttons || [];
  return Boolean(
    buttons[9]?.pressed ||
    buttons[8]?.pressed
  );
}

export function pickDirection(actions) {
  if (actions.up) return 'up';
  if (actions.down) return 'down';
  if (actions.left) return 'left';
  if (actions.right) return 'right';
  return null;
}
