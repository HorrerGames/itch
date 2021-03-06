import React from "react";
import { SortableElement } from "react-sortable-hoc";
import { createStructuredSelector } from "reselect";

import Item from "./item";

import { connect, actionCreatorsList, Dispatchers } from "../connect";

import { size } from "underscore";

import {
  IRootState,
  ITabInstance,
  ILocalizedString,
  IDownloadsState,
} from "common/types";

import { injectIntl, InjectedIntl } from "react-intl";
import { formatDurationAsMessage } from "common/format/datetime";
import { Space } from "common/helpers/space";
import { Game } from "common/butlerd/messages";
import { modalWidgets } from "../modal-widgets/index";
import {
  getActiveDownload,
  getPendingDownloads,
} from "main/reactors/downloads/getters";
import {
  rendererWindowState,
  rendererNavigation,
  rendererWindow,
} from "common/util/navigation";

interface ISortableHubSidebarItemProps {
  props: any & {
    tab: string;
  };
}

const SortableItem = SortableElement((props: ISortableHubSidebarItemProps) => {
  return <Item {...props.props} />;
});

class TabBase extends React.PureComponent<IProps & IDerivedProps> {
  onClick = () => {
    const { tab, focusTab } = this.props;
    focusTab({ window: rendererWindow(), tab });
  };

  onClose = () => {
    const { tab, closeTab } = this.props;
    closeTab({ window: rendererWindow(), tab });
  };

  onContextMenu = (ev: React.MouseEvent<any>) => {
    const { tab, openTabContextMenu } = this.props;
    openTabContextMenu({
      window: rendererWindow(),
      tab,
      clientX: ev.clientX,
      clientY: ev.pageY,
    });
  };

  render() {
    const { tab, index, sortable, tabInstance, active } = this.props;
    const { onExplore } = this;

    const sp = Space.fromInstance(tabInstance);
    let loading = this.props.loading || sp.web().loading;

    let iconImage = sp.image();
    const url = sp.url();
    const resource = sp.resource();
    const label = sp.label();
    let icon = sp.icon();
    let count = 0;
    let progress: number = null;
    let sublabel: ILocalizedString = null;

    if (tab === "itch://downloads") {
      const { downloads } = this.props;
      count = size(getPendingDownloads(downloads));
      const activeDownload = getActiveDownload(downloads);
      if (activeDownload) {
        const downloadProgress = downloads.progresses[activeDownload.id];
        if (downloads.paused) {
          icon = "stopwatch";
          sublabel = ["grid.item.downloads_paused"];
        } else if (downloadProgress && downloadProgress.eta) {
          progress = downloadProgress.progress;
          const title = activeDownload.game.title;
          const { intl } = this.props;
          const formatted = formatDurationAsMessage(downloadProgress.eta);
          const humanDuration = intl.formatMessage(
            {
              id: formatted.id,
            },
            formatted.values
          );
          sublabel = `${title} — ${humanDuration}`;
        }
      }
    }

    let gameOverride: Game = null;
    let { onClick, onClose, onContextMenu } = this;
    if (!sortable) {
      onClose = null;
    }

    const props = {
      tab,
      url,
      resource,
      tabInstance,
      label,
      icon,
      iconImage,
      active,
      onClick,
      count,
      progress,
      onClose,
      onContextMenu,
      onExplore,
      sublabel,
      gameOverride,
      loading,
    };

    if (sortable) {
      return <SortableItem key={tab} index={index} props={props} />;
    } else {
      return <Item key={tab} {...props} />;
    }
  }

  onExplore = (tab: string) => {
    const { tabInstance } = this.props;

    this.props.openModal(
      modalWidgets.exploreJson.make({
        window: rendererWindow(),
        title: "Tab information",
        message: "",
        widgetParams: {
          data: { tab, tabInstance },
        },
        fullscreen: true,
      })
    );
  };
}

interface IProps {
  tab: string;
  index?: number;
  active: boolean;
  sortable?: boolean;
}

const actionCreators = actionCreatorsList(
  "navigate",
  "focusTab",
  "closeTab",
  "openModal",
  "openTabContextMenu"
);

type IDerivedProps = Dispatchers<typeof actionCreators> & {
  tabInstance: ITabInstance;
  loading: boolean;
  downloads?: IDownloadsState;

  intl: InjectedIntl;
};

const Tab = connect<IProps>(injectIntl(TabBase), {
  state: (initialState, initialProps) => {
    let { tab } = initialProps;

    return createStructuredSelector({
      tabInstance: (rs: IRootState) =>
        rendererWindowState(rs).tabInstances[tab],
      loading: (rs: IRootState) => !!rendererNavigation(rs).loadingTabs[tab],
      downloads: (rs: IRootState) => tab === "itch://downloads" && rs.downloads,
    });
  },
  actionCreators,
});

export default Tab;
