type AnyAction = {
  type: string;
};
type StoreAPI<S = any> = {
  getState(): S;
  dispatch: (action: AnyAction) => void;
};
type NextFn = (action: AnyAction) => void;

type EqualityFn = (a: unknown, b: unknown) => boolean;

type ScheduleFn = <F extends Function>(cb: F) => any;

type Config = {
  /**
   * Function that checks equality of two given values.
   * @default (a === b)
   */
  equalityFn?: EqualityFn;
  /**
   * Scheduler for selectors checks
   * @default requestAnimationFrame
   */
  scheduleFn?: ScheduleFn;
};

type Effect<S = unknown, V = unknown> = (api: StoreAPI<S>, v) => unknown;

type AddListenerOptions<S, V> = {
  selector: (state: S) => V;
  effect: Effect<S, V>;
};
