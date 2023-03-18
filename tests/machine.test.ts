import * as assert from "node:assert";
import { it } from "node:test";

import { defineMachine } from "../src/index.js";
import { tick } from "./helpers.js";

it("throws if invalid event", () => {
  const definition = defineMachine<null>()
    .states(["init"])
    .transitions({
      init: [],
    })
    .events(["EVENT"]);

  const machine = definition.create("init", null);
  assert.throws(() => {
    machine.emit("INVALID" as any);
  }, /Invalid event 'INVALID'/);
});

it("throws if no callback is registered for event", () => {
  const definition = defineMachine<null>()
    .states(["init"])
    .transitions({
      init: [],
    })
    .events(["EVENT"]);

  const machine = definition.create("init", null);
  assert.throws(() => {
    machine.emit("EVENT");
  }, /No callbacks defined for event 'EVENT'/);
});

it("throws if no callback is registered for event in current state", () => {
  const definition = defineMachine<null>()
    .states(["init"])
    .transitions({
      init: [],
    })
    .events(["EVENT"])
    .on("EVENT", [], () => {});

  const machine = definition.create("init", null);
  assert.throws(() => {
    machine.emit("EVENT");
  }, /No callback defined for event 'EVENT' and state 'init'/);
});

it("surfaces errors for sync event callbacks", () => {
  const definition = defineMachine<null>()
    .states(["init"])
    .transitions({
      init: [],
    })
    .events(["EVENT"])
    .on("EVENT", ["init"], () => {
      throw new Error("sync error");
    });

  const machine = definition.create("init", null);
  assert.throws(() => {
    machine.emit("EVENT");
  }, /sync error/);
});

it("surfaces errors for async event callbacks", async () => {
  const definition = defineMachine<null>()
    .states(["init"])
    .transitions({
      init: [],
    })
    .events(["EVENT"])
    .on("EVENT", ["init"], async () => {
      await tick();
      throw new Error("sync error");
    });

  const machine = definition.create("init", null);
  const reason = await Promise.resolve(machine.emit("EVENT")).catch(
    (reason) => reason
  );
  assert.match(reason?.message, /sync error/);
});
