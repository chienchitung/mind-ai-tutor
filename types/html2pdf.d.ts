declare module 'html2pdf.js' {
  function html2pdf(): {
    from: (element: HTMLElement) => {
      set: (options: any) => {
        save: () => Promise<void>;
      };
    };
  };
  
  export = html2pdf;
} 