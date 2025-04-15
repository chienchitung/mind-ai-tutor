declare module '@radix-ui/react-dialog' {
  import * as React from 'react';

  // Basic Radix UI Dialog components
  const Root: React.FC<{ children?: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }>;
  const Trigger: React.FC<{ children?: React.ReactNode; asChild?: boolean }>;
  const Portal: React.FC<{ children?: React.ReactNode; container?: HTMLElement }>;
  const Overlay: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
  const Content: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
  const Close: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLButtonElement> & { asChild?: boolean } & React.RefAttributes<HTMLButtonElement>>;
  const Title: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLHeadingElement> & React.RefAttributes<HTMLHeadingElement>>;
  const Description: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLParagraphElement> & React.RefAttributes<HTMLParagraphElement>>;

  export { Root, Trigger, Portal, Overlay, Content, Close, Title, Description };
}

declare module 'class-variance-authority' {
  export type VariantProps<T extends (...args: any) => any> = {
    [K in keyof Parameters<T>[0]]: K extends 'class' | 'className' ? string : Parameters<T>[0][K];
  };

  export function cva(base: string, config?: any): (props?: any) => string;
} 