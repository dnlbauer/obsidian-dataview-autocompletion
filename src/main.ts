import { App, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { DataviewSuggester } from "./DataviewSuggester";

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

        // register suggester
        this.suggester = new DataviewSuggester(this);
        this.registerEditorSuggest(this.suggester);

        this.registerEvent(
            // @ts-ignore
            this.app.metadataCache.on("dataview:index-ready", () => {
                this.suggester.buildNewIndex();
            }),
        );

        this.registerEvent(
            this.app.metadataCache.on(
                // @ts-ignore
                "dataview:metadata-change",
                (type: string, file: TFile, oldPath?: string) => {
                    this.suggester.onMetadataChange(type, file, oldPath);
                },
            ),
        );
    }

    onunload() {}

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData(),
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
