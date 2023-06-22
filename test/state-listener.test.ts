import { StateListener } from '../src';

const requestAnimationFrameMock = jest.fn().mockImplementation(cb => cb());
beforeAll(() => {
  global.requestAnimationFrame = requestAnimationFrameMock;
});

describe('StateListener with casual selectors', () => {
  type TestState = {
    counter: number;
  };
  let state: TestState = {
    counter: 0,
  };
  const action = {
    type: 'inc',
  };
  const api = {
    getState: jest.fn().mockImplementation(() => state),
    dispatch: jest.fn(),
  };

  let selector: jest.Mock<any, any>;
  let listener: StateListener<TestState>;
  let runMiddleware: (next: NextFn) => (action: AnyAction) => void;

  const next = jest.fn().mockImplementation(() => {
    state = {
      counter: state.counter + 1,
    };
  });

  beforeEach(() => {
    selector = jest
      .fn()
      .mockImplementation((_state: TestState) => _state.counter);

    state = {
      counter: 0,
    };

    listener = new StateListener();
    runMiddleware = listener.middleware(api);
  });

  it('should call effect', () => {
    const effect = jest.fn();
    listener.add({
      selector,
      effect,
    });

    runMiddleware(next)(action);

    expect(next).toHaveBeenCalledWith(action);
    expect(requestAnimationFrameMock).toHaveBeenCalled();
    expect(selector).toHaveBeenCalledTimes(2);
    expect(effect).toHaveBeenCalledWith(api, 1);

    runMiddleware(next)(action);

    expect(effect).toHaveBeenCalledWith(api, 2);
  });

  it('should call many effects with one selector', () => {
    const effect1 = jest.fn();
    const effect2 = jest.fn();
    listener.add({
      selector,
      effect: effect1,
    });
    listener.add({
      selector,
      effect: effect2,
    });

    runMiddleware(next)(action);

    expect(effect1).toHaveBeenCalledWith(api, 1);
    expect(effect2).toHaveBeenCalledWith(api, 1);
  });

  it('should call many effects with many selectors', () => {
    const effect1 = jest.fn();
    listener.add({
      selector,
      effect: effect1,
    });

    const selector2 = jest.fn().mockImplementation(() => state.counter * 2);
    const effect2 = jest.fn();
    listener.add({
      selector: selector2,
      effect: effect2,
    });

    runMiddleware(next)(action);

    expect(effect1).toHaveBeenCalledWith(api, 1);
    expect(effect2).toHaveBeenCalledWith(api, 2);
  });

  it('should unsubscribe listener', () => {
    const effect = jest.fn();
    const unsubscribe = listener.add({
      selector,
      effect,
    });

    runMiddleware(next)(action);
    unsubscribe();
    runMiddleware(next)(action);

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('should drop listeners', () => {
    const effect = jest.fn();
    listener.add({
      selector,
      effect,
    });

    listener.reset();
    runMiddleware(next)(action);

    expect(effect).toHaveBeenCalledTimes(0);
  });
});

describe('StateListener with equalFn', () => {
  type TestState = {
    user: {
      name: string;
    };
  };
  let state: TestState = {
    user: {
      name: 'John',
    },
  };

  const setUserAction = (name: string) =>
    ({
      type: 'setUser',
      payload: {
        name,
      },
    } as const);

  const api = {
    getState: jest.fn().mockImplementation(() => state),
    dispatch: jest.fn(),
  };

  let selector: jest.Mock<any, any>;

  let listener: StateListener<TestState>;
  let runMiddleware: (next: NextFn) => (action: AnyAction) => void;

  const next = jest.fn().mockImplementation((action: AnyAction) => {
    if (action.type === 'setUser') {
      const a = action as ReturnType<typeof setUserAction>;
      state = {
        ...state,
        user: a.payload,
      };
    }
  });

  beforeEach(() => {
    selector = jest.fn().mockImplementation((_state: TestState) => _state.user);

    state = {
      user: {
        name: 'John',
      },
    };

    listener = new StateListener({
      equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    });
    runMiddleware = listener.middleware(api);
  });

  it('should call effect with object value', () => {
    const effect = jest.fn();
    listener.add({
      selector: selector as (state: TestState) => TestState['user'],
      effect,
    });

    runMiddleware(next)(setUserAction('Michel'));

    expect(effect).toHaveBeenCalledWith(api, { name: 'Michel' });
  });

  it('should use equalityFn', () => {
    const effect = jest.fn();
    listener.add({
      selector: selector as (state: TestState) => TestState['user'],
      effect,
    });
    const previousUser = api.getState().user as TestState['user'];

    runMiddleware(next)(setUserAction('John'));

    expect(state.user).not.toBe(previousUser);
    expect(state.user).toEqual(previousUser);
    expect(effect).toBeCalledTimes(0);
  });
});

describe('StateListener with custom scheduler', () => {
  jest.useFakeTimers();

  type TestState = {
    counter: number;
  };
  let state: TestState = {
    counter: 0,
  };
  const action = {
    type: 'inc',
  };
  const api = {
    getState: jest.fn().mockImplementation(() => state),
    dispatch: jest.fn(),
  };

  let selector: jest.Mock<any, any>;
  let listener: StateListener<TestState>;
  let runMiddleware: (next: NextFn) => (action: AnyAction) => void;

  const next = jest.fn().mockImplementation(() => {
    state = {
      counter: state.counter + 1,
    };
  });

  beforeEach(() => {
    selector = jest
      .fn()
      .mockImplementation((_state: TestState) => _state.counter);

    state = {
      counter: 0,
    };

    listener = new StateListener({
      scheduleFn: cb => setTimeout(cb, 200),
    });
    runMiddleware = listener.middleware(api);
  });

  it('should call only once for timeout', () => {
    const effect = jest.fn();
    listener.add({
      selector,
      effect,
    });

    runMiddleware(next)(action);
    runMiddleware(next)(action);
    runMiddleware(next)(action);

    expect(effect).not.toBeCalled();

    jest.runAllTimers();

    expect(effect).toHaveBeenCalledTimes(1);
    expect(effect).toHaveBeenCalledWith(api, 3);
  });
});

describe('StateListener with pre-registered effects', () => {
  type TestState = {
    counter: number;
  };
  let state: TestState = {
    counter: 0,
  };
  const action = {
    type: 'inc',
  };
  const api = {
    getState: jest.fn().mockImplementation(() => state),
    dispatch: jest.fn(),
  };

  let selector: jest.Mock<any, any>;
  let listener: StateListener<TestState>;
  let runMiddleware: (next: NextFn) => (action: AnyAction) => void;

  const next = jest.fn().mockImplementation(() => {
    state = {
      counter: state.counter + 1,
    };
  });

  beforeEach(() => {
    selector = jest
      .fn()
      .mockImplementation((_state: TestState) => _state.counter);

    state = {
      counter: 0,
    };

    listener = new StateListener();
  });

  it('should call effect only after middleware registration', () => {
    const effect = jest.fn();
    listener.add({
      selector,
      effect,
    });

    runMiddleware = listener.middleware(api);

    expect(selector).toHaveBeenCalledWith(state);
    expect(effect).not.toBeCalled();

    runMiddleware(next)(action);

    expect(effect).toHaveBeenCalledTimes(1);
  });
});
