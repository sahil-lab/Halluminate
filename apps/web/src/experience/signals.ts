type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribes to real, successfully verified round trips. Returns an unsubscribe function. */
export function onVerified(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function announceVerified(): void {
  for (const listener of listeners) listener();
}
