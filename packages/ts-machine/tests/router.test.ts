import * as assert from "node:assert";
import { describe, it } from "node:test";

import { defineMachine } from "../src/index.js";

import { tick, waitForState } from "./helpers.js";

describe("can implement a router", () => {
  const routerMachine = defineMachine<RouterMachineData>()
    .states(["idle", "loading", "submitting"])
    .transitions({
      idle: ["loading", "submitting"],
      loading: ["idle", "submitting"],
      submitting: ["loading"],
    })
    .events(["NAVIGATE", "SUBMIT"])
    .on(
      "NAVIGATE",
      ["idle", "loading", "submitting"],
      ({ data, transition }) => {
        const signal = newAbortSignal(data);
        transition("loading");
        tick()
          .then(() => {
            throwIfNavigationInterrupted(signal);
            transition("idle");
          })
          .catch(onError.bind(data));
      }
    )
    .on("SUBMIT", ["idle", "loading", "submitting"], ({ data, transition }) => {
      const signal = newAbortSignal(data);
      transition("submitting");

      tick()
        .then(() => {
          throwIfNavigationInterrupted(signal);
          transition("loading");
          return tick().then(() => {
            throwIfNavigationInterrupted(signal);
            transition("idle");
          });
        })
        .catch(onError.bind(data));
    });

  it("can navigate", async () => {
    const errors: unknown[] = [];
    const router = routerMachine.create("idle", {
      onError(reason) {
        errors.push(reason);
      },
    });
    assert.equal(router.state, "idle");

    router.emit("NAVIGATE");
    await waitForState(router, "loading");
    await waitForState(router, "idle");
    assert.equal(errors.length, 0);
  });

  it("can submit", async () => {
    const errors: unknown[] = [];
    const router = routerMachine.create("idle", {
      onError(reason) {
        errors.push(reason);
      },
    });

    router.emit("SUBMIT");
    await waitForState(router, "submitting");
    await waitForState(router, "loading");
    await waitForState(router, "idle");
    assert.equal(errors.length, 0);
  });

  it("can interrupt navigate with submit", async () => {
    const errors: unknown[] = [];
    const router = routerMachine.create("idle", {
      onError(reason) {
        errors.push(reason);
      },
    });

    router.emit("NAVIGATE");
    await waitForState(router, "loading");
    router.emit("SUBMIT");
    await waitForState(router, "submitting");
    await tick();
    assert.equal(errors.length, 1);
    assert.equal(errors[0] instanceof NavigationInterruptedError, true);
    await waitForState(router, "loading");
    await waitForState(router, "idle");
    assert.equal(errors.length, 1);
  });

  it("can interrupt submit with navigation", async () => {
    const errors: unknown[] = [];
    const router = routerMachine.create("idle", {
      onError(reason) {
        errors.push(reason);
      },
    });

    router.emit("SUBMIT");
    await waitForState(router, "submitting");
    router.emit("NAVIGATE");
    await waitForState(router, "loading");
    await tick();
    assert.equal(errors.length, 1);
    assert.equal(errors[0] instanceof NavigationInterruptedError, true);
    await waitForState(router, "idle");
  });
});

interface RouterMachineData {
  navigationController?: AbortController;
  onError?(reason: unknown): void;
}

function newAbortSignal(data: RouterMachineData) {
  if (data.navigationController) {
    data.navigationController.abort();
  }
  const controller = new AbortController();
  data.navigationController = controller;
  return controller.signal;
}

class NavigationInterruptedError extends Error {
  constructor() {
    super("Navigation interrupted");
  }
}

function throwIfNavigationInterrupted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new NavigationInterruptedError();
  }
}

function onError(this: RouterMachineData, reason: unknown) {
  if (this.onError) {
    this.onError(reason);
    return;
  }
  console.error(reason);
}
