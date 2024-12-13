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
import { getAPI, DataviewApi } from "obsidian-dataview";

export class DataviewSuggester extends EditorSuggest<String> {
    suggestionsList: string[] = [];
    maxSuggestions: number;
    searcher: uFuzzy;
    dataviewApi: DataviewApi;

    constructor(
        plugin: Plugin,
        maxSuggestions: number = 10,
        singleErrorMode: boolean = false,
        allowExtraChars: boolean = false,
    ) {
        super(plugin.app);
        this.maxSuggestions = maxSuggestions;
        this.searcher = new uFuzzy({
            intraMode: singleErrorMode ? 1 : 0,
            intraIns: allowExtraChars ? 1 : 0,
        });
        this.dataviewApi = getAPI(plugin.app);
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

            // return top N suggestions with marks
            return order
                .slice(0, this.maxSuggestions)
                .map((idx) => [idx, this.suggestionsList[info.idx[idx]]])
                .map((suggestion: [number, string]) =>
                    uFuzzy.highlight(suggestion[1], info.ranges[suggestion[0]]),
                );
        }
        return [];
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        // replace marks with bold
        const formattedHtml = value.replace(
            /<mark>(.*?)<\/mark>/g,
            '<span style="font-weight: bold;">$1</span>',
        );
        el.innerHTML = formattedHtml;
    }

    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        const { editor, start, end } = this.context!;
        // remove marks from selection
        value = value.replace(/<mark>(.*?)<\/mark>/g, "$1");
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
                    if (value === null || value === undefined) continue; // skip empty fields

                    // Convert value to string representation
                    let stringValue: string;
                    if (
                        typeof value === "string" ||
                        typeof value === "number" ||
                        typeof value === "boolean"
                    ) {
                        stringValue = value.toString();
                    } else if (
                        this.dataviewApi.value.typeOf(value) === "link" &&
                        value.type === "file" &&
                        value.display !== undefined
                    ) {
                        // value.toString always adds a display value to wiki-style links.
                        // parse wiki-style links without display value manually here to prevent this from happening for [[filename]]
                        stringValue = `[[${value.path.split("/").pop().replace(".md", "")}]]`;
                    } else {
                        stringValue = this.dataviewApi.value.toString(value);
                    }

                    const compositeValue = `${key}:: ${stringValue}`;
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
