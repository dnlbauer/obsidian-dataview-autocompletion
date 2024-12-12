import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
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
