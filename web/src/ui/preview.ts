// Live PDF preview of the stickers with download and print links, and the
// options affecting the printout.

import { t } from '../i18n.ts';
import { generatePdf, LABELS_PER_PAGE } from '../labels.ts';
import { labelsToPrint, type State, type Store } from '../store.ts';
import { byId, debounce, h, icon } from './dom.ts';
import { icons } from './icons.ts';

function timestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function setupPreview(store: Store): void {
  const iframe = byId<HTMLIFrameElement>('preview');
  const empty = byId('preview-empty');
  const openLink = byId<HTMLAnchorElement>('open-pdf');
  const downloadLink = byId<HTMLAnchorElement>('download-pdf');
  const showBorder = byId<HTMLInputElement>('show-border');
  let url: string | null = null;

  openLink.replaceChildren(icon(icons.printer), t.openToPrint);
  downloadLink.replaceChildren(icon(icons.download), t.downloadPdf);

  function setEnabled(enabled: boolean): void {
    for (const link of [openLink, downloadLink]) {
      link.setAttribute('aria-disabled', String(!enabled));
      if (enabled && url) link.href = url;
      else link.removeAttribute('href');
    }
  }

  function showEmpty(content?: HTMLElement[]): void {
    iframe.hidden = true;
    empty.hidden = false;
    if (content) empty.replaceChildren(...content);
    setEnabled(false);
  }

  const defaultEmpty = [...empty.children] as HTMLElement[];

  function update(state: State): void {
    const labels = labelsToPrint(state);
    if (!labels.length) {
      showEmpty(defaultEmpty);
      return;
    }
    let blob: Blob;
    try {
      const doc = generatePdf(labels, {
        logo: state.settings.logo ? { data: state.settings.logo } : null,
        showBorder: state.settings.showBorder,
      });
      blob = doc.output('blob');
    } catch (e) {
      showEmpty([
        h('p', { class: 'error' }, h('strong', {}, t.pdfFailed)),
        h('p', { class: 'muted' }, e instanceof Error ? e.message : String(e)),
      ]);
      return;
    }
    const previous = url;
    url = URL.createObjectURL(blob);
    // fit the page width in Chrome's viewer; ignored elsewhere
    iframe.src = `${url}#view=FitH`;
    iframe.hidden = false;
    empty.hidden = true;
    setEnabled(true);
    if (previous) setTimeout(() => URL.revokeObjectURL(previous), 10_000);
  }

  const scheduleUpdate = debounce(() => update(store.state), 250);

  for (const link of [openLink, downloadLink]) {
    link.addEventListener('click', (e) => {
      if (link.getAttribute('aria-disabled') === 'true') e.preventDefault();
    });
  }
  downloadLink.addEventListener('click', () => {
    downloadLink.download = `barcodes_${timestamp()}.pdf`;
  });

  showBorder.checked = store.state.settings.showBorder;
  showBorder.addEventListener('change', () => {
    store.update((s) => ({ ...s, settings: { ...s.settings, showBorder: showBorder.checked } }));
  });

  store.subscribe((state, previous) => {
    if (state.products !== previous.products || state.counts !== previous.counts
      || state.settings !== previous.settings) {
      scheduleUpdate();
    }
  });
  update(store.state);
}

const COLUMNS = 3;

/** Dropdown with a sheet map to choose the first free sticker of a sheet. */
export function setupStartPicker(store: Store): void {
  const container = byId('start-picker');
  const summaryText = h('span', {});
  const grid = h('div', { class: 'sheet-map', attrs: { role: 'group', 'aria-label': t.firstFreeSticker } });
  const details = h('details', { class: 'start-picker' },
    h('summary', { class: 'btn' }, icon(icons.grid), summaryText),
    h('div', { class: 'popover' },
      h('p', {}, h('strong', {}, t.partiallyUsedSheet)),
      h('p', { class: 'muted' }, t.partiallyUsedHint),
      grid));
  container.replaceChildren(details);

  const cells = Array.from({ length: LABELS_PER_PAGE }, (_, i) => {
    const position = i + 1;
    return h('button', {
      type: 'button',
      class: 'sheet-cell',
      title: t.startAtSticker(position, Math.floor(i / COLUMNS) + 1, (i % COLUMNS) + 1),
      on: {
        click: () => {
          store.update((s) => ({ ...s, settings: { ...s.settings, startPosition: position } }));
          details.open = false;
        },
      },
    }, String(position));
  });
  grid.replaceChildren(...cells);

  function render(start: number): void {
    summaryText.textContent = start === 1 ? t.newSheet : t.startAt(start);
    details.classList.toggle('active', start !== 1);
    cells.forEach((cell, i) => {
      cell.classList.toggle('used', i + 1 < start);
      cell.classList.toggle('start', i + 1 === start);
      cell.setAttribute('aria-pressed', String(i + 1 === start));
    });
  }

  // close when clicking outside
  document.addEventListener('click', (e) => {
    if (details.open && !details.contains(e.target as Node)) details.open = false;
  });

  store.subscribe((state, previous) => {
    if (state.settings.startPosition !== previous.settings.startPosition) {
      render(state.settings.startPosition);
    }
  });
  render(store.state.settings.startPosition);
}
