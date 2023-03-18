import { type Machine } from "../src/index.js";

export function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function waitForState<M extends Machine<any, any>>(
  machine: M,
  state: M["state"] | M["state"][],
  next: boolean = true
) {
  return new Promise<void>((resolve) => {
    if (machine.state === state) {
      resolve();
      return;
    }
    const unsubscribe = machine.subscribe((machine) => {
      if (machine.state === state) {
        unsubscribe();
        resolve();
        return;
      }

      if (next) {
        unsubscribe();
        throw new Error(
          `Expected state ${
            typeof state === "string" ? state : (state as string[]).join(",")
          } but got ${machine.state}`
        );
      }
    });
  });
}
