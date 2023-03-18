export interface Machine<
  Data = never,
  State extends string = never,
  Event extends string = never,
  EventData extends MachineEventData<Event, unknown> = never
> {
  data: Data;
  state: State;
  emit<E extends Event>(event: E, eventData?: EventData[E]): void;
  subscribe(callback: (machine: this) => void): () => void;
}

export type MachineEventData<
  Event extends string = never,
  EventData = never
> = {
  [key in Event]: EventData;
};

type ValidateShape<T, Shape> = T extends Shape
  ? Exclude<keyof T, keyof Shape> extends never
    ? T
    : never
  : never;

export interface MachineDefinition<
  Data = never,
  State extends string = never,
  Transitions extends MachineTransitions<State, State> = MachineTransitions<
    State,
    State
  >,
  Event extends string = never,
  EventData extends MachineEventData<Event, unknown> = never
> {
  states<T extends string>(
    states?: ReadonlyArray<T>
  ): MachineDefinition<Data, T, MachineTransitions<T, T>, Event, EventData>;
  transitions<T extends MachineTransitions<State, State>>(
    transitions?: MachineTransitionsSetup<
      State,
      ValidateShape<T, MachineTransitions<State, State>>
    >
  ): MachineDefinition<Data, State, T, Event, EventData>;
  events<T extends string>(
    events?: ReadonlyArray<T>
  ): MachineDefinition<
    Data,
    State,
    Transitions,
    T,
    MachineEventData<T, unknown>
  >;
  on<ED = never, E extends Event = Event, S extends State = State>(
    event: E,
    states: ReadonlyArray<S>,
    handler: MachineEventHandler<ED, S, Data, E, State, Transitions>
  ): MachineDefinition<
    Data,
    State,
    Transitions,
    Event,
    EventData & { [key in keyof E]: ED }
  >;
  create(
    initialState: State,
    data: Data
  ): Machine<Data, State, Event, EventData>;
}

export type MachineTransitions<
  State extends string = never,
  ToState extends string = never
> = {
  [key in State]: ToState;
};

type MachineTransitionsSetup<
  State extends string,
  Transitions extends MachineTransitions<State, State>
> = {
  [key in keyof Transitions]: ReadonlyArray<Transitions[key]>;
};

interface MachineEvent<
  EventData,
  Data,
  Event extends string,
  FromState,
  State extends string
> {
  data: Data;
  event: Event;
  eventData: EventData | undefined;
  from: FromState;
  transition(to: State): void;
}

export type MachineEventHandler<
  EventData = never,
  FromState extends keyof Transitions = never,
  Data = unknown,
  Event extends string = never,
  State extends string = never,
  Transitions extends MachineTransitions = MachineTransitions
> = (
  event: MachineEvent<EventData, Data, Event, FromState, State>
) => (Transitions[FromState] | void) | Promise<void>;
