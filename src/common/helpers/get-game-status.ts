import { IRootState, ITask, TaskName } from "../types/index";

import { first, findWhere, size } from "underscore";
import getByIds from "./get-by-ids";
import {
  getPendingForGame,
  getActiveDownload,
} from "main/reactors/downloads/getters";
import { isPlatformCompatible } from "common/util/is-platform-compatible";
import { memoize } from "common/util/lru-memoize";
import {
  Game,
  CaveSummary,
  DownloadKeySummary,
  Download,
  DownloadProgress,
  DownloadReason,
} from "common/butlerd/messages";
import { GameUpdate } from "common/butlerd/messages";

/**
 * What type of access we have to the game - do we own it,
 * have we created it, have we bought it, etc.
 */
export enum Access {
  /**
   * Game cannot be bought
   */
  Free,

  /**
   * Game is pay-what-you-want
   */
  Pwyw,

  /**
   * Game has a demo that can be downloaded for free
   */
  Demo,

  /**
   * Game is in press system and so are we
   */
  Press,

  /**
   * We have a download key for the game
   */
  Key,

  /**
   * We have edit rights on the game page
   */
  Edit,

  /**
   * We have no access to the game whatsoever
   */
  None,
}

export enum OperationType {
  /** The current operation is a download */
  Download,

  /** The current operation is a task */
  Task,
}

export interface IOperation {
  type: OperationType;
  name?: TaskName;
  id?: string;
  reason?: DownloadReason;
  active: boolean;
  paused: boolean;
  progress: number;
  bps?: number;
  eta?: number;
  stage?: string;
}

export interface IGameStatus {
  downloadKey: DownloadKeySummary;
  cave: CaveSummary;
  numCaves: number;
  access: Access;
  operation: IOperation;
  update: GameUpdate;
  compatible: boolean;
}

function getGameStatus(
  rs: IRootState,
  game: Game,
  caveId?: string
): IGameStatus {
  const { commons, profile, tasks, downloads } = rs;
  const { credentials } = profile;

  let downloadKeys = getByIds(
    commons.downloadKeys,
    commons.downloadKeyIdsByGameId[game.id]
  );

  let cave: CaveSummary;
  let numCaves = 0;
  if (!cave) {
    if (caveId) {
      cave = commons.caves[caveId];
    } else {
      let caves = getByIds(commons.caves, commons.caveIdsByGameId[game.id]);
      numCaves = size(caves);
      cave = first(caves);
    }
  }
  const downloadKey = first(downloadKeys);

  const pressUser = credentials.me.pressUser;
  const task = first(tasks.tasksByGameId[game.id]);

  const pendingDownloads = getPendingForGame(downloads, game.id);
  let download: Download;
  if (caveId) {
    download = findWhere(pendingDownloads, { caveId });
  } else {
    download = first(pendingDownloads);
  }

  let isActiveDownload = false;
  let areDownloadsPaused = false;
  let downloadProgress: DownloadProgress;
  if (download) {
    const activeDownload = getActiveDownload(downloads);
    isActiveDownload = download.id === activeDownload.id;
    areDownloadsPaused = downloads.paused;
    downloadProgress = downloads.progresses[download.id];
  }

  let update: GameUpdate;
  if (cave) {
    update = rs.gameUpdates.updates[cave.id];
  }

  return realGetGameStatus(
    game,
    cave,
    numCaves,
    downloadKey,
    pressUser,
    task,
    download,
    downloadProgress,
    update,
    isActiveDownload,
    areDownloadsPaused
  );
}

export default getGameStatus;

function rawGetGameStatus(
  game: Game,
  cave: CaveSummary,
  numCaves: number,
  downloadKey: DownloadKeySummary,
  pressUser: boolean,
  task: ITask,
  download: Download,
  downloadProgress: DownloadProgress,
  update: GameUpdate,
  isDownloadActive,
  areDownloadsPaused
): IGameStatus {
  let access = Access.None;
  if (!(game.minPrice > 0)) {
    if (game.canBeBought) {
      access = Access.Pwyw;
    } else {
      access = Access.Free;
    }
  } else {
    // game has minimum price
    if (downloadKey) {
      // we have download keys
      access = Access.Key;
    } else {
      // we have no download keys
      if (game.inPressSystem && pressUser) {
        access = Access.Press;
      } else {
        // we have
      }
    }
  }

  let operation: IOperation = null;

  if (task) {
    operation = {
      type: OperationType.Task,
      name: task.name,
      active: true,
      paused: false,
      progress: task.progress,
      eta: task.eta,
      bps: task.bps,
      stage: task.stage,
    };
  } else if (download) {
    let p = downloadProgress || {
      progress: null,
      eta: null,
      bps: null,
      stage: null,
    };
    operation = {
      type: OperationType.Download,
      id: download.id,
      reason: download.reason,
      active: isDownloadActive,
      paused: areDownloadsPaused,
      progress: p.progress,
      eta: p.eta,
      bps: p.bps,
      stage: p.stage,
    };
  }

  const compatible = isPlatformCompatible(game);
  return {
    cave,
    numCaves,
    downloadKey,
    access,
    operation,
    update,
    compatible,
  };
}
const realGetGameStatus = memoize(300, rawGetGameStatus);
