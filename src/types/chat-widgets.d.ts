export {};

declare global {
  interface Window {
    Tawk_API?: {
      visitor?: {
        name?: string;
        email?: string;
        hash?: string;
      };
      maximize?: () => void;
      minimize?: () => void;
      hideWidget?: () => void;
      showWidget?: () => void;
      onLoad?: () => void;
      onChatEnded?: () => void;
      onChatHidden?: () => void;
      setAttributes?: (
        attributes: {
          name?: string;
          email?: string;
          hash?: string;
        },
        callback?: (error?: unknown) => void
      ) => void;
    };

    Tawk_LoadStart?: Date;

    botpress?: {
      on?: (event: string, callback: (payload: any) => void) => void;
      open?: () => void;
      close?: () => void;
      toggle?: () => void;
      config?: (args: {
        configuration: {
          additionalStylesheet?: string
        }
      }) => void
    };
  }
}