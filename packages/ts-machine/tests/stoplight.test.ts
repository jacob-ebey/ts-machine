import * as assert from "node:assert";
import { it } from "node:test";

import { defineMachine } from "../src/index.js";

import { waitForState } from "./helpers.js";

it("can implement a stoplight", async () => {
  const lightMachine = defineMachine<null>()
    .states(["green", "yellow", "red"])
    .transitions({
      green: ["yellow"],
      yellow: ["red"],
      red: ["green"],
    })
    .events(["SWITCH"])
    .on("SWITCH", ["green"], () => "yellow")
    .on("SWITCH", ["yellow"], () => "red")
    .on("SWITCH", ["red"], () => "green");

  const light = lightMachine.create("red", null);
  assert.equal(light.state, "red");
  light.emit("SWITCH");
  await waitForState(light, "green");
  light.emit("SWITCH");
  await waitForState(light, "yellow");
  light.emit("SWITCH");
  await waitForState(light, "red");
});
