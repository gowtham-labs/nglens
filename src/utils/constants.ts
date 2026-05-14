/**
 * Shared constants and thresholds for the Angular Performance Inspector.
 * All analyzers reference these values to ensure consistent detection criteria.
 */

// --- DOM Node Limits ---

/** Maximum DOM nodes in a single component subtree before flagging as excessive (production analyzer) */
export const DOM_NODE_LIMIT_CRITICAL = 1500;

/** Maximum DOM nodes in a single component subtree before flagging as excessive (DOM inspector) */
export const DOM_NODE_LIMIT_WARNING = 800;

// --- Timing Budgets ---

/** Maximum rendering phase duration in ms before flagging as a bottleneck */
export const FRAME_BUDGET_MS = 16;

/** Per-analyzer execution timeout in ms */
export const ANALYZER_TIMEOUT_MS = 5000;

/** Full scan timeout in ms */
export const SCAN_TIMEOUT_MS = 15000;

/** Page script response timeout in ms */
export const PAGE_SCRIPT_TIMEOUT_MS = 3000;

/** MutationObserver disconnect deadline after scan completes (ms) */
export const OBSERVER_DISCONNECT_MS = 100;

// --- Scan Caps ---

/** Maximum DOM elements traversed per scan pass */
export const MAX_ELEMENTS_PER_SCAN = 1000;

/** Maximum component tree depth for production analyzer traversal */
export const MAX_TREE_DEPTH = 512;

/** Maximum action items displayed in the UI */
export const MAX_ACTION_ITEMS_DISPLAY = 50;

/** Maximum profiling cycles before auto-stop */
export const MAX_PROFILING_CYCLES = 5000;

/** Maximum leak issues reported per scan */
export const MAX_LEAK_ISSUES = 50;

// --- Severity Weights (used by Action Prioritizer) ---

export const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
  info: 10,
};

// --- Category Multipliers (used by Action Prioritizer) ---

export const CATEGORY_MULTIPLIERS: Record<string, number> = {
  'change-detection': 1.5,
  'dom-complexity': 1.3,
  'memory-leaks': 1.4,
  'render-performance': 1.3,
  'bundle-size': 1,
  'signals-migration': 0.8,
  'zone-triggers': 1.1,
  'network-correlation': 0.9,
  'state-management': 0.7,
};

// --- Performance Budget Limits ---

/** Maximum CPU usage as a fraction of page CPU during analysis */
export const CPU_BUDGET_PERCENT = 3;

/** Maximum memory footprint in bytes (50MB) */
export const MEMORY_BUDGET_BYTES = 50 * 1024 * 1024; // 52_428_800

// --- Performance Score Weights ---

export const SCORE_WEIGHTS = {
  changeDetection: 0.4,
  componentTreeDepth: 0.2,
  templateComplexity: 0.2,
  detectedBottlenecks: 0.2,
} as const;

// --- Serialization Limits ---

/** Maximum string length before truncation in serialized output */
export const MAX_STRING_LENGTH = 500;

/** Truncation indicator appended to truncated strings */
export const TRUNCATION_INDICATOR = '... [truncated]';

// --- DOM Mutation Thresholds ---

/** Mutations per CD cycle that constitute a render bottleneck */
export const MUTATION_BOTTLENECK_THRESHOLD = 50;

/** Mutations per second sustained over observation window that indicate excessive re-renders */
export const MUTATION_RATE_THRESHOLD = 10;

/** Observation window in seconds for mutation rate detection */
export const MUTATION_OBSERVATION_WINDOW_S = 3;

// --- Impact Level Thresholds (Action Prioritizer) ---

export const IMPACT_LEVEL_HIGH_THRESHOLD = 100;
export const IMPACT_LEVEL_MEDIUM_THRESHOLD = 50;

// --- Angular Attribute Patterns ---

export const ANGULAR_HOST_ATTR_PREFIX = '_nghost-';
export const ANGULAR_CONTENT_ATTR_PREFIX = '_ngcontent-';
export const ANGULAR_REFLECT_ATTR_PREFIX = 'ng-reflect-';
export const ANGULAR_VERSION_ATTR = 'ng-version';
