import {
    App,
    Editor,
    Plugin,
    EditorPosition,
    EditorSuggest,
    EditorSuggestContext,
    EditorSuggestTriggerInfo,
    TFile,
} from "obsidian";
import { getTriggerText } from "./trigger";

export class DataviewSuggester extends EditorSuggest<String> {
    constructor(plugin: Plugin) {
        super(plugin.app);
    }

    onTrigger(
        cursor: EditorPosition,
        editor: Editor,
        file: TFile,
    ): EditorSuggestTriggerInfo | null {
        const line = editor.getLine(cursor.line);

        let trigger = getTriggerText(line, cursor.ch);
        if (trigger !== null) {
            return {
                query: trigger[0],
                start: { line: cursor.line, ch: trigger[1] },
                end: { line: cursor.line, ch: trigger[2] },
            };
        }
        return null;
    }

    getSuggestions(
        context: EditorSuggestContext,
    ): string[] | Promise<string[]> {
        const suggestions: string[] = [];
        // TODO use official dv api?
        // @ts-ignore
        for (const page of this.app.plugins.plugins.dataview.index.pages) {
            const fields = page[1].fields;
            for (let [key, val] of fields) {
                let arrayVal;
                if (!Array.isArray(val)) {
                    arrayVal = [val];
                } else {
                    arrayVal = val;
                }

                for (const value of arrayVal) {
                    // TODO whitespace in match
                    // Fuzzy matching?
                    const suggestion = key + ":: " + value;
                    if (
                        suggestion.includes(context.query) &&
                        !suggestions.includes(suggestion)
                    ) {
                        suggestions.push(key + ":: " + value);
                    }
                }
            }
        }
        console.log(suggestions);
        return suggestions;
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.setText(value);
    }

    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        console.log("selected", value);
        const { editor, start, end } = this.context!;
        editor.replaceRange(value, start, end);

        const newCursorPos = {
            line: end.line + 1,
            ch: 0,
        };
        editor.setCursor(newCursorPos);
    }
}
