import { Watcher } from "common/util/watcher";

import { actions } from "common/actions";

import * as paths from "common/util/paths";

import { makeLogger } from "common/logger";
const logger = makeLogger({ logPath: paths.updaterLogPath() }).child({
  name: "updater",
});

import { isEmpty } from "underscore";

const SKIP_GAME_UPDATES = process.env.ITCH_SKIP_GAME_UPDATES === "1";

// 30 minutes * 60 = seconds, * 1000 = millis
const DELAY_BETWEEN_PASSES = 20 * 60 * 1000;
const DELAY_BETWEEN_PASSES_WIGGLE = 10 * 60 * 1000;

import { messages, withLogger } from "common/butlerd/index";
const call = withLogger(logger);

import { IStore } from "common/types";
import {
  CheckUpdateItem,
  CheckUpdateResult,
  Cave,
} from "common/butlerd/messages";

async function prepareUpdateItem(cave: Cave): Promise<CheckUpdateItem> {
  if (!cave.game) {
    throw new Error(`Cave ${cave.id} lacks game`);
  }

  const item: CheckUpdateItem = {
    itemId: cave.id,
    installedAt: cave.stats.installedAt,
    game: cave.game,
    upload: cave.upload,
    build: cave.build,
  };
  return item;
}

async function performUpdateCheck(
  store: IStore,
  items: CheckUpdateItem[]
): Promise<CheckUpdateResult> {
  return await call(messages.CheckUpdate, { items }, client => {
    client.on(messages.GameUpdateAvailable, async ({ update }) => {
      store.dispatch(actions.gameUpdateAvailable({ update }));
    });
  });
}

function sleepTime(): number {
  return DELAY_BETWEEN_PASSES + Math.random() * DELAY_BETWEEN_PASSES_WIGGLE;
}

function reschedule(store: IStore) {
  const nextCheck = Date.now() + sleepTime();
  logger.info(`Scheduling next game update check for ${new Date(nextCheck)}`);

  store.dispatch(
    actions.scheduleSystemTask({
      nextGameUpdateCheck: nextCheck,
    })
  );
}

export default function(watcher: Watcher) {
  if (SKIP_GAME_UPDATES) {
    logger.debug(
      "Skipping game update check as requested per environment variable"
    );
  } else {
    watcher.on(actions.tick, async (store, action) => {
      const { nextGameUpdateCheck } = store.getState().systemTasks;
      if (Date.now() <= nextGameUpdateCheck) {
        // it's not our time... yet!
        return;
      }

      logger.info("Regularly scheduled check for game updates...");
      store.dispatch(actions.checkForGameUpdates({}));
    });
  }

  watcher.on(actions.checkForGameUpdates, async (store, action) => {
    reschedule(store);

    if (!store.getState().setup.done) {
      return;
    }

    store.dispatch(
      actions.gameUpdateCheckStatus({
        checking: true,
        progress: 0,
      })
    );

    try {
      store.dispatch(
        actions.gameUpdateCheckStatus({
          checking: true,
          progress: 0,
        })
      );

      // TODO: let butler page through the caves instead,
      // this is too much back and forth
      const { caves } = await call(messages.FetchCaves, {});

      if (isEmpty(caves)) {
        return;
      }

      logger.info(`Checking updates for ${caves.length} games`);

      let items: CheckUpdateItem[] = [];
      for (const cave of caves) {
        try {
          items.push(await prepareUpdateItem(cave));
        } catch (e) {
          logger.error(
            `Won't be able to check ${cave.id} for upgrade: ${e.stack}`
          );
        }
      }

      try {
        await performUpdateCheck(store, items);
      } catch (e) {
        logger.error(
          `While performing ${items.length} update checks: ${e.stack}`
        );
      }
    } finally {
      store.dispatch(
        actions.gameUpdateCheckStatus({
          checking: false,
          progress: -1,
        })
      );
    }
  });

  watcher.on(actions.checkForGameUpdate, async (store, action) => {
    const { caveId, noisy = false } = action.payload;
    if (noisy) {
      logger.info(`Looking for updates for cave ${caveId}`);
    }

    const { cave } = await call(messages.FetchCave, { caveId });

    const item = await prepareUpdateItem(cave);
    let res: CheckUpdateResult;

    try {
      res = await performUpdateCheck(store, [item]);
    } catch (e) {
      logger.error(`While checking for game update: ${e.stack}`);
      if (!res) {
        res = {
          updates: [],
          warnings: [String(e)],
        };
      }
    }

    if (noisy) {
      dispatchUpdateNotification(store, item, res);
    }
  });
}

function dispatchUpdateNotification(
  store: IStore,
  item: CheckUpdateItem,
  result: CheckUpdateResult
) {
  if (!result) {
    return;
  }

  if (!isEmpty(result.warnings)) {
    store.dispatch(
      actions.statusMessage({
        message: [
          "status.game_update.check_failed",
          { err: result.warnings[0] },
        ],
      })
    );
    return;
  }

  if (isEmpty(result.updates)) {
    store.dispatch(
      actions.statusMessage({
        message: ["status.game_update.not_found", { title: item.game.title }],
      })
    );
  } else {
    store.dispatch(
      actions.statusMessage({
        message: ["status.game_update.found", { title: item.game.title }],
      })
    );
  }
}
