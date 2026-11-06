/* ==========================================================================
   Imports & Dependencies
   ========================================================================== */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { DataEngine } from '../core/DataEngine';
import { VitalsSettings } from '../settings/VitalsSettings';
import { ActivityView } from '../modules/activity/ActivityView';
import { SpotifyView } from '../modules/spotify/SpotifyView';
import { BooksView } from '../modules/books/BooksView';
import { HabitsView } from '../modules/habits/HabitsView';
import { VitalsModuleView } from '../models/ModuleView';

export const DASHBOARD_VIEW_TYPE = 'vitals-dashboard-view';

/* ==========================================================================
   Navigation Items & Vector SVG Icons
   ========================================================================== */

interface NavItem {
  id: string;
  label: string;
  svg: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'activity',
    label: 'Activity',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"></rect>
      <path d="M9 17V9"></path>
      <path d="M13 17V5"></path>
      <path d="M17 17v-4"></path>
    </svg>`,
  },
  {
    id: 'spotify',
    label: 'Spotify',
    // Official Spotify Brand Waveform
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.495 17.306c-.215.352-.676.463-1.028.248-2.817-1.722-6.362-2.111-10.538-1.157-.402.092-.801-.16-.893-.562-.092-.403.16-.802.562-.894 4.571-1.045 8.492-.596 11.649 1.336.352.216.464.677.248 1.029zm1.467-3.262c-.27.44-.848.579-1.288.31-3.225-1.982-8.141-2.557-11.956-1.399-.499.151-1.03-.134-1.181-.633-.151-.499.134-1.03.633-1.181 4.364-1.325 9.774-.683 13.482 1.595.44.269.58.848.31 1.288zm.126-3.41c-3.867-2.296-10.248-2.508-13.941-1.387-.593.18-1.22-.16-1.4-.753-.18-.593.16-1.22.753-1.4 4.246-1.289 11.294-1.04 15.753 1.607.533.316.708 1.009.392 1.542-.316.533-1.009.708-1.542.392z"></path>
    </svg>`,
  },
  {
    id: 'books',
    label: 'Books',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      <line x1="8" y1="6" x2="16" y2="6"></line>
      <line x1="8" y1="10" x2="16" y2="10"></line>
    </svg>`,
  },
  {
    id: 'habits',
    label: 'Habits',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <circle cx="12" cy="12" r="6"></circle>
      <circle cx="12" cy="12" r="2"></circle>
    </svg>`,
  },
];

/* ==========================================================================
   VitalsAppShell Class Implementation
   ========================================================================== */

export class VitalsAppShell extends ItemView {
  private dataEngine: DataEngine;
  private settings: VitalsSettings;

  private activeModuleId: string = 'activity';
  private activeViewInstance: VitalsModuleView | null = null;

  private layoutWrapperEl: HTMLElement | null = null;
  private sidebarNavEl: HTMLElement | null = null;
  private mainStageEl: HTMLElement | null = null;
  private isCollapsed: boolean = false;

