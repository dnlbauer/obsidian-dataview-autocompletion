const triggerRegex = /\((.*?)\)/g

export function getTriggerText(line: string, cursorPos: number): [string, number, number] | null {
    triggerRegex.lastIndex = 0  // resetting global regex
    
    let match = null
    while ((match = triggerRegex.exec(line)) !== null) {
        const cursorInMatch = cursorPos > match.index && cursorPos <= match.index + match[1].length + 1

        if (cursorInMatch) {
            return [match[1], match.index+1, match.index + match[1].length + 1]
        }

    }
    return null

}