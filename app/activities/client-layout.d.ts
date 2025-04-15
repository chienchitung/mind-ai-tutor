import { ReactNode } from 'react';

export type ClientLayoutProps = {
  children: ReactNode;
};

declare const ClientLayout: (props: ClientLayoutProps) => JSX.Element;
export default ClientLayout; 