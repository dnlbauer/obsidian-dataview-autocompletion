import { App, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { DataviewSuggester } from "./DataviewSuggester";
import { getAPI } from "obsidian-dataview";

interface DataviewAutocompleteSettings {
    // mySetting: string;
}

const DEFAULT_SETTINGS: DataviewAutocompleteSettings = {
    // mySetting: 'default'
};

export default class DataviewAutocompletePlugin extends Plugin {
    settings: DataviewAutocompleteSettings;
    suggester: DataviewSuggester;

    async onload() {
        await this.loadSettings();

        this.registerEvent(
            // @ts-ignore
            this.app.metadataCache.on("dataview:index-ready", () => {
                this.suggester.onDataviewIndexReady();
            }),
        );

        this.registerEvent(
            this.app.metadataCache.on(
                // @ts-ignore
                "dataview:metadata-change",
                (type: string, file: TFile, oldPath?: string) => {
                    this.suggester.onDataviewMetadataChange(type, file, oldPath);
                },
            ),
        );

        this.app.workspace.onLayoutReady(() => {
            // @ts-ignore
            if (!Object.keys(this.app.plugins.plugins).includes("dataview")) {
                console.warn("Dataview plugin not installed. Dataview Autocompletion plugin will not work.");
            } else {
                // register suggester, requires dataview to be loaded first.
                console.log("Registering dataview autocompletion suggester");
                this.suggester = new DataviewSuggester(this, 10, true, true);
                this.registerEditorSuggest(this.suggester);
            }
        });
    }

    onunload() {}

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
