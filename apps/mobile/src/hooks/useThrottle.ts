import { useEffect, useState } from "react";

function useThrottle<T>(value: T, delay: number = 500) {
  const [throttledValue, setThrottledValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setThrottledValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return throttledValue;
}

export default useThrottle;