  constructor(leaf: WorkspaceLeaf, dataEngine: DataEngine, settings: VitalsSettings) {
    super(leaf);
    this.dataEngine = dataEngine;
    this.settings = settings;
  }

  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Vitals Dashboard';
  }

  getIcon(): string {
    return 'activity';
  }

  /* ==========================================================================
     Shell Layout Initialization
     ========================================================================== */

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('vitals-app-root');

    // Apply any local font configured in settings
    this.applyConfiguredFont(contentEl);

    // Matches your exact styles.css layout classes
    this.layoutWrapperEl = contentEl.createEl('div', { cls: 'vitals-layout-wrapper' });

    // 1. Sidebar
    const sidebarEl = this.layoutWrapperEl.createEl('aside', { cls: 'vitals-sidebar' });
    this.renderSidebarBrand(sidebarEl);
    this.sidebarNavEl = sidebarEl.createEl('nav', { cls: 'vitals-sidebar-nav' });
    this.renderSidebarNav();
    this.renderSidebarFooter(sidebarEl);

    // 2. Main Stage
    this.mainStageEl = this.layoutWrapperEl.createEl('main', { cls: 'vitals-main-stage' });

    // Render Initial View
    await this.switchModule(this.activeModuleId);
  }

  /* ==========================================================================
   Font Configuration Injector (Supports All Local PC Fonts)
   ========================================================================== */

  /* ==========================================================================
   Font Configuration Injector (Reads customFontFamily)
   ========================================================================== */

  private applyConfiguredFont(targetEl?: HTMLElement): void {
    const rawFont = this.settings.customFontFamily || 'Geist Mono';
    const fontName = rawFont.trim();

    // Quotes font names with spaces (e.g. "Times New Roman")
    const fontRule = fontName
      ? `"${fontName}", "Geist Mono", ui-monospace, Consolas, monospace`
      : `"Geist Mono", ui-monospace, Consolas, monospace`;

    // 1. Set on target container if provided
    if (targetEl) {
      targetEl.style.setProperty('--vitals-font-family', fontRule);
      targetEl.style.setProperty('font-family', fontRule, 'important');
    }

    // 2. Set across all active Vitals app root elements
    const roots = document.querySelectorAll<HTMLElement>('.vitals-app-root');
    roots.forEach((el) => {
      el.style.setProperty('--vitals-font-family', fontRule);
      el.style.setProperty('font-family', fontRule, 'important');
    });

    // 3. Set on document body so all descendant elements inherit it
    document.body.style.setProperty('--vitals-font-family', fontRule);
  }

  /* ==========================================================================
     Sidebar Components (Brand Header, Navigation Items, Footer)
     ========================================================================== */

  /* ==========================================================================
   Sidebar Brand Header Component
   ========================================================================== */

  private renderSidebarBrand(container: HTMLElement): void {
    const brand = container.createEl('div', { cls: 'vitals-sidebar-brand' });

    const titleArea = brand.createEl('div', { cls: 'vitals-brand-title' });
    const brandIcon = titleArea.createEl('span', { cls: 'vitals-brand-icon' });
    brandIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>`;

    titleArea.createEl('span', { text: 'Vitals', cls: 'vitals-brand-name' });

    const toggleBtn = brand.createEl('button', {
      cls: 'vitals-sidebar-toggle-btn',
      attr: { 'aria-label': 'Toggle Sidebar', title: 'Toggle Sidebar' },
    });

    const updateToggleIcon = () => {
      toggleBtn.innerHTML = this.isCollapsed
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
    };

    updateToggleIcon();

    toggleBtn.addEventListener('click', () => {
      this.isCollapsed = !this.isCollapsed;
      if (this.layoutWrapperEl) {
        this.layoutWrapperEl.toggleClass('is-collapsed', this.isCollapsed);
      }
      updateToggleIcon();
    });
  }

  private renderSidebarNav(): void {
    if (!this.sidebarNavEl) return;
    this.sidebarNavEl.empty();

    for (const item of NAV_ITEMS) {
      const btn = this.sidebarNavEl.createEl('button', {
        cls: `vitals-nav-item ${this.activeModuleId === item.id ? 'is-active' : ''}`,
      });

      // SVG Vector Icon
      const iconSpan = btn.createEl('span', { cls: `vitals-nav-icon icon-${item.id}` });
      iconSpan.innerHTML = item.svg;

      // Text Label
      btn.createEl('span', { text: item.label, cls: 'vitals-nav-text' });

      btn.addEventListener('click', () => {
        if (this.activeModuleId === item.id) return;
        this.switchModule(item.id);
      });
    }
  }

  private renderSidebarFooter(container: HTMLElement): void {
    const footer = container.createEl('div', { cls: 'vitals-sidebar-footer' });
    footer.createEl('span', { text: 'v1.1.0', cls: 'vitals-version-tag' });
  }

  /* ==========================================================================
     Module Switching & Lifecycle
     ========================================================================== */

  public async switchModule(moduleId: string): Promise<void> {
    this.activeModuleId = moduleId;

    // Update active class on nav items
    if (this.sidebarNavEl) {
      this.sidebarNavEl.querySelectorAll('.vitals-nav-item').forEach((el) => {
        el.classList.remove('is-active');
      });
      const activeBtn = this.sidebarNavEl.querySelector(`.icon-${moduleId}`)?.closest('.vitals-nav-item');
      if (activeBtn) {
        activeBtn.classList.add('is-active');
      }
    }

    if (!this.mainStageEl) return;

    // Clean up previous view instance
    if (this.activeViewInstance && typeof this.activeViewInstance.destroy === 'function') {
      this.activeViewInstance.destroy();
    }
    this.mainStageEl.empty();

    // Mount requested module view
    switch (moduleId) {
      case 'spotify':
        this.activeViewInstance = new SpotifyView(this.app, this.settings);
        break;
      case 'books':
        this.activeViewInstance = new BooksView(this.app, this.settings);
        break;
      case 'habits':
        this.activeViewInstance = new HabitsView(this.app, this.settings);
        break;
      case 'activity':
      default:
        this.activeViewInstance = new ActivityView(this.app, this.dataEngine, this.settings);
        break;
    }

    await this.activeViewInstance.render(this.mainStageEl);
  }

  /* ==========================================================================
     Public Refresh & Settings Propagation
     ========================================================================== */

  public async render(): Promise<void> {
    if (this.mainStageEl && this.activeViewInstance) {
      await this.activeViewInstance.render(this.mainStageEl);
    }
  }

  public updateSettings(settings: VitalsSettings): void {
    this.settings = settings;
    this.applyConfiguredFont();
    const view = this.activeViewInstance as any;
    if (view && typeof view.updateSettings === 'function') {
      view.updateSettings(settings);
    }
  }
  async onClose(): Promise<void> {
    if (this.activeViewInstance && typeof this.activeViewInstance.destroy === 'function') {
      this.activeViewInstance.destroy();
    }
  }
}
