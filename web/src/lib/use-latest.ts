import { useLayoutEffect, useRef } from "react";

// holds the latest value for handlers that must not resubscribe each render
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
