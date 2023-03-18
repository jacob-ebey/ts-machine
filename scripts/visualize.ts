import * as fs from "node:fs";

import ts from "typescript";

import { defineMachine } from "../src/index.js";

const source = fs.readFileSync(process.argv[2], "utf8");

let parseMachineDefinition = defineMachine<{
  currentOn?: {
    name?: string;
    states?: Set<string>;
  };
  machine?: {
    events?: Set<string>;
    states?: Set<string>;
    transitions?: Record<string, Set<string>>;
    on?: {
      name: string;
      states: Set<string>;
    }[];
  };
}>()
  .states([
    "idle",
    "defineMachine",
    "states",
    "transitions",
    "events",
    "on.event",
    "on.states",
  ])
  .transitions({
    idle: ["defineMachine"],
    defineMachine: ["idle", "states", "transitions", "events", "on.event"],
    states: ["defineMachine"],
    transitions: ["defineMachine"],
    events: ["defineMachine"],
    "on.event": ["defineMachine", "on.states"],
    "on.states": ["defineMachine"],
  })
  .events(["STEP"])
  .on<ts.Node>("STEP", ["idle"], ({ eventData, transition }) => {
    const node = eventData as ts.Node;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "defineMachine"
    ) {
      transition("defineMachine");
    }
  })
  .on<ts.Node>("STEP", ["defineMachine"], ({ data, eventData, transition }) => {
    const node = eventData;
    if (!node) {
      return;
    }

    data.machine = data.machine ?? {};
    if (!ts.isIdentifier(node)) {
      return;
    }

    switch (node.text) {
      case "states":
        transition("states");
        break;
      case "transitions":
        transition("transitions");
        break;
      case "events":
        transition("events");
        break;
      case "on":
        transition("on.event");
        break;
    }
  })
  .on<ts.Node>("STEP", ["events"], ({ data, eventData, transition }) => {
    const node = eventData;
    if (!node || !ts.isArrayLiteralExpression(node)) {
      transition("defineMachine");
      return;
    }

    data.machine!.events = node.elements.reduce((acc, element) => {
      if (ts.isStringLiteral(element)) {
        acc.add(element.text);
      }
      return acc;
    }, new Set<string>());
    transition("defineMachine");
  })
  .on<ts.Node>("STEP", ["states"], ({ data, eventData, transition }) => {
    const node = eventData;
    if (!node || !ts.isArrayLiteralExpression(node)) {
      transition("defineMachine");
      return;
    }

    data.machine!.states = node.elements.reduce((acc, element) => {
      if (ts.isStringLiteral(element)) {
        acc.add(element.text);
      }
      return acc;
    }, new Set<string>());
    transition("defineMachine");
  })
  .on<ts.Node>("STEP", ["transitions"], ({ data, eventData, transition }) => {
    const node = eventData;
    if (!node || !ts.isObjectLiteralExpression(node)) {
      transition("defineMachine");
      return;
    }

    const transitions: Record<string, Set<string>> = {};
    for (const prop of node.properties) {
      if (
        !ts.isPropertyAssignment(prop) ||
        !prop.name ||
        !ts.isArrayLiteralExpression(prop.initializer)
      ) {
        continue;
      }

      let name: string;
      if (ts.isIdentifier(prop.name)) {
        name = prop.name.text;
      } else if (ts.isStringLiteral(prop.name)) {
        name = prop.name.text;
      } else {
        continue;
      }

      const transitionTo = new Set<string>();
      for (const element of prop.initializer.elements) {
        if (!ts.isStringLiteral(element)) {
          continue;
        }

        transitionTo.add(element.text);
      }
      transitions[prop.name.text] = transitionTo;
    }

    data.machine!.transitions = transitions;
    transition("defineMachine");
  })
  .on<ts.Node>("STEP", ["on.event"], ({ data, eventData, transition }) => {
    const node = eventData;

    if (!node || !ts.isStringLiteral(node)) {
      transition("defineMachine");
      return;
    }

    data.currentOn = {
      name: node.text,
    };
    transition("on.states");
  })
  .on<ts.Node>("STEP", ["on.states"], ({ data, eventData, transition }) => {
    const node = eventData;
    if (!node || !ts.isArrayLiteralExpression(node)) {
      data.currentOn = undefined;
      transition("defineMachine");
      return;
    }

    data.currentOn!.states = node.elements.reduce((acc, element) => {
      if (ts.isStringLiteral(element)) {
        acc.add(element.text);
      }
      return acc;
    }, new Set<string>());
    data.machine!.on = data.machine!.on ?? [];
    data.machine!.on.push(data.currentOn as any);
    data.currentOn = undefined;

    transition("defineMachine");
  });

const parser = parseMachineDefinition.create("idle", {});

ts.transpileModule(source, {
  fileName: process.argv[2],
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    checkJs: false,
  },
  transformers: {
    before: [
      (context) => {
        return (sourceFile) => {
          const visitor = (node: ts.Node): ts.Node => {
            parser.emit("STEP", node);

            if (parser.state === "idle") {
              return ts.visitEachChild(node, visitor, context);
            }

            return node;
          };
          return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
        };
      },
    ],
  },
});

console.log(parser.state, parser.data.machine);

if (!parser.data.machine) {
  throw new Error("Could not parse machine definition");
}

const { machine } = parser.data;
const { events, on, states, transitions } = machine;

if (!events) {
  throw new Error("Missing events");
}

if (!states) {
  throw new Error("Missing states");
}

if (!transitions) {
  throw new Error("Missing transitions");
}

if (!on) {
  throw new Error("Missing on");
}

let mermaid = "flowchart LR\n";

for (const state of states) {
  mermaid += `  ${state}\n`;
}

for (const [fromState, toStates] of Object.entries(transitions)) {
  for (const toState of toStates) {
    mermaid += `  ${fromState} --> ${toState}\n`;
  }
}

console.log("MERMAID:\n");
console.log(mermaid);
