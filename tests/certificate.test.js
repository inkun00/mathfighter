import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CERTIFICATE_BOARD_URL,
  getAcademicGrade,
  openCertificateBoard
} from '../src/certificate.js';

test('opens the certificate registration board in a new browser tab', () => {
  const calls = [];
  const opened = openCertificateBoard((...args) => {
    calls.push(args);
    return { opened: true };
  });

  assert.deepEqual(calls, [[CERTIFICATE_BOARD_URL, '_blank', 'noopener,noreferrer']]);
  assert.deepEqual(opened, { opened: true });
});

test('uses player level when it exceeds the final stage grade', () => {
  assert.equal(getAcademicGrade({ level: 45, finalStage: 10 }), '수학 엠페러');
  assert.equal(getAcademicGrade({ level: 18, finalStage: 10 }), '수학 특공대장');
});

test('keeps final-stage achievements in the certificate grade', () => {
  assert.equal(getAcademicGrade({ level: 5, finalStage: 45 }), '수학 슈퍼스타');
  assert.equal(getAcademicGrade({ level: 5, finalStage: 30 }), '수학 마스터');
  assert.equal(getAcademicGrade({ level: 5, finalStage: 15 }), '수학 특공대');
});

test('uses the custom-mode grade prefix', () => {
  assert.equal(getAcademicGrade({ level: 30, finalStage: 5, customMode: true }), '분류 마스터');
});
