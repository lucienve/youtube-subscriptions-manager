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
        addToPlaylist: "readonly",
        getSettingValue: "readonly",
        setSettingValue: "readonly",
        module: "readonly",
        require: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        jest: "readonly",
        global: "readonly"
      }
    },
    plugins: {
      googleappsscript: pluginGoogleappsscript
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          "vars": "local",
          "args": "after-used",
          "varsIgnorePattern": "^(_|onOpen|checkNewVideos|processSelectedVideos|showDeduplicateDialog|getPlaylistNames|deduplicatePlaylist|refreshPlaylistConfig|addToPlaylist|getAllSubscriptions|parseDuration|escapeFormula|getSettingValue|setSettingValue|buildPredictionModel|predictPlaylist|getDurationBucket|getKeywords|SHEET_VIDEOS|SHEET_SETTINGS)$",
          "argsIgnorePattern": "^_"
        }
      ],
      "no-undef": "error"
    }
  }
];
