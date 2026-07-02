import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'overview', pathMatch: 'full' },
  { path: 'overview', loadComponent: () => import('./pages/overview/overview.component').then(m => m.OverviewComponent) },
  { path: 'rendering', loadComponent: () => import('./pages/rendering/rendering.component').then(m => m.RenderingComponent) },
  { path: 'profiler', redirectTo: 'rendering', pathMatch: 'full' },
  { path: 'memory', loadComponent: () => import('./pages/memory/memory.component').then(m => m.MemoryComponent) },
  { path: 'recommendations', loadComponent: () => import('./pages/recommendations/recommendations.component').then(m => m.RecommendationsComponent) },
  { path: 'app-structure', loadComponent: () => import('./pages/app-structure/app-structure.component').then(m => m.AppStructureComponent) },
];
