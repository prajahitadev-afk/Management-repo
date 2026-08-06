declare module "react-dom/client" {
  export function createRoot(container: Element | DocumentFragment): {
    render(children: React.ReactNode): void;
  };
}

declare module "react-dom" {
  export function createPortal(children: React.ReactNode, container: Element | DocumentFragment): React.ReactNode;
}
