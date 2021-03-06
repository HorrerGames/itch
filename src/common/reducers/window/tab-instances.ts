import { ITabInstances, ITabData, ITabDataSave } from "common/types";
import { actions } from "common/actions";
import reducer from "../reducer";

import rootLogger from "common/logger";
const logger = rootLogger.child({ name: "reducers/tab-data" });

import { omit, each } from "underscore";

const initialState: ITabInstances = {};

const emptyObj = {} as any;

let deepFields = ["users", "games", "collections", "web", "toast"];

function merge(
  a: ITabData,
  b: ITabData,
  { shallow }: { shallow?: boolean }
): ITabData {
  if (shallow) {
    return { ...a, ...b };
  }

  const res = {
    ...a,
    ...b,
  };
  for (const df of deepFields) {
    (res as any)[df] = {
      ...((a as any)[df] || emptyObj),
      ...((b as any)[df] || emptyObj),
    };
  }
  return res;
}

export default reducer<ITabInstances>(initialState, on => {
  on(actions.windowOpened, (state, action) => {
    const { initialURL } = action.payload;
    return {
      ...state,
      ["initial-tab"]: {
        history: [{ url: initialURL }],
        currentIndex: 0,
        sleepy: true,
        data: {},
      },
    };
  });

  on(actions.tabDataFetched, (state, action) => {
    const { tab, data, shallow } = action.payload;
    const oldInstance = state[tab];
    if (!oldInstance) {
      // ignore fresh data for closed tabs
      logger.debug(`tabDataFetched, ignoring fresh data for ${tab}`);
      return state;
    }

    let newData = merge(oldInstance.data, data, { shallow });

    return {
      ...state,
      [tab]: {
        ...omit(oldInstance, "sleepy"),
        data: newData,
      },
    };
  });

  on(actions.evolveTab, (state, action) => {
    const { tab, data = emptyObj } = action.payload;
    let { url, resource, replace } = action.payload;

    const oldInstance = state[tab];
    if (!oldInstance) {
      // ignore fresh data for closed tabs
      return state;
    }

    let { history, currentIndex } = oldInstance;
    if (history[currentIndex].url === url) {
      replace = true;
    }

    if (resource && /^collections\//.test(resource)) {
      url = `itch://${resource}`;
    }

    if (!resource) {
      // keep the resource in case it's not specified
      resource = history[currentIndex].resource;
    }
    if (replace) {
      history = [
        ...history.slice(0, currentIndex),
        { url, resource },
        ...history.slice(currentIndex + 1),
      ];
    } else {
      history = [...history.slice(0, currentIndex + 1), { url, resource }];
      currentIndex = history.length - 1;
    }

    // merge old & new data
    return {
      ...state,
      [tab]: {
        ...oldInstance,
        history,
        currentIndex,
        data: merge(oldInstance.data, data, { shallow: false }),
      },
    };
  });

  on(actions.tabGoBack, (state, action) => {
    const { tab } = action.payload;
    const instance = state[tab];

    if (instance.currentIndex <= 0) {
      // we can't go back!
      return state;
    }

    return {
      ...state,
      [tab]: {
        ...instance,
        currentIndex: instance.currentIndex - 1,
      },
    };
  });

  on(actions.tabGoForward, (state, action) => {
    const { tab } = action.payload;
    const instance = state[tab];

    if (instance.currentIndex >= instance.history.length - 1) {
      // we can't go forward!
      return state;
    }

    return {
      ...state,
      [tab]: {
        ...instance,
        currentIndex: instance.currentIndex + 1,
      },
    };
  });

  on(actions.focusTab, (state, action) => {
    const { tab } = action.payload;
    const oldInstance = state[tab];

    // wake up any sleepy tabs
    if (oldInstance && oldInstance.sleepy) {
      return {
        ...state,
        [tab]: omit(oldInstance, "sleepy"),
      };
    }
    return state;
  });

  on(actions.closeTab, (state, action) => {
    const { tab } = action.payload;
    return omit(state, tab);
  });

  on(actions.openTab, (state, action) => {
    const { tab, url, resource, data = emptyObj } = action.payload;
    if (!tab) {
      return state;
    }
    return {
      ...state,
      [tab]: {
        history: [
          {
            url,
            resource,
          },
        ],
        currentIndex: 0,
        sleepy: true,
        data: { ...data },
      },
    };
  });

  on(actions.tabGotWebContents, (state, action) => {
    const { tab, webContentsId } = action.payload;
    const oldData = state[tab];

    return {
      ...state,
      [tab]: {
        ...(oldData || emptyObj),
        webContentsId,
      },
    };
  });

  on(actions.logout, (state, action) => {
    return initialState;
  });

  on(actions.tabsRestored, (state, action) => {
    const snapshot = action.payload;

    let s = state;

    each(snapshot.items, (tabSave: ITabDataSave) => {
      if (typeof tabSave !== "object") {
        return;
      }

      const { id, ...data } = tabSave;
      if (!id) {
        return;
      }

      s = {
        ...s,
        [tabSave.id]: {
          ...data,
          data: {},
          sleepy: true,
        },
      };
    });

    return s;
  });
});
