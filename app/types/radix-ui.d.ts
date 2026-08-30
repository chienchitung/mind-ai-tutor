declare module 'class-variance-authority' {
  export type VariantProps<T extends (...args: any) => any> = {
    [K in keyof Parameters<T>[0]]: K extends 'class' | 'className' ? string : Parameters<T>[0][K];
  };

  export function cva(base: string, config?: any): (props?: any) => string;
}
