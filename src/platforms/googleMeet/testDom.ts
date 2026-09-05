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

  contains(element: TestElement): boolean {
    return element === this || this.descendants().includes(element);
  }

  private descendants(): TestElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
}

function matches(element: TestElement, selector: string): boolean {
  return selector.split(',').some((part) => {
    const value = part.trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      const expression = value.slice(1, -1);
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
    return element.tagName.toLowerCase() === value.toLowerCase();
  });
}

export const asElement = (element: TestElement): Element => element as unknown as Element;
export const asRoot = (element: TestElement): ParentNode => element as unknown as ParentNode;
