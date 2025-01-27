import { App, TFile } from "obsidian";
import { DataObject, getAPI } from "obsidian-dataview";
import DataviewAutocompletePlugin from "./main";

export class SuggestionIndex {
    plugin: DataviewAutocompletePlugin;

    suggestionsList: string[] = [];
    private suggestionsRefs: Map<string, string[]> = new Map(); // maps file paths to included suggestions
    private suggestionsRefCount: Map<string, number> = new Map(); // maps suggestions to number of files including them

    constructor(plugin: DataviewAutocompletePlugin) {
        this.plugin = plugin;
    }

    public buildNewIndex() {
        // console.log("Begin Rebuilding dataview suggestion index");
        const startTime = performance.now();
        const dataviewApi = getAPI(this.plugin.app);

        const newSuggestions: string[] = [];
        const newSuggestionsRefs: Map<string, string[]> = new Map();
        const newSuggestionsRefCount: Map<string, number> = new Map();

        const files = this.plugin.app.vault.getFiles();
        for (const file of files) {
            if (!this.filterFile(file.path)) {
                continue;
            }

            const page = dataviewApi.page(file.path);
            if (page === undefined) continue; // not a markdown file

            const compositeValues = this.extractCompositeValuesFromPage(page);
            const pageRefs = [];

            for (let compositeValue of compositeValues) {
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
            newSuggestionsRefs.set(file.path, pageRefs);
        }

        // replace old index
        this.suggestionsList = newSuggestions;
        this.suggestionsRefCount = newSuggestionsRefCount;
        this.suggestionsRefs = newSuggestionsRefs;

        const endTime = performance.now();
        // console.log(
        //     `Rebuilt dataview autocomplete index (${this.suggestionsList.length} elements, ${(endTime - startTime).toFixed(2)}ms)`,
        // );
    }

    public updateIndex(type: string, file: TFile, oldPath?: string) {
        // also triggers on create!
        if (type === "update") {
            if (!this.filterFile(file.path)) {
                return;
            }

            const page = getAPI(this.plugin.app).page(file.path);
            if (page === undefined) return; // not a markdown file
            const updateCompositeValues = this.extractCompositeValuesFromPage(page);

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
                if (
                    !this.suggestionsRefCount.has(newCompositeValue) ||
                    this.suggestionsRefCount.get(newCompositeValue) === 0
                ) {
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

    extractCompositeValuesFromPage(page: DataObject): string[] {
        const fields = Object.keys(page)
            .filter((k) => k !== "file")
            .map((k) => [k, page[k]]);

        const compositeValues: string[] = [];

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
                compositeValues.push(compositeValue);
                if (!this.filterCompositeValue(compositeValue)) {
                    continue;
                }
            }
        }
        return compositeValues;
    }

    /**
     * Filters out composite values from suggestions that match any of the ignored fields.
     * @returns true if the value should be shown in suggestions, false otherwise
     */
    filterCompositeValue(compositeValue: string): boolean {
        for (const filterPattern of this.plugin.settings.ignoredFields) {
            const regex = new RegExp(`^(${filterPattern})::.*`);
            if (regex.test(compositeValue)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Converts a Dataview value to a string
     * returns the composite value in format "key:: value"
     */
    formatCompositeValue(key: string, value: any): string {
        const dataviewAPI = getAPI(this.plugin.app);

        let stringValue: string;

        // If the value is a string, number or boolean, we can simply convert it to a string
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            stringValue = value.toString();
        } else if (dataviewAPI.value.typeOf(value) === "link" && value.type === "file") {
            // parse wiki-style links
            if (value.display !== undefined) {
                stringValue = `[[${value.path.split("/").pop().replace(".md", "")}|${value.display}]]`;
            } else {
                stringValue = `[[${value.path.split("/").pop().replace(".md", "")}]]`;
            }
        } else {
            stringValue = dataviewAPI.value.toString(value);
        }
        return `${key}:: ${stringValue}`;
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
}
