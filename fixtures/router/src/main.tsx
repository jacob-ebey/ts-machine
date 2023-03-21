import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { createTrie } from "router-trie";

import {
  type RouteConfig,
  type RouteComponentProps,
  Router,
} from "./machines/router";

const node = createTrie([
  {
    id: "root",
    path: "/",
    loader: () =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve("The loaded data :D");
        }, 500);
      }),
    Component({ data, outlet }: RouteComponentProps<string>) {
      return (
        <div>
          <h1>ts-machine-router</h1>
          <p>
            <a href="/">Home</a> | <a href="/about">About</a>
          </p>
          <p>{data}</p>
          <hr />
          {outlet}
        </div>
      );
    },
    Fallback({ outlet }) {
      return (
        <div>
          <h1>ts-machine-router</h1>
          <p>
            <a href="/">Home</a> | <a href="/about">About</a>
          </p>
          <p>Loading...</p>
          <hr />
          {outlet}
        </div>
      );
    },
  },
] satisfies RouteConfig[]);

const router = Router.create("idle", { node });

router.subscribe(() => {
  render(<App />, document.getElementById("app")!);
});
router.emit("NAVIGATE", { pathname: location.pathname });

function App() {
  const routerState = router.state;
  console.log(routerState);

  const routerData = router.data;
  const { loaderData, matches, pendingMatches } = routerData;

  let lastElement = null;
  if (pendingMatches) {
    for (let i = pendingMatches.length - 1; i >= 0; i--) {
      const match = pendingMatches[i];
      const Component = match.Fallback;
      if (Component) {
        lastElement = (
          <Component data={undefined as never} outlet={lastElement} />
        );
      }
    }
  } else if (matches && loaderData) {
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const Component = match.Component;
      if (Component) {
        lastElement = (
          <Component
            data={loaderData[match.id] as never}
            outlet={lastElement}
          />
        );
      }
    }
  }
  return lastElement;
}
