import {
    App,
    Editor,
    EditorPosition,
    EditorSuggest,
    EditorSuggestContext,
    EditorSuggestTriggerInfo,
    htmlToMarkdown,
    MarkdownRenderer,
    MarkdownView,
    TFile,
} from "obsidian";
import { getTriggerText } from "./trigger";
import uFuzzy from "@leeoniya/ufuzzy";
import DataviewAutocompletePlugin from "./main";
import { SuggestionIndex } from "./SuggestionIndex";

export class DataviewSuggester extends EditorSuggest<String> {
    plugin: DataviewAutocompletePlugin;

    maxSuggestions: number;
    searcher: uFuzzy;
    suggestionsIndex: SuggestionIndex;

    initialized: boolean = false;

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
        this.suggestionsIndex = new SuggestionIndex(plugin);
    }

    override onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
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

    override getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
        const suggestionsList = this.suggestionsIndex.suggestionsList;

        const idxs = this.searcher.filter(suggestionsList, context.query);
        if (idxs != null && idxs.length > 0) {
            let info = this.searcher.info(idxs, suggestionsList, context.query);
            let order = this.searcher.sort(info, suggestionsList, context.query);

            // return top N suggestions with marks
            return order
                .slice(0, this.maxSuggestions)
                .map((idx) => [idx, suggestionsList[info.idx[idx]]])
                .map((suggestion: [number, string]) => uFuzzy.highlight(suggestion[1], info.ranges[suggestion[0]]));
        }
        return [];
    }

    /**
     * Renders a suggestion string to the HTML element using a markdown renderer
     * Uses the context to get the current editor and cursor position and
     * finds out if the suggestion should be rendered with or without the
     * field name.
     */
    renderMarkdownSuggestion(value: string, el: HTMLElement): void {
        // render markdown preview of inline dataview metadata field
        let suggestionText = this.context!.editor.getLine(this.context!.start.line).slice(
            this.context!.start.ch - 1,
            this.context!.start.ch,
        )!;
        suggestionText += value.replace(/<mark>(.*?)<\/mark>/g, "$1");
        suggestionText += suggestionText.startsWith("(") ? ")" : "]";

        // Different rendering for prefix suggestions
        var markdownText;
        if (/.*\:: [\]\)]/.test(suggestionText)) {
            markdownText = htmlToMarkdown("[" + suggestionText.slice(1, -1) + "*…*]");
        } else {
            markdownText = htmlToMarkdown(suggestionText);
        }
        console.log(markdownText);
        MarkdownRenderer.render(
            this.app,
            markdownText,
            el,
            this.context!.file.path,
            this.app.workspace.getActiveViewOfType(MarkdownView)!,
        );
    }

    /**
     * Render the suggestion as markdown source code with highlights
     */
    renderSourceSuggestion(value: string, el: HTMLElement): void {
        // render source text with highlights
        // replaces <mark>...</mark> with <span>...</span>
        const parts = value.split(/(<mark>.*?<\/mark>)/g);
        parts.forEach((textPart) => {
            if (textPart.startsWith("<mark>") && textPart.endsWith("</mark>")) {
                const text = textPart.slice(6, -7); // Remove <mark> and </mark>
                el.createEl("span", { text, cls: "dataview-suggestion-highlight" });
            } else {
                el.appendText(textPart);
            }
        });
    }

    override renderSuggestion(value: string, el: HTMLElement): void {
        const container = el.createDiv("dataview-suggestion-content");
        const titleDiv = container.createDiv("dataview-suggestion-title");
        const noteDiv = container.createDiv("dataview-suggestion-note");

        this.renderMarkdownSuggestion(value, titleDiv);
        this.renderSourceSuggestion(value, noteDiv);
    }

    override selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        // remove marks from selection
        value = value.replace(/<mark>(.*?)<\/mark>/g, "$1");

        const { editor, start, end } = this.context!;
        editor.replaceRange(value, start, end);

        // move cursor to end of suggestion for finished suggestions
        // or to the end of the prefix
        var newCursorPos;
        if (value.endsWith(":: ")) {
            newCursorPos = {
                line: end.line,
                ch: start.ch + value.length,
            };
        } else {
            newCursorPos = {
                line: end.line,
                ch: start.ch + value.length + 1,
            };
        }
        editor.setCursor(newCursorPos);
    }

    public onDataviewIndexReady() {
        this.suggestionsIndex.buildNewIndex();
        this.initialized = true;
    }

    // possible types: update, rename, delete. rename has oldPath
    public onDataviewMetadataChange(type: string, file: TFile, oldPath?: string) {
        if (!this.initialized) {
            // console.warn("Dataview Autocompletion index not ready yet. Skipping index update");
            return;
        }
        this.suggestionsIndex.updateIndex(type, file, oldPath);
    }

    /**
     * Trigger a full rebuild of the suggestion index
     */
    public rebuildIndex() {
        this.suggestionsIndex.buildNewIndex();
    }
}
