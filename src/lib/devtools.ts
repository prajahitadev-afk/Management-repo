export function attachDevtoolsDeterrence() {
  // Devtools deterrence disabled to allow browser inspection and developer tools
  return () => {};
}

declare global {
  interface Window {
    __devtoolsDetected?: boolean;
  }
}
