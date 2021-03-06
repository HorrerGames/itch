import React from "react";
import { connect, Dispatchers, actionCreatorsList } from "./connect";

import MainAction from "./game-actions/main-action";
import GameStats from "./game-stats";
import Filler from "./basics/filler";
import IconButton from "./basics/icon-button";

import { IRootState } from "common/types";

import { IBrowserControlProps } from "./browser-state";

import styled from "./styles";

import { Space } from "common/helpers/space";
import getGameStatus, { IGameStatus } from "common/helpers/get-game-status";
import { Game } from "common/butlerd/messages";
import { rendererWindow } from "common/util/navigation";

const Spacer = styled.div`
  flex-basis: 10px;
  flex-shrink: 0;
`;

const BrowserContextDiv = styled.div`
  background: ${props => props.theme.sidebarBackground};

  display: flex;
  justify-content: center;
  flex-direction: row;

  padding: 10px;
  box-shadow: 0 0 18px rgba(0, 0, 0, 0.16);
  z-index: 50;
  align-items: center;
`;

class GameBrowserContext extends React.PureComponent<IProps & IDerivedProps> {
  constructor(props: IProps & IDerivedProps, context) {
    super(props, context);
    this.state = {};
  }

  render() {
    const { game, status } = this.props;
    if (!game || !game.id) {
      return <div />;
    }

    return (
      <BrowserContextDiv>
        <MainAction game={game} status={status} wide />
        <Spacer />
        <GameStats game={game} status={status} />
        <Filler />
        <IconButton
          className="manage-game"
          huge
          emphasized
          icon="cog"
          onClick={this.onManage}
        />
      </BrowserContextDiv>
    );
  }

  onManage = (ev: React.MouseEvent<any>) => {
    const { game, manageGame } = this.props;
    manageGame({ game });
  };
}

interface IProps extends IBrowserControlProps {}

const actionCreators = actionCreatorsList("openGameContextMenu", "manageGame");

type IDerivedProps = Dispatchers<typeof actionCreators> & {
  game: Game;
  status: IGameStatus;
};

export default connect<IProps>(GameBrowserContext, {
  state: (rs: IRootState, props: IProps) => {
    const game = Space.fromState(rs, rendererWindow(), props.tab).game();
    if (!game) {
      return {};
    }

    return {
      game,
      status: getGameStatus(rs, game),
    };
  },
  actionCreators,
});
