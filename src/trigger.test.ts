import { getTriggerText } from "./trigger"

describe("trigger", () => {
    describe("empty", () => {
        test("empty parantheses", () => {
            expect(getTriggerText("() testing", 1)).toEqual(["", 1, 1])
        })
        test("empty square brackets", () => {
            expect(getTriggerText("[] testing", 1)).toEqual(["", 1, 1])
        })
        test("empty square brackets in text", () => {
            expect(getTriggerText("test [] testing", 6)).toEqual(["", 6, 6])
        })
        // test("not match empty double square brackets", () => {
        //     expect(getTriggerText("[[]] testing", 2)).toEqual(null)
        // })
        test("multiple empty brackets in text", () => {
            expect(getTriggerText("test [] and [] testing", 13)).toEqual(["", 13, 13])
        })
    })

    describe("text in parantheses", () => {
        test("text behind", () => {
            expect(getTriggerText("(capture) testing", 1)).toEqual(["capture", 1, 8])
        })
        test("text before", () => {
            expect(getTriggerText("testing (capture)", 12)).toEqual(["capture", 9, 16])
        })
        test("text behind no whitespace", () => {
            expect(getTriggerText("(capture)testing", 1)).toEqual(["capture", 1, 8])
        })
        test("text before no whitespace", () => {
            expect(getTriggerText("test(capture)", 5)).toEqual(["capture", 5, 12])
        })
        test("text before and behind", () => {
            expect(getTriggerText("test (capture) testing", 6)).toEqual(["capture", 6, 13])
        })
        test("text and colon", () => {
            expect(getTriggerText("(capture:) testing", 1)).toEqual(["capture:", 1, 9])
        })
        test("text and double colon", () => {
            expect(getTriggerText("(capture::) testing", 1)).toEqual(["capture::", 1, 10])
        })
        test("metadata field", () => {
            expect(getTriggerText("(capture::Bob) testing", 1)).toEqual(["capture::Bob", 1, 13])
        })
        test("metadata field with whitespace", () => {
            expect(getTriggerText("(capture:: Bob) testing", 1)).toEqual(["capture:: Bob", 1, 14])
        })
        test("metadata field with more white space", () => {
            expect(getTriggerText("(capture::   Bob) testing", 1)).toEqual(["capture::   Bob", 1, 16])
        })
        test("text with markdown link", () => {
            expect(getTriggerText("([[test]]) testing", 1)).toEqual(["[[test]]", 1, 9])
        })
        test("text with aliased markdown link", () => {
            expect(getTriggerText("([[test|display]]) testing", 1)).toEqual(["[[test|display]]", 1, 17])
        })
        test("text with wiki link", () => {
            expect(getTriggerText("([[test](https://example.com)]) testing", 1)).toEqual(["[[test](https://example.com)]", 1, 30])
        })
        test("text with wiki link local", () => {
            expect(getTriggerText("([[test](test)]) testing", 1)).toEqual(["[[test](test)]", 1, 15])
        })
    })

    describe("text in square brackets", () => {
        test("text behind", () => {
            expect(getTriggerText("[capture] testing", 1)).toEqual(["capture", 1, 8])
        })
        test("text before", () => {
            expect(getTriggerText("testing [capture]", 12)).toEqual(["capture", 9, 16])
        })
        test("text behind no whitespace", () => {
            expect(getTriggerText("[capture]testing", 1)).toEqual(["capture", 1, 8])
        })
        test("text before no whitespace", () => {
            expect(getTriggerText("test[capture]", 5)).toEqual(["capture", 5, 12])
        })
        test("text before and behind", () => {
            expect(getTriggerText("test [capture] testing", 6)).toEqual(["capture", 6, 13])
        })
        test("text and colon", () => {
            expect(getTriggerText("[capture:] testing", 1)).toEqual(["capture:", 1, 9])
        })
        test("text and double colon", () => {
            expect(getTriggerText("[capture::] testing", 1)).toEqual(["capture::", 1, 10])
        })
        test("metadata field", () => {
            expect(getTriggerText("[capture::Bob] testing", 1)).toEqual(["capture::Bob", 1, 13])
        })
        test("metadata field with whitespace", () => {
            expect(getTriggerText("[capture:: Bob] testing", 1)).toEqual(["capture:: Bob", 1, 14])
        })
        test("metadata field with more white space", () => {
            expect(getTriggerText("[capture::   Bob] testing", 1)).toEqual(["capture::   Bob", 1, 16])
        })
        test("text with markdown link", () => {
            expect(getTriggerText("[[[test]]] testing", 1)).toEqual(["[[test]]", 1, 9])
        })
        test("text with aliased markdown link", () => {
            expect(getTriggerText("[[[test|display]]] testing", 1)).toEqual(["[[test|display]]", 1, 17])
        })
        test("text with wiki link", () => {
            expect(getTriggerText("[[[test](https://example.com)]] testing", 1)).toEqual(["[[test](https://example.com)]", 1, 30])
        })
        test("text with wiki link local", () => {
            expect(getTriggerText("[[[test](test)]] testing", 1)).toEqual(["[[test](test)]", 1, 15])
        })
    })

    describe("cursor position", () => {
        test("cursor in first field", () => {
            expect(getTriggerText("test (test) string (test2) testing", 9)).toEqual(["test", 6, 10])
        })
        test("cursor in second field", () => {
            expect(getTriggerText("test (test) string (test2) testing", 21)).toEqual(["test2", 20, 25])
        })
        test("ignore cursor out of field", () => {
            expect(getTriggerText("test (test) string (test2) testing", 2)).toEqual(null)
        })
    })

    describe("ignore plain markdown links", () => {
        test("cursor in link text", () => {
            expect(getTriggerText("test [test](https://example.com)", 8)).toEqual(null)
        })
        test("cursor in link url", () => {
            expect(getTriggerText("test [test](https://example.com)", 15)).toEqual(null)
        })
        test("cursor in empty link text", () => {
            expect(getTriggerText("test [](https://example.com)", 6)).toEqual(null)
        })
        test("cursor in empty link url", () => {
            expect(getTriggerText("test [test]()", 12)).toEqual(null)
        })
    })

})
