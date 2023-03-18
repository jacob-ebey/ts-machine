import * as assert from "node:assert";
import { it } from "node:test";

import { defineMachine } from "../src/index.js";

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
