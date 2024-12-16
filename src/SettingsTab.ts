import { App, PluginSettingTab, Setting } from "obsidian";
import DataviewAutocompletePlugin from "./main";

export class SettingsTab extends PluginSettingTab {
    plugin: DataviewAutocompletePlugin;

    constructor(app: App, plugin: DataviewAutocompletePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;
        containerEl.empty();

        const excludeDesc = document.createDocumentFragment();
        const link = document.createElement("a");
        link.href = "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions";
        link.text = "Regex patterns";
        excludeDesc.append(link);
        excludeDesc.append(" to exclude field names from suggestions. One pattern per line.");
        new Setting(containerEl)
            .setName("Exclude fields")
            .setDesc(excludeDesc)
            .addTextArea((textArea) => {
                textArea.inputEl.setAttribute("rows", "5");
                textArea
                    .setPlaceholder("created.*\nmodified.*\ndate")
                    .setValue(this.plugin.settings.ignoredFields.join("\n"))
                    .onChange(async (value) => {
                        this.plugin.settings.ignoredFields = value
                            .split("\n")
                            .map((val) => val.trim())
                            .filter((val) => val.length > 0);
                        await this.plugin.saveSettings();
                        this.plugin.suggester?.buildNewIndex();
                    });
            });
        new Setting(containerEl)
            .setName("Exclude files")
            .setDesc("Path pattern to exclude files or folders from suggestions. One pattern per line.")
            .addTextArea((textArea) => {
                textArea.inputEl.setAttribute("rows", "5");
                textArea
                    .setPlaceholder("templates/")
                    .setValue(this.plugin.settings.ignoredFiles.join("\n"))
                    .onChange(async (value) => {
                        this.plugin.settings.ignoredFiles = value
                            .split("\n")
                            .map((val) => val.trim())
                            .filter((val) => val.length > 0);
                        await this.plugin.saveSettings();
                        this.plugin.suggester?.buildNewIndex();
                    });
            });
    }
}
