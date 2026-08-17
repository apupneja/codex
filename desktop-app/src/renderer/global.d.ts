import type { DesktopBridge } from "../shared/bridge";

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<Electron.WebviewTag>,
        Electron.WebviewTag
      > & {
        partition?: string;
        src?: string;
      };
    }
  }

  interface Window {
    chatgptDesktop: DesktopBridge;
  }
}

export {};
