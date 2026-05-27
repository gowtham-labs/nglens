/**
 * Strips leading underscores from a component name for display purposes.
 * E.g., "_LayoutComponent" → "LayoutComponent"
 */
export function displayName(rawName: string): string {
  return rawName.replace(/^_+/, '');
}

/**
 * Converts a component class name to a CSS selector for DOM lookup.
 * Strips leading underscores, removes "Component" suffix, converts PascalCase
 * to kebab-case, and prepends "app-".
 *
 * E.g., "_LayoutComponent" → "app-layout"
 *       "HeroListComponent" → "app-hero-list"
 */
export function componentNameToSelector(rawName: string): string {
  // Strip leading underscores and "Component" suffix
  const cleaned = rawName.replace(/^_+/, '').replace(/Component$/, '');
  // PascalCase → kebab-case
  const kebab = cleaned.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return `app-${kebab}`;
}
