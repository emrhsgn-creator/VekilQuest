export function sayfaMetni(
  sayfa: {
    getTextContent: () => Promise<{ items: unknown[] }>;
    getViewport: (o: { scale: number }) => { height: number };
  },
  secenekler?: { kenarlariAt?: boolean },
): Promise<string>;
