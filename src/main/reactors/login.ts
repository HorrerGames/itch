import { Watcher } from "common/util/watcher";
import { actions } from "common/actions";

import { promisedModal } from "./modals";
import urls from "common/constants/urls";
import urlParser from "url";

import { messages, withLogger } from "common/butlerd/index";
import { Profile } from "common/butlerd/messages";

import rootLogger from "common/logger";
import { IStore } from "common/types";
import { restoreTabs, saveTabs } from "./tab-save";
import { ItchPromise } from "common/util/itch-promise";
import { modalWidgets } from "renderer/components/modal-widgets";
import { partitionForUser } from "common/util/partition-for-user";
const logger = rootLogger.child({ name: "login" });
const call = withLogger(logger);

export default function(watcher: Watcher) {
  watcher.on(actions.loginWithPassword, async (store, action) => {
    const { username, password } = action.payload;

    store.dispatch(actions.attemptLogin({}));
    try {
      // integration tests for the integration test goddess
      if (username === "#api-key") {
        const { profile } = await call(messages.ProfileLoginWithAPIKey, {
          apiKey: password,
        });
        await loginSucceeded(store, profile);
        return;
      }

      const { profile, cookie } = await call(
        messages.ProfileLoginWithPassword,
        {
          username,
          password,
        },
        client => {
          client.on(
            messages.ProfileRequestCaptcha,
            async ({ recaptchaUrl }) => {
              const modalRes = await promisedModal(
                store,
                modalWidgets.recaptchaInput.make({
                  window: "root",
                  title: "Captcha",
                  message: "",
                  widgetParams: {
                    url: recaptchaUrl || urls.itchio + "/captcha",
                  },
                  fullscreen: true,
                })
              );

              if (modalRes) {
                return { recaptchaResponse: modalRes.recaptchaResponse };
              } else {
                // abort
                return { recaptchaResponse: null };
              }
            }
          );

          client.on(messages.ProfileRequestTOTP, async () => {
            const modalRes = await promisedModal(
              store,
              modalWidgets.twoFactorInput.make({
                window: "root",
                title: ["login.two_factor.title"],
                message: "",
                buttons: [
                  {
                    label: ["login.action.login"],
                    action: "widgetResponse",
                  },
                  {
                    label: ["login.two_factor.learn_more"],
                    action: actions.openInExternalBrowser({
                      url: urls.twoFactorHelp,
                    }),
                    className: "secondary",
                  },
                ],
                widgetParams: {
                  username,
                },
              })
            );

            if (modalRes) {
              return { code: modalRes.totpCode };
            } else {
              // abort
              return { code: null };
            }
          });
        }
      );

      if (cookie) {
        try {
          await setCookie(profile, cookie);
        } catch (e) {
          logger.error(`Could not set cookie: ${e.stack}`);
        }
      }

      await loginSucceeded(store, profile);
    } catch (e) {
      store.dispatch(actions.loginFailed({ username, error: e }));
    }
  });

  watcher.on(actions.useSavedLogin, async (store, action) => {
    store.dispatch(actions.attemptLogin({}));

    try {
      const { profile } = await call(messages.ProfileUseSavedLogin, {
        profileId: action.payload.profile.id,
      });
      await loginSucceeded(store, profile);
    } catch (e) {
      // TODO: handle offline login
      const originalProfile = action.payload.profile;
      store.dispatch(
        actions.loginFailed({
          username: originalProfile.user.username,
          error: e,
        })
      );
    }
  });

  watcher.on(actions.requestLogout, async (store, action) => {
    await saveTabs(store);
    store.dispatch(actions.logout({}));
  });
}

const YEAR_IN_SECONDS =
  365.25 /* days */ * 24 /* hours */ * 60 /* minutes */ * 60 /* seconds */;

async function setCookie(profile: Profile, cookie: Map<string, string>) {
  const partition = partitionForUser(String(profile.user.id));
  const session = require("electron").session.fromPartition(partition, {
    cache: false,
  });

  for (const name of Object.keys(cookie)) {
    const value = cookie[name];
    const epoch = Date.now() * 0.001;
    await new ItchPromise((resolve, reject) => {
      const parsed = urlParser.parse(urls.itchio);
      const opts = {
        name,
        value: encodeURIComponent(value),
        url: `${parsed.protocol}//${parsed.hostname}`,
        domain: "." + parsed.hostname,
        secure: parsed.protocol === "https:",
        httpOnly: true,
        expirationDate: epoch + YEAR_IN_SECONDS, // have it valid for a year
      };
      logger.debug(`Setting cookie: ${JSON.stringify(opts)}`);
      session.cookies.set(opts, (error: Error) => {
        if (error) {
          logger.error(`Cookie error: ${JSON.stringify(error)}`);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

async function loginSucceeded(store: IStore, profile: Profile) {
  await restoreTabs(store, profile);
  store.dispatch(actions.loginSucceeded({ profile }));
}
