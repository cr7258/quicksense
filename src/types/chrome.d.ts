declare namespace chrome.sidePanel {
  export function open(options: { windowId: number }): Promise<void>;
  export function close(options: { windowId: number }): Promise<void>;
  export function getPosition(options: { windowId: number }): Promise<{ type: string }>;
}
