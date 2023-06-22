const defaultEquals: EqualityFn = (a, b) => a === b;

const defaultConfig = {
  equalityFn: defaultEquals,
};

export class StateListener<S> {
  private applyRequested = false;

  private selectorsMap = new Map<Function, Set<Function>>();

  private lastValues = new WeakMap<object, any>();

  private api: StoreAPI<S> | null = null;

  private config: Required<Config>;

  constructor(config: Config = {}) {
    this.config = {
      ...defaultConfig,
      ...config,
      scheduleFn: config.scheduleFn || (requestAnimationFrame as ScheduleFn),
    };
  }

  /**
   * Redux middleware
   */
  public middleware = (api: StoreAPI<S>) => {
    this.api = api;

    // If any selectors has already been registered, save it's last values
    this.prepareSelectors(api);

    return (next: NextFn) => (action: AnyAction) => {
      next(action);

      this.applyListeners(api);
    };
  };

  /**
   * Adds selector with effect
   */
  public add = <V>(options: AddListenerOptions<S, V>) => {
    const { effect, selector } = options;

    if (!this.selectorsMap.has(selector)) {
      this.selectorsMap.set(selector, new Set());
      if (this.api) {
        this.lastValues.set(selector, selector(this.api.getState()));
      }
    }

    const listeners = this.selectorsMap.get(selector)!;
    listeners.add(effect);

    return () => {
      listeners.delete(effect);

      if (!listeners.size) {
        this.selectorsMap.delete(selector);
      }
    };
  };

  /**
   * Drops all selectors and it's listeners
   */
  public reset = () => {
    this.selectorsMap = new Map();
    this.lastValues = new WeakMap();
  };

  private applyListeners = (api: StoreAPI<S>) => {
    if (this.applyRequested) {
      return;
    }

    this.applyRequested = true;
    const task = () => {
      const currentState = api.getState();

      this.selectorsMap.forEach((listeners, selector) => {
        const lastValue = selector(currentState);

        if (!this.config.equalityFn(this.lastValues.get(selector), lastValue)) {
          this.lastValues.set(selector, lastValue);
          listeners.forEach(l => l(api, lastValue));
        }
      });

      this.applyRequested = false;
    };

    const scheduler = this.config.scheduleFn;
    scheduler(task);
  };

  private prepareSelectors = (api: StoreAPI<S>) => {
    if (this.selectorsMap.size) {
      this.selectorsMap.forEach((_, selector) => {
        const state = api.getState();
        const lastValue = selector(state);
        this.lastValues.set(selector, lastValue);
      });
    }
  };
}
