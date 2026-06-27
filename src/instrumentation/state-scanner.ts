import type { ObservableStateEntry, SignalStateEntry } from '../types/app-structure';
import { MAX_INSTANCE_PROPS, SKIP_PROP_PREFIXES } from './constants';

/**
 * Scans a live object instance for Angular signal properties and RxJS subjects.
 */
export function scanInstanceState(
  inst: any,
  className: string,
  entityType: 'component' | 'service',
  seen: Set<string>,
  signalMap: Map<string, SignalStateEntry>,
  obsMap: Map<string, ObservableStateEntry>,
): void {
  if (!inst || !className || seen.has(className)) return;
  seen.add(className);

  const writableSignals: string[] = [];
  const computedSignals: string[] = [];
  const effects: string[] = [];
  const subjects: string[] = [];
  const observables: string[] = [];

  const ownKeys = safeGetKeys(inst);

  for (const key of ownKeys) {
    if (shouldSkipProp(key)) continue;
    try {
      const value = inst[key];
      if (value == null) continue;

      if (isAngularSignal(value)) {
        if (isWritableSignal(value)) {
          writableSignals.push(key);
        } else {
          computedSignals.push(key);
        }
      } else if (isAngularEffect(value)) {
        effects.push(key);
      } else if (isRxjsSubject(value)) {
        subjects.push(key);
      } else if (isRxjsObservable(value)) {
        observables.push(key);
      }
    } catch { /* ignore */ }
  }

  if (writableSignals.length + computedSignals.length + effects.length > 0) {
    signalMap.set(className, { className, entityType, writableSignals, computedSignals, effects });
  }
  if (subjects.length + observables.length > 0) {
    obsMap.set(className, { className, entityType, subjects, observables });
  }
}

function safeGetKeys(inst: any): string[] {
  try {
    const own = Object.getOwnPropertyNames(inst).slice(0, MAX_INSTANCE_PROPS);
    const proto = inst.constructor?.prototype
      ? Object.getOwnPropertyNames(inst.constructor.prototype).slice(0, MAX_INSTANCE_PROPS)
      : [];
    return [...new Set([...own, ...proto])];
  } catch {
    return [];
  }
}

function shouldSkipProp(key: string): boolean {
  return SKIP_PROP_PREFIXES.some(p => key.startsWith(p)) || key === 'constructor';
}

/** Angular signals are functions with a SIGNAL brand symbol on them. */
function isAngularSignal(value: any): boolean {
  if (typeof value !== 'function') return false;
  try {
    const syms = Object.getOwnPropertySymbols(value);
    if (syms.some(s => String(s).toLowerCase().includes('signal'))) return true;
    // Fallback: callable with .set() + .update() OR callable with no args returning a value
    return (typeof value.set === 'function' && typeof value.update === 'function') ||
           (typeof value.set === 'function');
  } catch {
    return false;
  }
}

/** Writable signal: has .set() method */
function isWritableSignal(value: any): boolean {
  return typeof value?.set === 'function';
}

/** Angular effect() ref: object with destroy() and internal reactive-node symbols */
function isAngularEffect(value: any): boolean {
  if (!value || typeof value !== 'object' || typeof value === 'function') return false;
  if (typeof value.destroy !== 'function') return false;
  // Avoid false-positives (RxJS subscriptions also have unsubscribe/destroy)
  if (typeof value.next === 'function' || typeof value.subscribe === 'function') return false;
  try {
    const ctorName: string = value.constructor?.name ?? '';
    if (ctorName.toLowerCase().includes('effect')) return true;
    const syms = Object.getOwnPropertySymbols(value);
    return syms.some(s => {
      const str = String(s).toLowerCase();
      return str.includes('effect') || str.includes('reactivenode') || str.includes('node');
    });
  } catch {
    return false;
  }
}

/** Duck-type RxJS Subject / BehaviorSubject / ReplaySubject */
function isRxjsSubject(value: any): boolean {
  return value != null &&
    typeof value === 'object' &&
    typeof value.next === 'function' &&
    typeof value.subscribe === 'function' &&
    typeof value.asObservable === 'function';
}

/** Duck-type RxJS Observable (pipe + subscribe) */
function isRxjsObservable(value: any): boolean {
  return value != null &&
    typeof value === 'object' &&
    typeof value.pipe === 'function' &&
    typeof value.subscribe === 'function' &&
    !isRxjsSubject(value);
}
