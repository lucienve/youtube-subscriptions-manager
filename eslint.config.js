const pluginGoogleappsscript = require("eslint-plugin-googleappsscript");
const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    ignores: ["eslint.config.js"]
  },
  {
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...pluginGoogleappsscript.environments.googleappsscript.globals,
        SHEET_SETTINGS: "readonly",
        SHEET_VIDEOS: "readonly",
        SHEET_HISTORY: "readonly",
        isQuotaExceededError: "readonly",
        refreshPlaylistConfig: "readonly",
        buildPredictionModel: "readonly",
        getAllSubscriptions: "readonly",
        parseDuration: "readonly",
        predictPlaylist: "readonly",
        escapeFormula: "readonly",
        addToPlaylist: "readonly",
        getSettingValue: "readonly",
        setSettingValue: "readonly",
        getDeleteRanges: "readonly",
        DESTINATION_TRASH: "readonly",
        showMoveByChannelDialog: "readonly",
        getUserPlaylists: "readonly",
        aggregateChannelsFromPlaylistItems: "readonly",
        filterPlaylistItemsToMove: "readonly",
        getSourcePlaylistChannels: "readonly",
        moveVideosByChannel: "readonly",
        module: "readonly"
      }
    },
    plugins: {
      googleappsscript: pluginGoogleappsscript
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      "no-unused-vars": [
        "error",
        {
          "vars": "local",
          "args": "after-used",
          "varsIgnorePattern": "^(_|onOpen|checkNewVideos|processSelectedVideos|showDeduplicateDialog|getPlaylistNames|deduplicatePlaylist|refreshPlaylistConfig|addToPlaylist|getAllSubscriptions|parseDuration|escapeFormula|getSettingValue|setSettingValue|buildPredictionModel|predictPlaylist|getDurationBucket|getKeywords|SHEET_VIDEOS|SHEET_SETTINGS|SHEET_HISTORY|isQuotaExceededError|getDeleteRanges|DESTINATION_TRASH|showMoveByChannelDialog|getUserPlaylists|aggregateChannelsFromPlaylistItems|filterPlaylistItemsToMove|getSourcePlaylistChannels|moveVideosByChannel)$",
          "argsIgnorePattern": "^_"
        }
      ],
      "no-undef": "error"
    }
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        require: "readonly",
        module: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        jest: "readonly",
        global: "readonly"
      }
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      "no-unused-vars": [
        "error",
        {
          "vars": "local",
          "args": "after-used",
          "argsIgnorePattern": "^_"
        }
      ],
      "no-undef": "error"
    }
  }
];
