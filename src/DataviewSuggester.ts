import {
    App,
    Editor,
    EditorPosition,
    EditorSuggest,
    EditorSuggestContext,
    EditorSuggestTriggerInfo,
    TFile,
} from "obsidian";
import { getTriggerText } from "./trigger";
import uFuzzy from "@leeoniya/ufuzzy";
import { getAPI, DataviewApi } from "obsidian-dataview";
import DataviewAutocompletePlugin from "./main";

export class DataviewSuggester extends EditorSuggest<String> {
    plugin: DataviewAutocompletePlugin;

    maxSuggestions: number;
    searcher: uFuzzy;

    initialized: boolean = false;
    suggestionsList: string[] = [];
    suggestionsRefs: { [key: string]: string[] } = {}; // maps file paths to included suggestions
    suggestionsRefCount: { [key: string]: number } = {}; // maps suggestions to number of files including them

    constructor(
        plugin: DataviewAutocompletePlugin,
        maxSuggestions: number = 10,
        singleErrorMode: boolean = false,
        allowExtraChars: boolean = false,
    ) {
        super(plugin.app);
        this.plugin = plugin;
        this.maxSuggestions = maxSuggestions;
        this.searcher = new uFuzzy({
            intraMode: singleErrorMode ? 1 : 0,
            intraIns: allowExtraChars ? 1 : 0,
        });
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
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

    getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
        // TODO: add filter at index-time?
        let filtered = this.suggestionsList;
        for (const filterPattern of this.plugin.settings.ignoredFields) {
            const regex = new RegExp(`^(${filterPattern})::.*`);
            const ignoredSuggestions = filtered.filter((suggestion) => regex.test(suggestion));
            // minimatch.match(filtered, filterPattern + ":: *", { partial: true })
            for (const ignoredSuggestion of ignoredSuggestions) {
                filtered = filtered.slice(filtered.indexOf(ignoredSuggestion) + 1);
            }
        }

        const idxs = this.searcher.filter(filtered, context.query);
        if (idxs != null && idxs.length > 0) {
            let info = this.searcher.info(idxs, filtered, context.query);
            let order = this.searcher.sort(info, filtered, context.query);

            // return top N suggestions with marks
            return order
                .slice(0, this.maxSuggestions)
                .map((idx) => [idx, filtered[info.idx[idx]]])
                .map((suggestion: [number, string]) => uFuzzy.highlight(suggestion[1], info.ranges[suggestion[0]]));
        }
        return [];
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        // replace marks with bold
        const formattedHtml = value.replace(/<mark>(.*?)<\/mark>/g, '<span style="font-weight: bold;">$1</span>');
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

    public onDataviewIndexReady() {
        this.buildNewIndex();
        this.initialized = true;
    }

    // possible types: update, rename, delete. rename has oldPath
    public onDataviewMetadataChange(type: string, file: TFile, oldPath?: string) {
        if (!this.initialized) {
            // console.warn("Dataview Autocompletion index not ready yet. Skipping index update");
            return;
        }
        this.updateIndex(type, file, oldPath);
    }

    /**
     * Converts a Dataview value to a string
     * returns the composite value in format "key:: value"
     */
    formatCompositeValue(key: string, value: any): string {
        const dataviewAPI = getAPI(this.app);

        let stringValue: string;

        // If the value is a string, number or boolean, we can simply convert it to a string
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            stringValue = value.toString();
        } else if (dataviewAPI.value.typeOf(value) === "link" && value.type === "file" && value.display !== undefined) {
            // value.toString always adds a display value to wiki-style links.
            // parse wiki-style links without display value manually here to prevent this from happening for [[filename]]
            stringValue = `[[${value.path.split("/").pop().replace(".md", "")}]]`;
        } else {
            stringValue = dataviewAPI.value.toString(value);
        }

        return `${key}:: ${stringValue}`;
    }

