import { getTriggerText } from "./trigger";

describe("trigger", () => {
    describe("empty", () => {
        test("ignore empty parantheses", () => {
            expect(getTriggerText("() testing", 1)).toEqual(null);
        });
        test("ignore empty square brackets", () => {
            expect(getTriggerText("[] testing", 1)).toEqual(null);
        });
        test("ignore empty square brackets in text", () => {
            expect(getTriggerText("test [] testing", 6)).toEqual(null);
        });
        // Obsidian overrides these matches anyways
        // test("ignore empty double square brackets", () => {
        //     expect(getTriggerText("[[]] testing", 2)).toEqual(null)
        // });
    });

    describe("text in parantheses", () => {
        test("alone", () => {
            expect(getTriggerText("(capture)", 1)).toEqual(["capture", 1, 8]);
        });
        test("text behind", () => {
            expect(getTriggerText("(capture) testing", 1)).toEqual([
                "capture",
                1,
                8,
            ]);
        });
        test("text before", () => {
            expect(getTriggerText("testing (capture)", 12)).toEqual([
                "capture",
                9,
                16,
            ]);
        });
        test("text behind no whitespace", () => {
            expect(getTriggerText("(capture)testing", 1)).toEqual([
                "capture",
                1,
                8,
            ]);
        });
        test("text before no whitespace", () => {
            expect(getTriggerText("test(capture)", 5)).toEqual([
                "capture",
                5,
                12,
            ]);
        });
        test("text before and behind", () => {
            expect(getTriggerText("test (capture) testing", 6)).toEqual([
                "capture",
                6,
                13,
            ]);
        });
        test("with colon", () => {
            expect(getTriggerText("(capture:)", 1)).toEqual(["capture:", 1, 9]);
        });
        test("with double colon", () => {
            expect(getTriggerText("(capture::)", 1)).toEqual([
                "capture::",
                1,
                10,
            ]);
        });
        test("metadata field", () => {
            expect(getTriggerText("(capture::Bob)", 1)).toEqual([
                "capture::Bob",
                1,
                13,
            ]);
        });
        test("metadata field with whitespace", () => {
            expect(getTriggerText("(capture:: Bob)", 1)).toEqual([
                "capture:: Bob",
                1,
                14,
            ]);
        });
        test("metadata field with more white space", () => {
            expect(getTriggerText("(capture::   Bob)", 1)).toEqual([
                "capture::   Bob",
                1,
                16,
            ]);
        });
        test("double field", () => {
            expect(getTriggerText("(capture1)(capture2)", 1)).toEqual([
                "capture1",
                1,
                9,
            ]);
            expect(getTriggerText("(capture1)(capture2)", 11)).toEqual([
                "capture2",
                11,
                19,
            ]);
        });
        test("wiki link", () => {
            expect(getTriggerText("(test [[test]])", 1)).toEqual([
                "test [[test]]",
                1,
                14,
            ]);
            expect(getTriggerText("(test [[test]])", 14)).toEqual([
                "test [[test]]",
                1,
                14,
            ]);
        });
        test("aliased wiki link", () => {
            expect(getTriggerText("(test [[test|display]])", 1)).toEqual([
                "test [[test|display]]",
                1,
                22,
            ]);
            expect(getTriggerText("(test [[test|display]])", 22)).toEqual([
                "test [[test|display]]",
                1,
                22,
            ]);
        });

        test("markdown link", () => {
            expect(getTriggerText("([test](https://example.com))", 1)).toEqual([
                "[test](https://example.com)",
                1,
                28,
            ]);
        });
        test("markdown link local", () => {
            expect(getTriggerText("([test](test))", 1)).toEqual([
                "[test](test)",
                1,
                13,
            ]);
        });
        test("nested parantheses", () => {
            expect(getTriggerText("((test))", 1)).toEqual(["(test)", 1, 7]);
        });
    });

    describe("text in square brackets", () => {
        test("alone", () => {
            expect(getTriggerText("[capture]", 1)).toEqual(["capture", 1, 8]);
        });
        test("text behind", () => {
            expect(getTriggerText("[capture] testing", 1)).toEqual([
                "capture",
                1,
                8,
            ]);
        });
        test("text before", () => {
            expect(getTriggerText("testing [capture]", 12)).toEqual([
                "capture",
                9,
                16,
            ]);
        });
        test("text behind no whitespace", () => {
            expect(getTriggerText("[capture]testing", 1)).toEqual([
                "capture",
                1,
                8,
            ]);
        });
        test("text before no whitespace", () => {
            expect(getTriggerText("test[capture]", 5)).toEqual([
                "capture",
                5,
                12,
            ]);
        });
        test("text before and behind", () => {
            expect(getTriggerText("test [capture] testing", 6)).toEqual([
                "capture",
                6,
                13,
            ]);
        });
        test("with colon", () => {
            expect(getTriggerText("[capture:]", 1)).toEqual(["capture:", 1, 9]);
        });
        test("with double colon", () => {
            expect(getTriggerText("[capture::]", 1)).toEqual([
                "capture::",
                1,
                10,
            ]);
        });
        test("metadata field", () => {
            expect(getTriggerText("[capture::Bob]", 1)).toEqual([
                "capture::Bob",
                1,
                13,
            ]);
        });
        test("metadata field with whitespace", () => {
            expect(getTriggerText("[capture:: Bob]", 1)).toEqual([
                "capture:: Bob",
                1,
                14,
            ]);
        });
        test("metadata field with more white space", () => {
            expect(getTriggerText("[capture::   Bob]", 1)).toEqual([
                "capture::   Bob",
                1,
                16,
            ]);
        });
        test("double field", () => {
            expect(getTriggerText("[capture1][capture2]", 1)).toEqual([
                "capture1",
                1,
                9,
            ]);
            expect(getTriggerText("[capture1][capture2]", 11)).toEqual([
                "capture2",
                11,
                19,
            ]);
        });
        test("wiki link", () => {
            expect(getTriggerText("[test [[test]]]", 1)).toEqual([
                "test [[test]]",
                1,
                14,
            ]);
            expect(getTriggerText("[test [[test]]]", 14)).toEqual([
                "test [[test]]",
                1,
                14,
            ]);
        });
        test("aliased wiki link", () => {
            expect(getTriggerText("[test [[test|display]]]", 1)).toEqual([
                "test [[test|display]]",
                1,
                22,
            ]);
            expect(getTriggerText("[test [[test|display]]]", 22)).toEqual([
                "test [[test|display]]",
                1,
                22,
            ]);
        });
        test("markdown link", () => {
            expect(getTriggerText("[[test](https://example.com)]", 1)).toEqual([
                "[test](https://example.com)",
                1,
                28,
            ]);
        });
        test("markdown link local", () => {
            expect(getTriggerText("[[test](test)]", 1)).toEqual([
                "[test](test)",
                1,
                13,
            ]);
        });
        test("nested parantheses", () => {
            expect(getTriggerText("[(test)]", 1)).toEqual(["(test)", 1, 7]);
        });
    });

    describe("cursor position", () => {
        test("cursor in first field", () => {
            expect(
                getTriggerText("test (test) string (test2) testing", 9),
            ).toEqual(["test", 6, 10]);
        });
        test("cursor in second field", () => {
            expect(
                getTriggerText("test (test) string (test2) testing", 21),
            ).toEqual(["test2", 20, 25]);
        });
        test("ignore cursor out of field", () => {
            expect(
                getTriggerText("test (test) string (test2) testing", 2),
            ).toEqual(null);
        });
    });

    describe("ignore plain markdown links", () => {
        test("cursor in link text", () => {
            expect(getTriggerText("[test](https://example.com)", 3)).toEqual(
                null,
            );
        });
        test("cursor in link url", () => {
            expect(getTriggerText("[test](https://example.com)", 11)).toEqual(
                null,
            );
        });
        test("cursor in empty link text", () => {
            expect(getTriggerText("[](https://example.com)", 1)).toEqual(null);
        });
        test("cursor in empty link url", () => {
            expect(getTriggerText("[test]()", 7)).toEqual(null);
        });
    });
});
