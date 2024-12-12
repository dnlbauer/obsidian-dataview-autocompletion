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
import uFuzzy from "@leeoniya/ufuzzy";

export class DataviewSuggester extends EditorSuggest<String> {
    suggestionsList: string[] = [];
    searcher: uFuzzy = new uFuzzy({});

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
        let idxs = this.searcher.filter(this.suggestionsList, context.query);
        if (idxs != null && idxs.length > 0) {
            let info = this.searcher.info(
                idxs,
                this.suggestionsList,
                context.query,
            );
            let order = this.searcher.sort(
                info,
                this.suggestionsList,
                context.query,
            );

            return order.map((i) => this.suggestionsList[info.idx[i]]);
        }
        return [];
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.setText(value);
    }

    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        const { editor, start, end } = this.context!;
        editor.replaceRange(value, start, end);

        const newCursorPos = {
            line: end.line + 1,
            ch: 0,
        };
        editor.setCursor(newCursorPos);
    }

    public buildNewIndex() {
        console.log("Rebuilding dataview suggestion index");
        const newSuggestions: string[] = [];

        // Iterate all pages of the Dataview index, and ingest all fields into suggestions
        // TODO: can we use official dataview api?
        // @ts-ignore
        for (const page of this.app.plugins.plugins.dataview.index.pages) {
            const fields = page[1].fields;
            for (let [key, val] of fields) {
                // fields can be a single value or a dict, so we need to handle both
                let arrayVal;
                if (!Array.isArray(val)) {
                    arrayVal = [val];
                } else {
                    arrayVal = val;
                }

                // Add composite value "key:: value" to suggestions list
                for (const value of arrayVal) {
                    const compositeValue = key + ":: " + value;
                    if (newSuggestions.indexOf(compositeValue) === -1) {
                        newSuggestions.push(compositeValue);
                    }
                }
            }
        }

        // replace old index
        this.suggestionsList = newSuggestions;
    }

    // possible types: update, rename, delete. rename has oldPath
    public onMetadataChange(type: string, file: TFile, oldPath?: string) {
        // TODO handle efficiently with delta updates
        this.buildNewIndex();
    }
}