    buildNewIndex() {
        console.log("Begin Rebuilding dataview suggestion index");
        const startTime = performance.now();
        const dataviewApi = getAPI(this.app);

        const newSuggestions: string[] = [];
        const newSuggestionsRefs: { [key: string]: string[] } = {};
        const newSuggestionsRefCount: { [key: string]: number } = {};

        const files = this.app.vault.getFiles();
        for (const file of files) {
            const page = dataviewApi.page(file.path);
            const fields = Object.keys(page)
                .filter((k) => k !== "file")
                .map((k) => [k, page[k]]);

            const pageRefs = [];

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

                    let compositeValue = this.formatCompositeValue(key, value);

                    if (newSuggestions.indexOf(compositeValue) === -1) {
                        // suggestion not seen on any page yet
                        pageRefs.push(compositeValue);
                        newSuggestionsRefCount[compositeValue] = 1;
                        newSuggestions.push(compositeValue);
                    } else if (pageRefs.indexOf(compositeValue) === -1) {
                        // suggestion not seen on this page, but on another
                        pageRefs.push(compositeValue);
                        newSuggestionsRefCount[compositeValue] + -1;
                    }
                }
            }
            newSuggestionsRefs[file.path] = pageRefs;
        }

        // replace old index
        this.suggestionsList = newSuggestions;
        this.suggestionsRefCount = newSuggestionsRefCount;
        this.suggestionsRefs = newSuggestionsRefs;

        const endTime = performance.now();
        console.log(
            `Rebuilt dataview autocomplete index (${this.suggestionsList.length} elements, ${(endTime - startTime).toFixed(2)}ms)`,
        );
    }

    updateIndex(type: string, file: TFile, oldPath?: string) {
        // also triggers on create!
        if (type === "update") {
            const updateCompositeValues = [];

            const page = getAPI(this.app).page(file.path);
            const fields = Object.keys(page)
                .filter((k) => k !== "file")
                .map((k) => [k, page[k]]);
            for (let [key, val] of fields) {
                // fields can be a single value or a dict, so we need to handle both
                let arrayVal;
                if (!Array.isArray(val)) {
                    arrayVal = [val];
                } else {
                    arrayVal = val;
                }

                for (const value of arrayVal) {
                    if (value === null || value === undefined) continue; // skip empty fields

                    let compositeValue = this.formatCompositeValue(key, value);
                    if (updateCompositeValues.indexOf(compositeValue) === -1) {
                        updateCompositeValues.push(compositeValue);
                    }
                }
                for (const compositeValue of this.suggestionsRefs[file.path]) {
                    if (updateCompositeValues.indexOf(compositeValue) === -1) {
                        // delete value
                        this.suggestionsRefCount[compositeValue] -= 1;
                        if (this.suggestionsRefCount[compositeValue] == 0) {
                            this.suggestionsList.splice(this.suggestionsList.indexOf(compositeValue), 1);
                        }
                    }
                }
                for (const newCompositeValue of updateCompositeValues) {
                    if (this.suggestionsRefs[file.path].indexOf(newCompositeValue) === -1) {
                        // add value (also check presence in other files via refcount first)
                        if (this.suggestionsList.indexOf(newCompositeValue) === -1) {
                            this.suggestionsList.push(newCompositeValue);
                            this.suggestionsRefCount[newCompositeValue] += 1;
                        }
                    }
                }
            }
            this.suggestionsRefs[file.path] = updateCompositeValues;
        } else if (type === "rename") {
            this.suggestionsRefs[file.path] = this.suggestionsRefs[oldPath!];
            delete this.suggestionsRefs[oldPath!];
        } else if (type === "delete") {
            // iterate suggestion refs in deleted file and decrement their ref count
            // if the ref count reaches 0, remove the suggestion from the list
            for (const value of this.suggestionsRefs[file.path]) {
                this.suggestionsRefCount[value] -= 1;
                if (this.suggestionsRefCount[value] == 0) {
                    this.suggestionsList.splice(this.suggestionsList.indexOf(value), 1);
                }
            }
            delete this.suggestionsRefs[file.path];
        } else {
            console.warn("Unknown update type:", type, file, oldPath);
        }
    }
}
