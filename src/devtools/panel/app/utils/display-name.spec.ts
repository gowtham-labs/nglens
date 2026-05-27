import { describe, it, expect } from 'vitest';
import { displayName, componentNameToSelector } from './display-name';

describe('displayName', () => {
  it('strips leading underscores', () => {
    expect(displayName('_LayoutComponent')).toBe('LayoutComponent');
  });

  it('strips multiple leading underscores', () => {
    expect(displayName('___AppComponent')).toBe('AppComponent');
  });

  it('returns unchanged string when no leading underscores', () => {
    expect(displayName('HeroListComponent')).toBe('HeroListComponent');
  });

  it('returns empty string for empty input', () => {
    expect(displayName('')).toBe('');
  });

  it('returns empty string for only underscores', () => {
    expect(displayName('___')).toBe('');
  });
});

describe('componentNameToSelector', () => {
  it('converts _LayoutComponent to app-layout', () => {
    expect(componentNameToSelector('_LayoutComponent')).toBe('app-layout');
  });

  it('converts HeroListComponent to app-hero-list', () => {
    expect(componentNameToSelector('HeroListComponent')).toBe('app-hero-list');
  });

  it('strips multiple leading underscores', () => {
    expect(componentNameToSelector('___NavBarComponent')).toBe('app-nav-bar');
  });

  it('handles component name without Component suffix', () => {
    expect(componentNameToSelector('Dashboard')).toBe('app-dashboard');
  });

  it('handles empty string', () => {
    expect(componentNameToSelector('')).toBe('app-');
  });
});
