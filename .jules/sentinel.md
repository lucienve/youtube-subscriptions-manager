## 2024-04-09 - CSV/Formula Injection Bypass via Whitespace
**Vulnerability:** The existing `escapeFormula` function intended to prevent CSV/Formula injection by prefixing a single quote (`'`) to strings starting with `=`, `+`, `-`, or `@`. However, it did not account for leading whitespace or zero-width characters. An attacker could bypass the filter by supplying `  =IMPORTXML(...)` or `\u200B=CMD(...)`.
**Learning:** Security regexes for formula injection prevention must consume/ignore any leading whitespace and special invisible spacing characters, because Google Sheets (and other spreadsheet tools) will trim them and execute the formula anyway.
**Prevention:** Use a regex like `/^[\s\u200B\uFEFF\xA0]*[=+\-@]/` when checking strings to be written into Google Sheets, ensuring no leading characters can hide the dangerous prefix.

## 2024-05-18 - [Fix Prototype Pollution in Prediction Model]
**Vulnerability:** Arbitrary user inputs (channel names, playlists, titles) from Google Sheets were used directly as object keys in map-like structures (e.g., `model.channelStats[channel] = {}`), creating a risk for global prototype pollution if an input such as `__proto__` was provided.
**Learning:** Standard object literals (`{}`) inherit properties from `Object.prototype`, and directly passing user inputs as keys without sanitization exposes the application to object injection and prototype pollution, potentially altering program logic or security checks.
**Prevention:** Always create map-like structures or dictionaries from arbitrary user input using `Object.create(null)` so they do not inherit from `Object.prototype`, and explicitly cast user inputs to strings using `String()` when they are used as object keys.
