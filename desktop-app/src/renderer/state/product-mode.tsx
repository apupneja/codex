import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ProductMode = "codex" | "work";
export type ChatGptMode = "chat" | "work";

type ProductModeValue = {
  chatGptMode: ChatGptMode;
  mode: ProductMode;
  setChatGptMode(mode: ChatGptMode): void;
  setMode(mode: ProductMode): void;
  setTemporaryChat(enabled: boolean): void;
  temporaryChat: boolean;
};

const ProductModeContext = createContext<ProductModeValue | null>(null);

export function ProductModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ProductMode>(() => {
    const stored = localStorage.getItem("chatgpt.product-mode");
    return stored === "work" ? "work" : "codex";
  });
  const [chatGptMode, setChatGptModeState] = useState<ChatGptMode>("chat");
  const [temporaryChat, setTemporaryChatState] = useState(false);
  const value = useMemo(
    () => ({
      chatGptMode,
      mode,
      setChatGptMode: (next: ChatGptMode) => {
        setChatGptModeState(next);
        if (next === "work") setTemporaryChatState(false);
      },
      setMode: (next: ProductMode) => {
        localStorage.setItem("chatgpt.product-mode", next);
        setModeState(next);
      },
      setTemporaryChat: setTemporaryChatState,
      temporaryChat,
    }),
    [chatGptMode, mode, temporaryChat],
  );
  return (
    <ProductModeContext.Provider value={value}>
      {children}
    </ProductModeContext.Provider>
  );
}

export function useProductMode(): ProductModeValue {
  const value = useContext(ProductModeContext);
  if (!value) {
    throw new Error("useProductMode must be used inside ProductModeProvider");
  }
  return value;
}
