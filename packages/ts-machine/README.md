# ts-machine ![size info](https://deno.bundlejs.com/?q=ts-machine&badge=detailed)

A simple state machine with _good enough_ build time typechecking support.

```sh
npm i ts-machine
```

## Example

Here is a simple stoplight example:

```ts
const lightMachine = defineMachine<null>()
  .states(["green", "yellow", "red"])
  .transitions({
    green: ["yellow"],
    yellow: ["red"],
    red: ["green"],
  })
  .events(["SWITCH"])
  .on("SWITCH", ["green"], () => "yellow")
  .on("SWITCH", ["yellow"], ({}) => "red")
  .on("SWITCH", ["red"], () => "green");

const light = lightMachine.create("red", null);

assert.equal(light.state, "red");
light.emit("SWITCH");
await waitForState(light, "green");
light.emit("SWITCH");
await waitForState(light, "yellow");
light.emit("SWITCH");
await waitForState(light, "red");
```

More examples can be found in the tests directory:

- fetcher - [tests/fetcher.test.ts](./tests/fetcher.test.ts)
- router - [tests/router.test.ts](./tests/router.test.ts)
- stoplight - [tests/stoplight.test.ts](./tests/stoplight.test.ts)

## Helpers

### waitForState

```ts
import { type Machine } from "ts-machine";

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
```
