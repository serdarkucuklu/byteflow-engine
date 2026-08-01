import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foldTr, subjectTokens, subjectsClash, clashingSubject, recentSubjects} from './subjects.mjs';

test('Türkçe aksan katlanır: iki yazım aynı özne', () => {
  assert.equal(foldTr('Hyalüronik Asit'), 'hyaluronik asit');
  assert.equal(subjectsClash('hyalüronik asit', 'hyaluronik asit'), true);
});

// 2026-08-01 CANLI HATA'nın birebir senaryosu: iki farklı başlık, aynı etken madde.
test('aynı etken maddeyi farklı açıyla anlatan iki video çakışır', () => {
  assert.equal(subjectsClash('hyalüronik asit', 'hyalüronik asit serumu'), true);
  assert.equal(subjectsClash('niasinamid', 'niasinamidin faydaları'), true);
});

test('jenerik kelimeler iki farklı özneyi çakıştırmaz', () => {
  assert.equal(subjectsClash('hyalüronik asit', 'salisilik asit'), false);
  assert.equal(subjectsClash('c vitamini serumu', 'retinol serumu'), false);
  assert.deepEqual(subjectTokens('Hyalüronik Asit Serumu'), ['hyaluronik']);
});

test('boş/eksik özne kimseyi yasaklamaz', () => {
  assert.equal(subjectsClash('', 'retinol'), false);
  assert.equal(subjectsClash('retinol', undefined), false);
  assert.equal(clashingSubject('retinol', []), null);
});

test('clashingSubject çakışan yasaklıyı döndürür', () => {
  assert.equal(clashingSubject('hyaluronik asit', ['retinol', 'hyalüronik asit']), 'hyalüronik asit');
  assert.equal(clashingSubject('kapatıcı', ['retinol', 'hyalüronik asit']), null);
});

test('recentSubjects: yeniden eskiye, tekrarsız, limitli', () => {
  const history = [
    {subject: 'retinol'}, {subject: 'niasinamid'}, {subject: null},
    {subject: 'hyalüronik asit'}, {subject: 'hyaluronik asit serumu'},
  ];
  assert.deepEqual(recentSubjects(history, 3), ['hyaluronik asit serumu', 'niasinamid', 'retinol']);
});

test('recentSubjects yayın durumuna BAKMAZ (tekrar her hâlükârda kötü)', () => {
  const history = [{subject: 'retinol', mediaId: '1'}, {subject: 'kapatıcı'}];
  assert.deepEqual(recentSubjects(history), ['kapatıcı', 'retinol']);
});
