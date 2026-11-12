import {
  Directive,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  NgZone,
  Renderer2
} from '@angular/core';

@Directive({
  selector: 'table[appResizableTable]',
  standalone: true
})
export class ResizableTableDirective implements AfterViewInit, OnDestroy {
  private observer?: MutationObserver;
  private activeMoveUnlisten?: () => void;
  private activeUpUnlisten?: () => void;
  private rafId: number | null = null;

  constructor(
    private el: ElementRef<HTMLTableElement>,
    private ngZone: NgZone,
    private renderer: Renderer2
  ) {}

  ngAfterViewInit(): void {
    this.injectGlobalStyles();
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => this.initHandles(), 50);

      this.observer = new MutationObserver(() => {
        this.initHandles();
      });

      this.observer.observe(this.el.nativeElement, {
        childList: true,
        subtree: true
      });
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.cleanupDragListeners();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private injectGlobalStyles(): void {
    const styleId = 'imserp-resizable-table-styles';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }

    style.textContent = `
      table[appResizableTable] thead tr.mat-mdc-header-row,
      table[appResizableTable] thead tr {
        background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
        height: 44px !important;
      }
      table[appResizableTable] th.mat-mdc-header-cell,
      table[appResizableTable] thead th {
        position: relative;
        user-select: none;
        background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
        color: #1e293b !important;
        font-weight: 700 !important;
        font-size: 0.77rem !important;
        letter-spacing: 0.015em;
        border-top: 1px solid #e2e8f0 !important;
        border-bottom: 2px solid #cbd5e1 !important;
        padding-top: 8px !important;
        padding-bottom: 8px !important;
        padding-right: 16px !important;
        transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
        white-space: nowrap;
      }
      table[appResizableTable] th.mat-mdc-header-cell:not(.select-col):not(.col-actions):not(.actions-th):not(.mat-column-select):not(.mat-column-actions),
      table[appResizableTable] thead th:not(.select-col):not(.col-actions):not(.actions-th):not(.mat-column-select):not(.mat-column-actions) {
        border-right: 1px solid #e2e8f0 !important;
      }
      table[appResizableTable] th.mat-mdc-header-cell:hover:not(.select-col):not(.col-actions),
      table[appResizableTable] thead th:hover:not(.select-col):not(.col-actions) {
        background: linear-gradient(180deg, #eff6ff 0%, #e0f2fe 100%) !important;
        color: #1e3a8a !important;
      }
      table[appResizableTable] th.is-col-resizing {
        background: linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%) !important;
        color: #1e3a8a !important;
        border-bottom-color: #2563eb !important;
      }
      table[appResizableTable] td.is-col-resizing {
        border-right: 1px dashed rgba(37, 99, 235, 0.35) !important;
        background-color: rgba(239, 246, 255, 0.35) !important;
      }
      table[appResizableTable] .col-resize-handle {
        position: absolute;
        top: 0;
        right: -4px;
        bottom: 0;
        width: 9px;
        cursor: col-resize;
        z-index: 25;
        display: flex;
        align-items: center;
        justify-content: center;
        touch-action: none;
      }
      table[appResizableTable] .col-resize-handle::before {
        content: '';
        width: 3px;
        height: 16px;
        border-radius: 4px;
        background: transparent;
        transition: all 0.16s ease;
      }
      table[appResizableTable] th:hover .col-resize-handle::before {
        background: #60a5fa;
        height: 22px;
        box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
      }
      table[appResizableTable] .col-resize-handle:hover::before,
      table[appResizableTable] .col-resize-handle.is-resizing::before {
        background: #2563eb !important;
        width: 4px !important;
        height: 100% !important;
        border-radius: 0 !important;
        box-shadow: 0 0 8px rgba(37, 99, 235, 0.45);
      }
      body.imserp-col-resizing,
      body.imserp-col-resizing * {
        cursor: col-resize !important;
        user-select: none !important;
      }
    `;
  }

  private initHandles(): void {
    const table = this.el.nativeElement;
    if (!table) return;

    const headerCells = Array.from(
      table.querySelectorAll<HTMLTableCellElement>('thead tr th')
    );

    headerCells.forEach((th, colIndex) => {
      // Skip checkbox select column and sticky actions column at the far right
      if (
        th.classList.contains('select-col') ||
        th.classList.contains('col-actions') ||
        th.classList.contains('actions-th') ||
        th.classList.contains('mat-column-select') ||
        th.classList.contains('mat-column-actions')
      ) {
        return;
      }

      if (th.querySelector('.col-resize-handle')) {
        return;
      }

      const handle = this.renderer.createElement('span') as HTMLElement;
      handle.className = 'col-resize-handle';
      handle.title = 'Drag to resize column (Double-click to reset)';

      // Prevent MatSort from firing when clicking or dragging the handle
      handle.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      });

      handle.addEventListener('dblclick', (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        this.resetColumnWidth(th, colIndex);
      });

      handle.addEventListener('pointerdown', (e: PointerEvent) => {
        this.onPointerDown(e, th, handle, colIndex);
      });

      this.renderer.appendChild(th, handle);
    });
  }

  private onPointerDown(
    event: PointerEvent,
    th: HTMLTableCellElement,
    handle: HTMLElement,
    colIndex: number
  ): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    this.cleanupDragListeners();

    const startX = event.clientX;
    const startWidth = th.getBoundingClientRect().width;
    const minWidth = 56;

    handle.classList.add('is-resizing');
    th.classList.add('is-col-resizing');
    document.body.classList.add('imserp-col-resizing');

    const table = this.el.nativeElement;
    const bodyCells = this.getColumnBodyCells(table, colIndex);
    for (let i = 0; i < bodyCells.length; i++) {
      bodyCells[i].classList.add('is-col-resizing');
    }

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = Math.max(minWidth, Math.round(startWidth + deltaX));

      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
      }

      this.rafId = requestAnimationFrame(() => {
        const wPx = `${nextWidth}px`;
        th.style.width = wPx;
        th.style.minWidth = wPx;
        th.style.maxWidth = wPx;

        for (let i = 0; i < bodyCells.length; i++) {
          const td = bodyCells[i];
          td.style.width = wPx;
          td.style.minWidth = wPx;
          td.style.maxWidth = wPx;
        }
        this.rafId = null;
      });
    };

    const onPointerUp = () => {
      handle.classList.remove('is-resizing');
      th.classList.remove('is-col-resizing');
      for (let i = 0; i < bodyCells.length; i++) {
        bodyCells[i].classList.remove('is-col-resizing');
      }
      document.body.classList.remove('imserp-col-resizing');
      this.cleanupDragListeners();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });

    this.activeMoveUnlisten = () => window.removeEventListener('pointermove', onPointerMove);
    this.activeUpUnlisten = () => window.removeEventListener('pointerup', onPointerUp);
  }

  private resetColumnWidth(th: HTMLTableCellElement, colIndex: number): void {
    th.style.width = '';
    th.style.minWidth = '';
    th.style.maxWidth = '';

    const bodyCells = this.getColumnBodyCells(this.el.nativeElement, colIndex);
    for (let i = 0; i < bodyCells.length; i++) {
      const td = bodyCells[i];
      td.style.width = '';
      td.style.minWidth = '';
      td.style.maxWidth = '';
    }
  }

  private getColumnBodyCells(table: HTMLTableElement, colIndex: number): HTMLTableCellElement[] {
    const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr'));
    const cells: HTMLTableCellElement[] = [];
    for (const row of rows) {
      if (row.children.length > colIndex) {
        const cell = row.children[colIndex] as HTMLTableCellElement;
        if (cell && cell.tagName === 'TD' && !cell.hasAttribute('colspan')) {
          cells.push(cell);
        }
      }
    }
    return cells;
  }

  private cleanupDragListeners(): void {
    if (this.activeMoveUnlisten) {
      this.activeMoveUnlisten();
      this.activeMoveUnlisten = undefined;
    }
    if (this.activeUpUnlisten) {
      this.activeUpUnlisten();
      this.activeUpUnlisten = undefined;
    }
  }
}

