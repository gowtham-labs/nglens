export type RegistryTab =
  | 'app' | 'components' | 'directives' | 'pipes'
  | 'services' | 'modules' | 'routes'
  | 'guards' | 'interceptors' | 'resolvers' | 'classes' | 'tokens' | 'app-config';

export interface FlatRoute {
  key: string;
  path: string;
  absolutePath: string;
  component: string | null;
  redirectTo: string | null;
  guards: string[];
  resolvers: string[];
  depth: number;
  isLazy: boolean;
  title: string | null;
  loadedChildren: boolean;
  isActive: boolean;
  lazyImportPath?: string | null;
}
