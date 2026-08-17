import type { ReactNode } from "react";

import { ProductModeProvider } from "../state/product-mode";
import { SessionProvider } from "../state/session";

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ProductModeProvider>
      <SessionProvider>{children}</SessionProvider>
    </ProductModeProvider>
  );
}
