# 📺 YouTube Smart Inbox & Playlist Sorter

A Google Sheets and Google Apps Script tool that transforms how you manage your YouTube subscriptions.

Instead of relying on YouTube's default subscription feed, this tool pulls your new videos into a dedicated "Inbox" spreadsheet using RSS (saving API quota). It then uses a lightweight, built-in prediction model to automatically suggest which playlist each video belongs in based on your past viewing habits.

## ✨ Key Features

* **📬 The "Inbox" Workflow:** Review all new videos from your subscriptions in a clean, spreadsheet-based inbox.
* **🧠 Smart AI Suggestions:** The script learns from your history. It analyzes the Channel, Video Duration, and Title Keywords to predict your preferred playlist (or if you usually skip that type of content).
* **⌨️ Keyboard Optimized:** Designed for rapid processing. Use Sheets' built-in autocomplete to assign playlists without ever touching your mouse.
* **🛡️ Quota Protection:** Moving videos via the YouTube API is expensive. This script includes a "Quota Brake" that automatically stops processing at 190 videos to prevent 24-hour API bans.
* **🧹 Self-Cleaning:** Automatically trims your processing history to the most recent 2,000 rows to ensure the prediction model stays fast and relevant to your current tastes.
* **🆓 100% Free & Private:** Runs entirely inside your personal Google Drive. No external servers, no third-party machine learning APIs, and no subscription fees.

---

## 🚀 Setup & Installation

Because this tool relies on a specific spreadsheet structure, the easiest way to install it is to copy the template.

### Step 1: Ensure You Have a YouTube Channel

To use the YouTube Data API to manage playlists and subscriptions, your Google Account must have an active YouTube channel linked to it. If you only have a standard Gmail account and have never created a channel, the API will fail to fetch your data.

1. Go to [YouTube.com](https://www.youtube.com).
2. Click your profile picture in the top right.
3. Click **Create a channel** and follow the prompts. (You do not need to upload any videos).

### Step 2: Copy the Spreadsheet

1. Open the [Template Google Sheet](https://docs.google.com/spreadsheets/d/1vViZ_4MIZoRzacQDzLJWmu8a3gmoNdFvmgKgU_jBqwU/copy)
2. Accept the prompts and save it to whatever location you desire on your Google Drive.

### Step 3: Update the Code with the latest versions from the repository

1. In your new spreadsheet, click **Extensions > Apps Script**.
2. Open the following files and paste the code from this repository into them:
* `Main.gs`
* `Workflow_Fetch.gs`
* `Workflow_Process.gs`
* `Workflow_Predict.gs`
* `Library.gs`

*(Note: The source files in this repository end in `.js`, but within the Google Apps Script web editor, they must be created with `.gs` extensions. Just copy the contents of the corresponding `.js` files.)*

3. **Important:** Click the **Save** icon (disk) at the top.

### Step 4: Enable the YouTube API

1. Still in the Apps Script editor, look at the left sidebar and click the **+** next to **Services**.
2. Scroll down and select **YouTube Data API v3**.
3. Click **Add**.

---

## 📖 How to Use

### 1. Configure Settings

Open the **Settings** tab in your spreadsheet:
* **Playlists:** In Column A (starting at Row 3), type the exact names of the YouTube playlists you want to use (e.g., "Watch Later", "Podcasts", "To Sort"). *The script will automatically find their hidden IDs the first time it runs.*
* **Last Run Time:** In cell **B1**, you can specify a date to fetch videos from (format: `YYYY-MM-DD HH:MM:SS`). If left blank, the script will automatically default to fetching videos from exactly one week ago.

### 2. Fetch New Videos

Click the custom menu at the top of the sheet: **YouTube Tools > 1. Check New Videos**.

* *Note on First Run: Google will show a warning saying "Google hasn’t verified this app." This is normal for personal scripts. Click **Advanced > Go to [Project Name] (unsafe)** to grant your script permission to manage your YouTube account.*

### 3. Triage Your Inbox

Go to the **Videos** tab. The script will highlight its AI suggestions in yellow.  Initially, nothing will be suggested, but this will improve over time.

* Press `Enter` to accept a suggestion.
* Type a new playlist name to override it.
* **Leave the cell blank** if you don't want to watch the video. (The script will learn that you "Discard" this type of content).

### 4. Process and Move

Click **YouTube Tools > 2. Process Selected**.
The script will move the videos to your YouTube playlists, log your choices to the **History** tab (to train the AI for next time), and clear your inbox.

---

## ⚠️ Known Limitations & Quotas

The YouTube Data API provides a free quota of **10,000 units per day**.

* Fetching your subscriptions via RSS costs **0 units**.
* Fetching video durations costs **1 unit** per 50 videos.
* Adding a video to a playlist costs **50 units**.

Because adding videos is so "expensive," **you can only process approximately 200 videos per day.** To protect your account from being locked out, this script has a built-in safety brake that will stop processing at **190 videos**. If you hit this limit, simply wait until the quota resets the next day to process the rest of your inbox.

---

## 📝 License

This project is open-source and available under the MIT License. Feel free to fork, modify, and improve it!

---

## 💻 Local Development & Contributing

For developers who want to contribute to the codebase or run it locally:

1. Clone the repository and install the Node.js dependencies:
   ```bash
   npm install
   ```
2. **Linting:** We enforce strict code quality using ESLint. Before submitting a pull request, ensure your code passes the linter:
   ```bash
   npm run lint
   ```
3. **Deployment:** Code is managed using `clasp`. Changes pushed to the `main` branch are automatically deployed via a GitHub Action.
