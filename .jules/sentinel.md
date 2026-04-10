## 2024-04-09 - CSV/Formula Injection Bypass via Whitespace
**Vulnerability:** The existing `escapeFormula` function intended to prevent CSV/Formula injection by prefixing a single quote (`'`) to strings starting with `=`, `+`, `-`, or `@`. However, it did not account for leading whitespace or zero-width characters. An attacker could bypass the filter by supplying `  =IMPORTXML(...)` or `\u200B=CMD(...)`.
**Learning:** Security regexes for formula injection prevention must consume/ignore any leading whitespace and special invisible spacing characters, because Google Sheets (and other spreadsheet tools) will trim them and execute the formula anyway.
**Prevention:** Use a regex like `/^[\s\u200B\uFEFF\xA0]*[=+\-@]/` when checking strings to be written into Google Sheets, ensuring no leading characters can hide the dangerous prefix.

## 2024-04-10 - Prototype Pollution in Data Maps
**Vulnerability:** The codebase uses standard JavaScript objects (`{}`) as data maps for caching or counting dynamically generated keys (e.g., channel IDs, playlist titles). If an external user provides `__proto__` as a key, it can overwrite object prototype properties, leading to prototype pollution vulnerabilities or unexpected runtime behavior.
**Learning:** Using `{}` for maps keyed by arbitrary user input is unsafe because of inherited properties like `__proto__`, `hasOwnProperty`, etc.
**Prevention:** Use `Object.create(null)` when creating map-like structures or dictionaries, which creates an object with no inherited properties and prevents prototype pollution.
