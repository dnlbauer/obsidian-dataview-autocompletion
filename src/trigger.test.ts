import { getTriggerText } from "./trigger"

describe("test trigger", () => {
    test("testing trigger regex on braces", () => {
        expect(getTriggerText("test string () testing", 13)).toEqual(["", 13, 13])
        expect(getTriggerText("test string (person) testing", 16)).toEqual(["person", 13, 19])
        expect(getTriggerText("test string (person:) testing", 16)).toEqual(["person:", 13, 20])
        expect(getTriggerText("test string (person::) testing", 16)).toEqual(["person::", 13, 21])
        expect(getTriggerText("test string (person::Bob) testing", 16)).toEqual(["person::Bob", 13, 24])
        expect(getTriggerText("test string (person:: Bob) testing", 16)).toEqual(["person:: Bob", 13, 25])
        expect(getTriggerText("test string (person::   Bob) testing", 16)).toEqual(["person::   Bob", 13, 27])
    })

    test("test multiple regex matches in trigger", () => {
        expect(getTriggerText("test() string () testing", 5)).toEqual(["", 5, 5])
        expect(getTriggerText("test() string () testing", 15)).toEqual(["", 15, 15])
        expect(getTriggerText("test() string () testing", 17)).toEqual(null)
    })
})