const pluginGoogleappsscript = require("eslint-plugin-googleappsscript");
const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    ignores: ["eslint.config.js"]
  },
  {
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...pluginGoogleappsscript.environments.googleappsscript.globals,
        SHEET_SETTINGS: "readonly",
        SHEET_VIDEOS: "readonly",
        refreshPlaylistConfig: "readonly",
        buildPredictionModel: "readonly",
        getAllSubscriptions: "readonly",
        parseDuration: "readonly",
        predictPlaylist: "readonly",
        escapeFormula: "readonly",
        addToPlaylist: "readonly"
      }
    },
    plugins: {
      googleappsscript: pluginGoogleappsscript
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "error"
    }
  }
];
