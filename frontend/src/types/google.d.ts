declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              type?: 'standard' | 'icon';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              width?: number;
            }
          ) => void;
          prompt: (listener?: (notification: PromptMomentNotification) => void) => void;
        };
      };
    };
  }

  interface PromptMomentNotification {
    isNotDisplayed?: () => boolean;
    isSkippedMoment?: () => boolean;
    isDismissedMoment?: () => boolean;
  }
}

export {};
