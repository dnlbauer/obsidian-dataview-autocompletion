/**
 * Matches single square bracket pair [] or parahtheses (), but not a double square bracket pair [[]]
 * (?<!\[)     # Negative lookbehind to make sure there is no second [
 * \[]         # Matches [] 
 * (?![\]\(])  # Negative lookahead to make sure there is no second closing ] from wiki link or opening ( from a markdown link
 * |           # OR
 * (?<!\])     # Negative lookbehind to make sure there is no closing ] from a markdown link
 * \(\)        # Matches ()
 */
const emptyRegex = /(?<!\[)\[](?![\]\(])|(?<!\])\(\)/g

/**
 * Maches single square brackets or parantheses with some text in them
 * and captures the text
 * If the brackets start a wiki link or markdown link, they are ignored
 * but links inside another layer of brackets are returned:
 * 
 * (
 *   (?<=^\(|\s\()   # Pattern for parantheses
 *     .+?:{0,2}.*?
 *   (?=\)$|\)\s)
 *   |
 *   (?<=^\[|\s\[)   # Pattern for square brackets
 *     .+?:{0,2}.*?
 *   (?=\]$|\]\s)
 * )
 */
const filledRegex = /((?<=^\(|\s\().+?:{0,2}.*?(?=\)$|\)\s)|(?<=^\[|\s\[).+?:{0,2}.*?(?=\]$|\]\s))/g

/**
 * Finds the dataview metadata field the user is currently inside.
 * It returns [text, start, end] where text is the text inside the field,
 * and start and end are the cursor positions of the start and end of the field.
 * If the user is not inside a field, it returns null.
 */
export function getTriggerText(line: string, cursorPos: number): [string, number, number] | null {
    // Check for empty [] or ().
    // If the user starts typing with no text in the field, this is the fastest way to find it.
    let match = getEmptyTrigger(line, cursorPos)
    if (match) {
        return match
    }

    // If the user types inside an existing field, this is the function to find it.
    match = getTriggerTextFromRegex(line, cursorPos, filledRegex)
    if (match !== null) {
        return match
    }
    return null
}

/**
 * Matches an empty [] or empty (), but not [[]]
 * Has its own function since there is no capture group resulting in a different index calculation
 */
function getEmptyTrigger(line: string, cursorPos: number): [string, number, number] | null {
    let matches = Array.from(line.matchAll(emptyRegex))
    for (const match of matches) {
        if (match.index === undefined) {
            continue
        }

        if (cursorPos === match.index+1) {
            return ["", match.index+1, match.index+1]
        }
    }
    return null
}

/**
 * Given a regex with a capture group, a line of text, and the users cursor position,
 * this function finds the match of the regex in the line that the user is currently inside.
 * If the user is inside the capture group, returns [text, start, end] where text is the text inside the match,
 * start is the position of the start of the match, and end is the position of the end of the match.
 * Otherwise, returns null.
 */
function getTriggerTextFromRegex(line: string, cursorPos: number, regex: RegExp): [string, number, number] | null {
    let matches = Array.from(line.matchAll(regex))
    for (const match of matches) {
        if (match.index === undefined) {
            continue
        }

        const matchStart = match!.index
        const matchEnd = matchStart + match[1].length
        const cursorInMatch = cursorPos >= matchStart && cursorPos <= matchEnd

        if (cursorInMatch) {
            return [match[1], matchStart, matchEnd]
        }
    }
    return null
}
