import { useSyncExternalStore } from 'react';

const noopUnsubscribe = () => {};
const noopSubscribe = () => {
  return noopUnsubscribe;
};

export function useIsMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      return true;
    },
    () => {
      return false;
    },
  );
}
