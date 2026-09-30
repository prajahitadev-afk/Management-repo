const DEVTOOLS_MESSAGE = "Developer tools are disabled on this system.";

function showDevtoolsMessage() {
  if (typeof window === "undefined") return;
  if (window.__devtoolsDetected) return;
  window.__devtoolsDetected = true;

  try {
    window.alert(DEVTOOLS_MESSAGE);
  } catch {
    // Ignore alert failures so the app remains usable.
  }
}

export function attachDevtoolsDeterrence() {
  if (typeof window === "undefined") return;

  const handleKeydown = (event: KeyboardEvent) => {
    const isF12 = event.key === "F12";
    const isInspectShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && ["I", "J", "C"].includes(event.key.toUpperCase());
    const isToggleViewSource = event.key === "u" && (event.ctrlKey || event.metaKey) && !event.altKey;

    if (isF12 || isInspectShortcut || isToggleViewSource) {
      event.preventDefault();
      event.stopPropagation();
      showDevtoolsMessage();
    }
  };

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    showDevtoolsMessage();
  };

  window.addEventListener("keydown", handleKeydown, true);
  window.addEventListener("contextmenu", handleContextMenu, true);

  return () => {
    window.removeEventListener("keydown", handleKeydown, true);
    window.removeEventListener("contextmenu", handleContextMenu, true);
  };
}

declare global {
  interface Window {
    __devtoolsDetected?: boolean;
  }
}
