export type { Machine } from "./types.js";

import type {
  Machine,
  MachineDefinition,
  MachineEventHandler,
} from "./types.js";

export function defineMachine<Data = never>(): MachineDefinition<Data> {
  let _events: Set<string>;
  let _states: Set<string>;
  let _transitions: Record<string, Set<string>>;
  let _callbacks: Record<string, Record<string, MachineEventHandler>> = {};

  const machineDefinition: MachineDefinition<Data> = {
    events(events) {
      if (_events) throw new Error("Events already defined");
      _events = new Set(events);
      return machineDefinition;
    },
    on(event, states, handler) {
      const callbacks = _callbacks[event] || {};

      for (const state of states) {
        if (callbacks[state]) {
          throw new Error(
            `Callback for event '${event}' already defined for state '${state}'`
          );
        }
        callbacks[state] = handler as any;
      }

      _callbacks[event] = callbacks;

      return machineDefinition;
    },
    states(states) {
      if (_states) throw new Error("States already defined");
      _states = new Set(states);
      return machineDefinition as any;
    },
    transitions(transitions) {
      if (_transitions) throw new Error("Transitions already defined");

      _transitions = {};
      if (transitions) {
        for (const [state, toStates] of Object.entries(transitions)) {
          _transitions[state] = new Set(toStates as string[]);
        }
      }

      return machineDefinition;
    },
    create(initialState, data) {
      let subscriptions: Set<(machine: Machine<Data>) => void> = new Set();

      const machine: Machine<Data> = {
        state: initialState,
        data,
        emit(event, eventData) {
          if (!_events.has(event)) {
            throw new Error(`Invalid event '${event}'`);
          }

          const callbacks = _callbacks[event];
          if (!callbacks) {
            throw new Error(`No callbacks defined for event '${event}'`);
          }

          const callback = callbacks[machine.state];
          if (!callback) {
            throw new Error(
              `No callback defined for event '${event}' and state '${machine.state}'`
            );
          }

          const transition = (nextState: never) => {
            if (!_transitions[machine.state]?.has(nextState)) {
              throw new Error(
                `Invalid state transition from '${machine.state}' to '${nextState}'`
              );
            }

            machine.state = nextState;

            for (const subscription of subscriptions) {
              subscription(machine);
            }
          };

          const result = callback({
            data: machine.data,
            event,
            eventData,
            from: machine.state,
            transition,
          });

          if (!result) return;

          if (typeof result === "string") {
            transition(result);
            return;
          }
          return result
            .then(() => {})
            .catch((reason) => {
              console.error(
                "An unhandled error occurred in a machine event handler"
              );
              throw reason;
            });
        },
        subscribe(callback) {
          subscriptions.add(callback);
          return () => {
            subscriptions.delete(callback);
          };
        },
      };

      return machine as never;
    },
  };

  return machineDefinition;
}
