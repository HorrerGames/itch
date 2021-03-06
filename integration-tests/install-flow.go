package main

import (
	"fmt"
	"time"
)

const testGameName = "111 first"
const testGameID = 149766

func installFlow(r *runner) {
	r.logf("searching for known game")
	must(r.click("#search"))
	must(r.setValue("#search", testGameName))

	r.logf("opening it")
	var gameResultSelector = fmt.Sprintf(".results-container .game-search-result[data-game-id='%d']", testGameID)
	must(r.click(gameResultSelector))

	r.logf("installing it")
	var mainActionSelector = fmt.Sprintf(".meat-tab.visible .main-action[data-game-id='%d']", testGameID)
	must(r.waitUntilTextExists(mainActionSelector, "Install"))
	must(r.click(mainActionSelector))

	r.logf("launching it")
	must(r.waitUntilTextExistsWithTimeout(mainActionSelector, "Launch", 30*time.Second))
	must(r.click(mainActionSelector))

	r.logf("force-closing it")
	must(r.waitUntilTextExists(mainActionSelector, "Running"))
	must(r.click(mainActionSelector))
	must(r.click("#modal-force-close"))

	r.logf("making sure it's closed")
	must(r.waitUntilTextExists(mainActionSelector, "Launch"))

	r.logf("switching to downloads tab")
	must(r.click("#sidebar section[data-url='itch://downloads']"))

	r.logf("making sure our download shows up as finished")
	var downloadRowSelector = fmt.Sprintf(".meat-tab.visible .download-row-item.finished[data-game-id='%d'] .control--title", testGameID)
	must(r.waitUntilTextExists(downloadRowSelector, "111 first"))

	r.takeScreenshot("finished download")

	r.logf("clearing downloads")
	must(r.click(".meat-tab.visible .downloads-clear-all"))

	r.logf("making sure downloads list is empty now")
	must(r.waitForVisible(".meat-tab.visible .no-active-downloads"))

	r.logf("navigating back to game")
	must(r.click(fmt.Sprintf("#sidebar section[data-resource='games/%d']", testGameID)))

	r.takeScreenshot("installed game tab")

	r.logf("re-installing it")
	must(r.click(".meat-tab.visible .manage-game"))
	must(r.click(".manage-cave"))
	must(r.click(".manage-reinstall"))
	must(r.waitUntilTextExists(mainActionSelector, "Launch"))

	r.logf("closing all tabs")
	must(r.click("#sidebar-close-all-tabs"))
	// this depends on navigation flow being done before that
	must(r.waitUntilTextExists(".title-bar-text", "My creations"))

	r.logf("opening preferences")
	must(r.click(".user-menu"))
	must(r.click("#user-menu-preferences"))
	must(r.waitUntilTextExists(".title-bar-text", "Preferences"))

	r.logf("opening default install location in tab")
	must(r.click(".meat-tab.visible .install-location-row.default .more-actions-button"))
	must(r.click("#context--install-location-navigate"))

	r.logf("making sure our installed game shows up")
	var rowSelector = fmt.Sprintf(".meat-tab.visible .table--row[data-game-id='%d']", testGameID)
	must(r.waitUntilTextExists(rowSelector+" .title--name", testGameName))

	r.takeScreenshot("install location tab")

	r.logf("open it again")
	must(r.click(rowSelector + " .open-game-in-tab"))
	must(r.waitUntilTextExists(".title-bar-text", testGameName))

	r.logf("uninstalling it")
	must(r.waitUntilTextExists(mainActionSelector, "Launch"))
	must(r.click(".meat-tab.visible .manage-game"))
	r.takeScreenshot("managing uploads")
	must(r.click(".manage-cave"))
	must(r.click(".manage-uninstall"))
	must(r.waitUntilTextExists(mainActionSelector, "Install"))
}
