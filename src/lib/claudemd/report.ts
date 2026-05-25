import type { DoctorReport } from './types.js';

export function renderMd(_report: DoctorReport): string {
  throw new Error('renderMd: not implemented (codex-worker-2)');
}

export function renderText(_report: DoctorReport): string {
  throw new Error('renderText: not implemented (codex-worker-2)');
}

export function renderJson(report: DoctorReport): string {
  return JSON.stringify(report, null, 2);
}
