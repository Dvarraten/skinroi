import { nameMatchScore } from './nameMatch';

const ok = (a, b) => expect(nameMatchScore(a, b)).toBeGreaterThanOrEqual(0.9);
const no = (a, b) => expect(nameMatchScore(a, b)).toBeLessThan(0.9);

test('exact and near-exact names match', () => {
  ok('★ Butterfly Knife | Gamma Doppler (Factory New)', '★ Butterfly Knife | Gamma Doppler (Factory New)');
  ok('★ Butterfly Knife | Gamma Doppler (Factory New)', 'Butterfly Knife | Gamma Doppler');
  ok('StatTrak™ AK-47 | Redline (Field-Tested)', 'stattrak ak-47 | redline');
  ok('AK-47 | Redline (Field-Tested)', 'AK47 | Redline');
});

test('different weapon with the same skin does not match', () => {
  no('★ Navaja Knife | Gamma Doppler (Factory New)', '★ Butterfly Knife | Gamma Doppler (Factory New)');
  no('P250 | Sand Dune (Field-Tested)', 'P90 | Sand Dune (Field-Tested)');
  no('MP7 | Fade (Factory New)', 'MP9 | Fade (Factory New)');
  no('M4A1-S | Nitro (Field-Tested)', 'M4A4 | Nitro (Field-Tested)');
});

test('different skin or wear does not match', () => {
  no('AK-47 | Redline (Field-Tested)', 'AK-47 | Redline (Minimal Wear)');
  no('AWP | Asiimov (Field-Tested)', 'AWP | Atheris (Field-Tested)');
  no('StatTrak™ AK-47 | Redline (Field-Tested)', 'AK-47 | Redline');
});
