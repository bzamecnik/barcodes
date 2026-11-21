// Tiny helpers for building DOM without a framework.

type Child = Node | string | number | null | undefined | false;

type Props<K extends keyof HTMLElementTagNameMap> =
  Partial<Omit<HTMLElementTagNameMap[K], 'style' | 'dataset'>> & {
    class?: string;
    dataset?: Record<string, string>;
    attrs?: Record<string, string>;
    on?: { [E in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[E]) => void };
  };

/** Create an element with properties, event listeners and children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props<K> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const { class: className, dataset, attrs, on, ...rest } = props;
  if (className) el.className = className;
  if (dataset) Object.assign(el.dataset, dataset);
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (on) {
    for (const [type, listener] of Object.entries(on)) {
      el.addEventListener(type, listener as EventListener);
    }
  }
  Object.assign(el, rest);
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
}

/** Element by id, failing loudly if the page structure doesn't match the code. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

/** Inline SVG icon from a trusted static string (see icons.ts). */
export function icon(svg: string): SVGElement {
  const template = document.createElement('template');
  template.innerHTML = svg.trim();
  const el = template.content.firstElementChild as SVGElement;
  el.setAttribute('aria-hidden', 'true');
  el.classList.add('icon');
  return el;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
