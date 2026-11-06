export interface VitalsModuleView {
  render(container: HTMLElement): void;
  destroy?(): void;
}

export type VitalsNavTab = 'activity' | 'spotify' | 'books' | 'habits';
