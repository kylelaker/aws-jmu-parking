import { formatLexicographicTimestamp } from "./downloader";

describe("Validate datetime formatting", () => {
    const values = [
        {
            date: new Date("2021-12-05T01:01:01"),
            expected: "2021-12-05-01-01-01"
        },
        {
            date: new Date("1992-05-21T05:02:59"),
            expected: "1992-05-21-05-02-59"
        },
        {
            date: new Date("2022-04-20T02:31:46.314"),
            expected: "2022-04-20-02-31-46"
        }
    ]
    it.each(values)("converts known dates properly", async ({ date, expected }) => {
        expect(formatLexicographicTimestamp(date)).toStrictEqual(expected);
    })
});