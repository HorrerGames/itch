import { IWindowsState, IRootState, IAction } from "../types";
import windowReducer from "./window";
import { actions } from "../actions";
import { omit } from "underscore";

const initialState: IWindowsState = {};

const windowOpenedType = actions.windowOpened({} as any).type;
const windowClosedType = actions.windowClosed({} as any).type;

export default function(state: IRootState, action: IAction<any>) {
  if (typeof state === "undefined") {
    return initialState;
  }

  if (action) {
    // woo that's a mouthful
    if (action.type === windowOpenedType) {
      const {
        window,
      } = action.payload as typeof actions.windowOpened["payload"];

      let windowState = windowReducer(undefined, null);
      windowState = windowReducer(windowState, action);

      return {
        ...state,
        [window]: windowState,
      };
    }

    if (action.type === windowClosedType) {
      const {
        window,
      } = action.payload as typeof actions.windowClosed["payload"];
      return omit(state, window);
    }

    if (action.payload && action.payload.window) {
      const { window } = action.payload;
      if (typeof state[window] !== "undefined") {
        return {
          ...state,
          [window]: windowReducer(state[window], action),
        };
      }
    }

    let newState = {};
    for (const k of Object.keys(state)) {
      newState[k] = windowReducer(state[k], action);
    }
    return newState;
  }

  return state;
}
