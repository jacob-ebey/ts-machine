import { type ComponentChild, type ComponentType } from "preact";
import {
  type Node as RouterNode,
  type RouteConfig as RouterRouteConfig,
  matchTrie,
} from "router-trie";
import { defineMachine } from "../../../../packages/ts-machine/src/index.js";

export interface RouteComponentProps<Data = never> {
  data: Data;
  outlet?: ComponentChild;
}

export type RouteConfig = Omit<RouterRouteConfig, "children"> & {
  children?: RouteConfig[];
  Component?: ComponentType<RouteComponentProps>;
  Fallback?: ComponentType<RouteComponentProps>;
  loader?: () => unknown;
};

interface RouterMachineData {
  controller?: AbortController;
  node: RouterNode<RouteConfig>;
  matches?: Omit<RouteConfig, "children">[];
  pendingMatches?: Omit<RouteConfig, "children">[];
  loaderData?: Record<string, unknown>;
}

export const Router = defineMachine<RouterMachineData>()
  .states(["idle", "loading", "submitting"])
  .events(["NAVIGATE", "SUBMIT"])
  .transitions({
    idle: ["loading", "submitting"],
    loading: ["idle", "loading", "submitting"],
    submitting: ["loading", "submitting"],
  })
  .on<{ pathname: string }>(
    "NAVIGATE",
    ["idle", "loading", "submitting"],
    ({ eventData, data, transition }) => {
      if (!eventData) return;
      const signal = newAbortSignal(data);
      const matches = matchTrie(data.node, eventData.pathname);
      data.pendingMatches = matches?.length ? matches : undefined;
      transition("loading");

      tick()
        .then(() => {
          throwIfNavigationInterrupted(signal);
          if (!matches || !matches.length) {
            data.matches = undefined;
            data.pendingMatches = undefined;
            transition("idle");
            return;
          }

          return Promise.all(
            matches.map(async (match) => {
              if (match.loader && typeof match.loader === "function") {
                const data = await match.loader();
                return [match.id, data] as const;
              }
            })
          ).then((dataResults) => {
            throwIfNavigationInterrupted(signal);
            data.loaderData = Object.fromEntries(
              dataResults.filter(Boolean) as [string, never][]
            );
            data.matches = matches;
            data.pendingMatches = undefined;
            transition("idle");
          });
        })
        .catch((reason) => {
          if (signal.aborted) {
            return;
          }
          data.pendingMatches = undefined;
          transition("idle");
          throw reason;
        });
    }
  )
  .on("SUBMIT", [], () => {});

function newAbortSignal(data: RouterMachineData) {
  if (data.controller) {
    data.controller.abort();
  }
  const controller = new AbortController();
  data.controller = controller;
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

async function tick() {
  return await new Promise((resolve) => setTimeout(resolve, 0));
}
