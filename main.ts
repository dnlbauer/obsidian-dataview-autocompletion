import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, EditorChange, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	suggester: DataviewSuggester

	async onload() {
		await this.loadSettings();
	
		// register suggester
		this.suggester = new DataviewSuggester(this);
		this.registerEditorSuggest(this.suggester);

		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}

class DataviewSuggester extends EditorSuggest<String> {
	app: App

	constructor(plugin: Plugin) {
		super(plugin.app)
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile,
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const regex = /\((.*?)\)/g  // todo min characters for match? -> research on best practices
		
		let match
		while((match = regex.exec(line)) !== null) {

			// check if cursor is positioned inside the match
			const cursorInMatch = cursor.ch > match.index && cursor.ch <= match.index + match[1].length + 1
			if (cursorInMatch) {

				return {
					start: { line: cursor.line, ch: match.index+1 },
					end: { line: cursor.line, ch: match.index + match[1].length+1 },
					query: match[1],
				};
			}

		} 
		return null;
	}

	getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
		const suggestions: string[] = []
		// TODO use official dv api?
		// @ts-ignore
		for (const page of this.app.plugins.plugins.dataview.index.pages) {
			const fields = page[1].fields
			for (let [key, val] of fields) {
				let arrayVal
				if (!Array.isArray(val)) {
					arrayVal = [val]
				} else {
					arrayVal = val
				}

				for (const value of arrayVal) {
					// TODO whitespace in match
					// Fuzzy matching?
					const suggestion = key + ":: " + value
					if (suggestion.includes(context.query) && !suggestions.includes(suggestion)) {
						suggestions.push(key+ ":: " + value)
					}
				}
			}

		}
		console.log(suggestions)
		return suggestions
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value)
	}

	selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
		console.log("selected", value)
		const { editor, start, end } = this.context!;
		editor.replaceRange(value, start, end);

		const newCursorPos = {
			line: end.line + 1,
			ch: 0,
		};
		editor.setCursor(newCursorPos);
	}
}
