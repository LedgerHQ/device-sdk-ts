import { type Observable, type Subscription } from "rxjs";

export const executeUntilStep = async <T>(
  targetStep: number,
  o: Observable<T>,
): Promise<{ steps: T[]; error?: Error }> =>
  await new Promise((resolve, reject) => {
    const steps: T[] = [];
    let index = 0;
    let subscription: Subscription | undefined = undefined;

    subscription = o.subscribe({
      next: (state) => {
        steps.push(state);
        index++;

        if (index > targetStep) {
          subscription?.unsubscribe();
          resolve({ steps });
        }
      },
      error: (error) => {
        reject({ steps, error: error as Error });
      },
      complete: () => {
        resolve({ steps });
      },
    });
  });
