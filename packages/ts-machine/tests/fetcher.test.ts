import * as assert from "node:assert";
import { describe, it } from "node:test";

import { defineMachine } from "../src/index.js";

import { tick, waitForState } from "./helpers.js";

interface FetcherMachineData {
  fetch: () => unknown;
  previousResult?: unknown;
  result?: unknown;
  error?: unknown;
}

describe("can implement a fetcher with refetch", async () => {
  const fetchMachine = defineMachine<FetcherMachineData>()
    .states(["idle", "loading", "success", "failure"])
    .transitions({
      idle: ["loading"],
      loading: ["success", "failure"],
      failure: ["loading"],
      success: ["loading"],
    })
    .events(["FETCH"])
    .on("FETCH", ["idle", "success", "failure"], ({ data, transition }) => {
      transition("loading");
      tick()
        .then(data.fetch)
        .then((result) => {
          data.previousResult = data.result ?? data.previousResult;
          data.result = result;
          data.error = undefined;
          transition("success");
        })
        .catch((error) => {
          data.error = error;
          data.previousResult = data.result ?? data.previousResult;
          data.result = undefined;
          transition("failure");
        });
    });

  it("can run to completion", async () => {
    const fetcher = fetchMachine.create("idle", {
      fetch() {
        return Promise.resolve("success");
      },
    });
    assert.equal(fetcher.state, "idle");
    fetcher.emit("FETCH");
    await waitForState(fetcher, "loading");
    await waitForState(fetcher, "success");
    assert.equal(fetcher.data.result, "success");
    assert.equal(fetcher.data.error, undefined);
  });

  it("can refetch", async () => {
    const error = new Error("failure");
    let attempt = 0;
    const fetcher = fetchMachine.create("idle", {
      fetch() {
        if (!(++attempt % 2 === 0)) {
          return Promise.reject(error);
        }
        return Promise.resolve("success " + attempt);
      },
    });
    assert.equal(fetcher.state, "idle");
    fetcher.emit("FETCH");
    await waitForState(fetcher, "loading");
    await waitForState(fetcher, "failure");
    assert.equal(fetcher.data.error, error);
    assert.equal(fetcher.data.result, undefined);
    assert.equal(fetcher.data.previousResult, undefined);
    assert.equal(attempt, 1);

    fetcher.emit("FETCH");
    await waitForState(fetcher, "loading");
    await waitForState(fetcher, "success");
    assert.equal(fetcher.data.result, "success 2");
    assert.equal(fetcher.data.previousResult, undefined);
    assert.equal(fetcher.data.error, undefined);
    assert.equal(attempt, 2);

    fetcher.emit("FETCH");
    await waitForState(fetcher, "loading");
    await waitForState(fetcher, "failure");
    assert.equal(fetcher.data.error, error);
    assert.equal(fetcher.data.result, undefined);
    assert.equal(fetcher.data.previousResult, "success 2");
    assert.equal(attempt, 3);

    fetcher.emit("FETCH");
    await waitForState(fetcher, "loading");
    await waitForState(fetcher, "success");
    assert.equal(fetcher.data.result, "success 4");
    assert.equal(fetcher.data.previousResult, "success 2");
    assert.equal(fetcher.data.error, undefined);
    assert.equal(attempt, 4);
  });

  it("does not allow refetching while loading", async () => {
    let attempt = 0;
    const fetcher = fetchMachine.create("idle", {
      fetch() {
        return Promise.resolve("success " + ++attempt);
      },
    });
    assert.equal(fetcher.state, "idle");
    fetcher.emit("FETCH");
    assert.throws(() => fetcher.emit("FETCH"), /No 'FETCH' 'loading' cb/);
    await waitForState(fetcher, "loading");
    await waitForState(fetcher, "success");
    assert.equal(fetcher.data.result, "success 1");
    assert.equal(fetcher.data.error, undefined);
    assert.equal(attempt, 1);
  });
});
