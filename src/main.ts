import { App, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { DataviewSuggester } from "./DataviewSuggester";
import { getAPI, isPluginEnabled } from "obsidian-dataview";
import { SettingsTab } from "./SettingsTab";

interface DataviewAutocompleteSettings {
    ignoredFields: string[];
    ignoredFiles: string[];
}

const DEFAULT_SETTINGS: DataviewAutocompleteSettings = {
    ignoredFields: ["created.*", "modified.*", "date"],
    ignoredFiles: ["templates/"],
};

export default class DataviewAutocompletePlugin extends Plugin {
    settings: DataviewAutocompleteSettings;
    suggester: DataviewSuggester;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new SettingsTab(this.app, this));

        this.suggester = new DataviewSuggester(this, 10, true, true);
        this.registerEditorSuggest(this.suggester);

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

        if (isPluginEnabled(this.app) && getAPI(this.app)?.index.initialized) {
            this.suggester.onDataviewIndexReady();
        }
    }

    onunload() {}

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
