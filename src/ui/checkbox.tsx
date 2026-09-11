import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { CheckIcon } from 'lucide-react';
import type React from 'react';
import { cn } from './utils';

export function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props): React.ReactElement {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded border border-input bg-background shadow-xs/5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-checked:border-primary data-checked:bg-primary data-disabled:pointer-events-none data-disabled:opacity-64 [&_svg]:size-3.5 [&_svg]:text-primary-foreground',
        className,
      )}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center"
        data-slot="checkbox-indicator"
      >
        <CheckIcon aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { CheckboxPrimitive };
