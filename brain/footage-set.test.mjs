import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveFootageSet} from './footage-set.mjs';
import {footageSetFor} from '../fetch/fetch-footage.mjs';
import {pillarsFor} from './pillars.mjs';

const softBeden = {footageSet: 'soft', altFootageSet: 'beden'};

test('saglik pillar + altFootageSet → beden; cream/serum/lipstick yok', () => {
  assert.equal(resolveFootageSet(softBeden, 'hormon-enerji'), 'beden');
  const liste = footageSetFor(resolveFootageSet(softBeden, 'hormon-enerji'));
  const blob = liste.join(' ').toLowerCase();
  assert.doesNotMatch(blob, /cream|serum|lipstick/);
});

test('skincare pillar → footageSet (soft); liste footageSetFor(soft) ile aynı', () => {
  const skinKey = pillarsFor('skincare-science')[0].key;
  assert.equal(resolveFootageSet(softBeden, skinKey), 'soft');
  assert.deepEqual(
    footageSetFor(resolveFootageSet(softBeden, skinKey)),
    footageSetFor('soft'));
});

test('altFootageSet yoksa saglik pillar da footageSet kullanır (kizlar)', () => {
  assert.equal(
    resolveFootageSet({footageSet: 'gunluk'}, 'hormon-enerji'),
    'gunluk');
});

test('bilinmeyen altFootageSet throw eder', () => {
  assert.throws(
    () => resolveFootageSet({footageSet: 'soft', altFootageSet: 'body'}, 'hormon-enerji'),
    /unknown footageSet/i);
});

test('footageSetFor bilinmeyen adda hâlâ tech (1.2 kilidi)', () => {
  assert.deepEqual(footageSetFor('yok-boyle-set'), footageSetFor('tech'));
});
