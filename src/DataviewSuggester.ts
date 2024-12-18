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
    suggestionsRefs: Map<string, string[]> = new Map(); // maps file paths to included suggestions
    suggestionsRefCount: Map<string, number> = new Map(); // maps suggestions to number of files including them

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
        const idxs = this.searcher.filter(this.suggestionsList, context.query);
        if (idxs != null && idxs.length > 0) {
            let info = this.searcher.info(idxs, this.suggestionsList, context.query);
            let order = this.searcher.sort(info, this.suggestionsList, context.query);

            // return top N suggestions with marks
            return order
                .slice(0, this.maxSuggestions)
                .map((idx) => [idx, this.suggestionsList[info.idx[idx]]])
                .map((suggestion: [number, string]) => uFuzzy.highlight(suggestion[1], info.ranges[suggestion[0]]));
        }
        return [];
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        // Split the value into parts based on the <mark> tags and their content
        const parts = value.split(/(<mark>.*?<\/mark>)/g);

        // We cannot use inner HTML; Create a span for each part
        parts.forEach((part) => {
            if (part.startsWith("<mark>") && part.endsWith("</mark>")) {
                const text = part.slice(6, -7); // Remove <mark> and </mark>
                el.createEl("span", { text, cls: "suggestion-highlight" });
            } else {
                // For normal text, create a text node or <span>
                el.createEl("span", { text: part });
            }
        });
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

    filterCompositeValue(compositeValue: string): boolean {
        for (const filterPattern of this.plugin.settings.ignoredFields) {
            const regex = new RegExp(`^(${filterPattern})::.*`);
            if (regex.test(compositeValue)) {
                return false;
            }
        }
        return true;
    }

    filterFile(filepath: string): boolean {
        for (const filterPattern of this.plugin.settings.ignoredFiles) {
            const regex = new RegExp(filterPattern);
            if (regex.test(filepath)) {
                return false;
            }
        }
        return true;
    }

    buildNewIndex() {
        console.log("Begin Rebuilding dataview suggestion index");
        const startTime = performance.now();
        const dataviewApi = getAPI(this.app);

        const newSuggestions: string[] = [];
        const newSuggestionsRefs: Map<string, string[]> = new Map();
        const newSuggestionsRefCount: Map<string, number> = new Map();

        const files = this.app.vault.getFiles();
        for (const file of files) {
            if (!this.filterFile(file.path)) {
                continue;
            }

            const page = dataviewApi.page(file.path);
            if (page === undefined) continue; // not a markdown file

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
                    if (!this.filterCompositeValue(compositeValue)) {
                        continue;
                    }

                    if (newSuggestions.indexOf(compositeValue) === -1) {
                        // suggestion not seen on any page yet
                        pageRefs.push(compositeValue);
                        newSuggestionsRefCount.set(compositeValue, 1);
                        newSuggestions.push(compositeValue);
                    } else if (pageRefs.indexOf(compositeValue) === -1) {
                        // suggestion not seen on this page, but on another
                        pageRefs.push(compositeValue);
                        newSuggestionsRefCount.set(compositeValue, newSuggestionsRefCount.get(compositeValue)! - 1);
                    }
                }
            }
            newSuggestionsRefs.set(file.path, pageRefs);
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
            if (!this.filterFile(file.path)) {
                return;
            }
            const updateCompositeValues = [];

            const page = getAPI(this.app).page(file.path);
            if (page === undefined) return; // not a markdown file

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
                    if (!this.filterCompositeValue(compositeValue)) {
                        continue;
                    }
                    if (updateCompositeValues.indexOf(compositeValue) === -1) {
                        updateCompositeValues.push(compositeValue);
                    }
                }
            }

            const oldCompositeValues = this.suggestionsRefs.get(file.path) || [];

            // deleting value from index if update reduces refcount to 0
            for (const oldCompositeValue of oldCompositeValues) {
                if (updateCompositeValues.indexOf(oldCompositeValue) === -1) {
                    // delete value
                    this.suggestionsRefCount.set(
                        oldCompositeValue,
                        this.suggestionsRefCount.get(oldCompositeValue)! - 1,
                    );
                    if (this.suggestionsRefCount.get(oldCompositeValue) === 0) {
                        this.suggestionsList.splice(this.suggestionsList.indexOf(oldCompositeValue), 1);
                    }
                }
            }

            // adding value to index if not present in index
            for (const newCompositeValue of updateCompositeValues) {
                if (!this.suggestionsRefCount.has(newCompositeValue)) {
                    // not seen in this or other files
                    this.suggestionsList.push(newCompositeValue);
                    this.suggestionsRefCount.set(newCompositeValue, 1);
                } else if (oldCompositeValues.indexOf(newCompositeValue) === -1) {
                    this.suggestionsRefCount.set(
                        newCompositeValue,
                        this.suggestionsRefCount.get(newCompositeValue)! + 1,
                    );
                }
            }
            this.suggestionsRefs.set(file.path, updateCompositeValues);
        } else if (type === "rename") {
            if (this.filterFile(file.path) && this.filterFile(oldPath!)) {
                // both not ignored -> move refs
                this.suggestionsRefs.set(file.path, this.suggestionsRefs.get(oldPath!)!);
                this.suggestionsRefs.delete(oldPath!);
            } else if (this.filterFile(file.path)) {
                // old path ignored, new path not ignored -> upsert
                this.updateIndex("update", file, undefined);
            } else if (this.filterFile(oldPath!)) {
                // old path not ignored, new path ignored -> delete
                for (const value of this.suggestionsRefs.get(oldPath!)!) {
                    this.suggestionsRefCount.set(value, this.suggestionsRefCount.get(value)! - 1);
                    if (this.suggestionsRefCount.get(value) === 0) {
                        this.suggestionsList.splice(this.suggestionsList.indexOf(value), 1);
                    }
                }
                this.suggestionsRefs.delete(oldPath!);
            }
        } else if (type === "delete") {
            // iterate suggestion refs in deleted file and decrement their ref count
            // if the ref count reaches 0, remove the suggestion from the list
            for (const value of this.suggestionsRefs.get(file.path)!) {
                this.suggestionsRefCount.set(value, this.suggestionsRefCount.get(value)! - 1);
                if (this.suggestionsRefCount.get(value) === 0) {
                    this.suggestionsList.splice(this.suggestionsList.indexOf(value), 1);
                }
            }
            this.suggestionsRefs.delete(file.path);
        } else {
            console.debug("Unknown update type:", type, file, oldPath);
        }
    }
}
