import defaultManifestIcons from "common/constants/default-manifest-icons";

import { IStore, IModalButtonSpec } from "common/types";

import { promisedModal } from "../../reactors/modals";

import { Game, Action } from "common/butlerd/messages";
import { modalWidgets } from "renderer/components/modal-widgets";

// TODO: support localized action names

export async function pickManifestAction(
  store: IStore,
  manifestActions: Action[],
  game: Game
): Promise<number> {
  const buttons: IModalButtonSpec[] = [];
  const bigButtons: IModalButtonSpec[] = [];

  for (let index = 0; index < manifestActions.length; index++) {
    const action = manifestActions[index];
    if (!action.name) {
      throw new Error(`in manifest, action ${index} is missing a name`);
    }

    const icon = action.icon || defaultManifestIcons[action.name] || "star";

    bigButtons.push({
      label: [`action.name.${action.name}`, { defaultValue: action.name }],
      action: modalWidgets.pickManifestAction.action({ index }),
      icon,
      className: `action-${action.name}`,
    });
  }

  buttons.push("cancel");

  const response = await promisedModal(
    store,
    modalWidgets.pickManifestAction.make({
      window: "root",
      title: game.title,
      stillCoverUrl: game.stillCoverUrl,
      coverUrl: game.coverUrl,
      message: "",
      bigButtons,
      buttons,
      widgetParams: {},
    })
  );

  if (response) {
    return response.index;
  }

  // as per butlerd spec, negative index means abort launch
  return -1;
}
