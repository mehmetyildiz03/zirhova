import {
  freshActions,
  mergeActions,
  readGamepadActions,
  pickDirection,
} from '../src/controllerSystem.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const a = freshActions();
const b = freshActions();
a.up = true;
assert(!b.up, 'freshActions must return independent objects');

const merged = mergeActions(
  { up: true, fire: false },
  { right: true, fire: true }
);
assert(merged.up && merged.right && merged.fire, 'mergeActions must OR action sources');

const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
const fakePad = {
  connected: true,
  axes: [0.82, 0.25],
  buttons,
};

let actions = readGamepadActions(fakePad);
assert(actions.right && !actions.down, 'dominant analog axis should choose right');
assert(pickDirection(actions) === 'right', 'pickDirection should return right');

fakePad.axes = [0.2, -0.91];
actions = readGamepadActions(fakePad);
assert(actions.up && !actions.right, 'dominant analog axis should choose up');

fakePad.axes = [0, 0];
buttons[14] = { pressed: true, value: 1 };
actions = readGamepadActions(fakePad);
assert(actions.left, 'D-pad left should map to left');
buttons[14] = { pressed: false, value: 0 };

buttons[0] = { pressed: true, value: 1 };
actions = readGamepadActions(fakePad);
assert(actions.fire, 'primary face button should fire');

const disconnected = readGamepadActions({ connected: false, axes: [1, 1], buttons });
assert(!Object.values(disconnected).some(Boolean), 'disconnected pad must produce no actions');

console.log('Validated controller input mapping.');
