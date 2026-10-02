export interface PluginListenerHandle { remove(): Promise<void> }
export declare const App: {
  addListener(event: 'backButton', fn: (e: { canGoBack: boolean }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'pause' | 'resume', fn: () => void): Promise<PluginListenerHandle>;
  minimizeApp(): Promise<void>;
  exitApp(): Promise<void>;
};
