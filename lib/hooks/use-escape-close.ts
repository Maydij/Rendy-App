import { useEffect } from 'react';

/**
 * @name useEscapeClose
 * @description [UX Utility]: Registers a global keydown listener that invokes
 * the provided `onClose` callback when the user presses the Escape key.
 * Automatically cleans up the listener on unmount to prevent memory leaks.
 *
 * @param onClose - Callback executed when Escape is pressed.
 * @param enabled - Optional guard to conditionally activate the listener
 *                  (e.g., only when a modal is open).
 */
export function useEscapeClose(onClose: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, enabled]);
}
