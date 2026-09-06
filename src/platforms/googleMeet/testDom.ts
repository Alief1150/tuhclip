export class TestElement {
  parentElement: TestElement | null = null;
  children: TestElement[] = [];

  constructor(
    readonly tagName: string,
    readonly attributes: Record<string, string> = {},
    public textContent = '',
  ) {}

  append(...children: TestElement[]): this {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
    return this;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  hasAttribute(name: string): boolean {
    return name in this.attributes;
  }

  matches(selector: string): boolean {
    return matches(this, selector);
  }

  querySelector(selector: string): TestElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): TestElement[] {
    return this.descendants().filter((element) => matches(element, selector));
  }

  closest(selector: string): TestElement | null {
    for (let current: TestElement | null = this; current; current = current.parentElement) {
      if (matches(current, selector)) return current;
    }
    return null;
  }

  contains(element: TestElement): boolean {
    return element === this || this.descendants().includes(element);
  }

  private descendants(): TestElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
}

function matches(element: TestElement, selector: string): boolean {
  return selector.split(',').some((part) => matchesCompound(element, part.trim()));
}

function matchesCompound(element: TestElement, selector: string): boolean {
  const match = /^(?:([a-zA-Z][a-zA-Z0-9]*)?)((?:\.[a-zA-Z0-9_-]+)*)(\[.*\])?$/.exec(selector);
  if (!match) return false;
  const [, tag, classes, attribute] = match;
  if (tag && element.tagName.toLowerCase() !== tag.toLowerCase()) return false;
  if (classes) {
    const elementClasses = (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
    for (const className of classes.split('.').filter(Boolean)) {
      if (!elementClasses.includes(className)) return false;
    }
  }
  if (!attribute) return !tag && !classes ? false : true;
  const expression = attribute.slice(1, -1);
  const operator = expression.includes('*=') ? '*=' : expression.includes('~=') ? '~=' : expression.includes('=') ? '=' : null;
  const [name, rawExpected] = operator ? expression.split(operator) : [expression, ''];
  const expected = rawExpected.replace(/^["']|["']$/g, '');
  const actual = element.getAttribute(name);
  if (actual === null) return false;
  if (!operator) return true;
  if (operator === '=') return actual === expected;
  if (operator === '*=') return actual.includes(expected);
  return actual.split(/\s+/).includes(expected);
}

export const asElement = (element: TestElement): Element => element as unknown as Element;
export const asRoot = (element: TestElement): ParentNode => element as unknown as ParentNode;
