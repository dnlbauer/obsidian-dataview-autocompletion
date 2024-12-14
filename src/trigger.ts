/**
 * Maches parantheses or single square brackets or parantheses
 * and captures the enclosed text
 * If the brackets start a markdown link, they are ignored.
 * Wiki links don't need to be ignored since Obsidian overwrites suggestions for them.
 */
const filledRegex = new RegExp(
    "(" +
        [
            // pattern for parantheses
            // pos. lookbehind for opening parantheses; no closing square bracket before to exlude markdown links
            /(?<=^\(|[^\]]\()/,
            /.+?/,
            // pos. lookahead for closing paranthesis; not followed by another one for nested ((test))
            /(?=\)$|\)[^\)])/,

            /|/,

            // pattern for square brackets
            // pos. lookbehind for opening square bracket
            /(?<=\[)/,
            /.+?/,
            // pos. lookahead for closing bracket; not followed by another one ([[test]]) or an opening paranthese (markdown link!)
            /(?=\]$|\][^\]\(])/,
        ]
            .map((s) => s.source)
            .join("") +
        ")",
    "g",
);

/**
 * Finds the dataview metadata field the user is currently inside.
 * It returns [text, start, end] where text is the text inside the field,
 * and start and end are the cursor positions of the start and end of the field.
 * If the user is not inside a field, it returns null.
 */
export function getTriggerText(line: string, cursorPos: number): [string, number, number] | null {
    let match = getTriggerTextFromRegex(line, cursorPos, filledRegex);
    if (match !== null) {
        return match;
    }
    return null;
}

/**
 * Given a regex with a capture group, a line of text, and the users cursor position,
 * this function finds the match of the regex in the line that the user is currently inside.
 * If the user is inside the capture group, returns [text, start, end] where text is the text inside the match,
 * start is the position of the start of the match, and end is the position of the end of the match.
 * Otherwise, returns null.
 */
function getTriggerTextFromRegex(line: string, cursorPos: number, regex: RegExp): [string, number, number] | null {
    let matches = Array.from(line.matchAll(regex));
    for (const match of matches) {
        console.warn(match);
        if (match.index === undefined) {
            continue;
        }

        const matchStart = match!.index;
        const matchEnd = matchStart + match[1].length;
        const cursorInMatch = cursorPos >= matchStart && cursorPos <= matchEnd;

        if (cursorInMatch) {
            return [match[1], matchStart, matchEnd];
        }
    }
    return null;
}
