// This file is the entry point for the main (browser) process

let rt: any;
if (process.env.ITCH_TIME_REQUIRE === "1") {
  rt = require("require-times")([".js", ".ts", ".tsx"]);
  rt.start();
}

import env from "common/env";
import logger from "common/logger";

import { isItchioURL } from "common/util/url";

import { actions } from "common/actions";
import { app, protocol, globalShortcut } from "electron";

logger.info(
  `${env.appName}@${app.getVersion()} on electron@${
    process.versions.electron
  } in ${env.production ? "production" : "development"}`
);

import { loadPreferencesSync } from "main/reactors/preboot/load-preferences";
import { IStore } from "common/types";

const appUserModelId = "com.squirrel.itch.itch";

// App lifecycle

function main() {
  if (process.env.CAPSULE_LIBRARY_PATH) {
    // disable acceleration when captured by capsule
    app.disableHardwareAcceleration();
  } else {
    try {
      const prefs = loadPreferencesSync();
      if (prefs.disableHardwareAcceleration) {
        app.disableHardwareAcceleration();
      }
    } catch (e) {
      // oh well
    }
  }

  if (env.production) {
    app.enableMixedSandbox();
  }

  if (process.env.ITCH_IGNORE_CERTIFICATE_ERRORS === "1") {
    app.commandLine.appendSwitch("ignore-certificate-errors");
  }
  protocol.registerStandardSchemes(["itch-cave"]);

  let store: IStore = require("main/store").default;

  let onReady = () => {
    if (!env.integrationTests) {
      const shouldQuit = app.makeSingleInstance((argv, cwd) => {
        // we only get inside this callback when another instance
        // is launched - so this executes in the context of the main instance
        store.dispatch(
          actions.processUrlArguments({
            args: argv,
          })
        );
        store.dispatch(actions.focusWindow({ window: "root" }));
      });

      if (shouldQuit) {
        app.exit(0);
        return;
      }
    }

    store.dispatch(
      actions.processUrlArguments({
        args: process.argv,
      })
    );

    globalShortcut.register("Control+Alt+Backspace", function() {
      store.dispatch(actions.forceCloseLastGame({}));
    });

    if (rt) {
      rt.end();
    }

    store.dispatch(actions.preboot({}));

    setInterval(() => {
      try {
        store.dispatch(actions.tick({}));
      } catch (e) {
        logger.error(`While dispatching tick: ${e.stack}`);
      }
    }, 1 * 1000 /* every second */);
  };
  app.on("ready", onReady);

  app.on("will-finish-launching", () => {
    app.setAppUserModelId(appUserModelId);
  });

  // macOS (Info.pList)
  app.on("open-url", (e: Event, url: string) => {
    if (isItchioURL(url)) {
      // otherwise it'll err -600
      e.preventDefault();
      store.dispatch(actions.handleItchioURI({ uri: url }));
    }
  });
}

main();
