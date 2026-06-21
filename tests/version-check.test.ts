import { afterEach, describe, expect, it } from 'vitest';

import { checkAngularVersion } from '../src/instrumentation/version-check';

const originalDocument = globalThis.document;
const originalNg = (globalThis as any).ng;
const originalGetAllAngularRootElements = (globalThis as any).getAllAngularRootElements;

function setNgVersionAttribute(version: string | null): void {
  globalThis.document = {
    querySelector: (selector: string) => {
      if (selector === '[ng-version]' && version) {
        return {
          getAttribute: (name: string) => (name === 'ng-version' ? version : null),
        };
      }

      return null;
    },
    querySelectorAll: () => [],
  } as any;
}

function setAngularMarkerAttributes(attributeNames: string[]): void {
  const elements = attributeNames.map((name) => ({
    attributes: [{ name }],
  }));

  globalThis.document = {
    querySelector: () => null,
    querySelectorAll: () => elements,
  } as any;
}

afterEach(() => {
  globalThis.document = originalDocument;
  (globalThis as any).ng = originalNg;
  (globalThis as any).getAllAngularRootElements = originalGetAllAngularRootElements;
});

describe('Angular version compatibility gate', () => {
  it('accepts Angular 21 from the production ng-version marker', () => {
    setNgVersionAttribute('21.0.0');

    expect(checkAngularVersion()).toEqual({
      supported: true,
      version: '21.0.0',
      major: 21,
    });
  });

  it('accepts Angular 21 from the development-mode ng.VERSION global', () => {
    setNgVersionAttribute(null);
    (globalThis as any).ng = {
      VERSION: { full: '21.1.3' },
    };

    expect(checkAngularVersion()).toEqual({
      supported: true,
      version: '21.1.3',
      major: 21,
    });
  });

  it('keeps Angular 16 outside the supported runtime instrumentation gate', () => {
    setNgVersionAttribute('16.2.12');

    expect(checkAngularVersion()).toEqual({
      supported: false,
      version: '16.2.12',
      major: 16,
    });
  });

  it('accepts unknown production Angular apps with prefixed host attributes', () => {
    setAngularMarkerAttributes(['_nghost-ng-c123']);

    expect(checkAngularVersion()).toEqual({
      supported: true,
      version: 'unknown',
      major: null,
    });
  });

  it('accepts unknown Angular apps with ng-reflect debug attributes', () => {
    setAngularMarkerAttributes(['ng-reflect-router-link']);

    expect(checkAngularVersion()).toEqual({
      supported: true,
      version: 'unknown',
      major: null,
    });
  });

  it('accepts unknown Angular apps exposed through getAllAngularRootElements', () => {
    setNgVersionAttribute(null);
    (globalThis as any).getAllAngularRootElements = () => [{}];

    expect(checkAngularVersion()).toEqual({
      supported: true,
      version: 'unknown',
      major: null,
    });
  });

  it('rejects invalid version markers when there is no other Angular evidence', () => {
    setNgVersionAttribute('not-a-version');

    expect(checkAngularVersion()).toEqual({
      supported: false,
      version: null,
      major: null,
    });
  });

  it('fails safely when document is not available', () => {
    delete (globalThis as any).document;

    expect(checkAngularVersion()).toEqual({
      supported: false,
      version: null,
      major: null,
    });
  });
});
