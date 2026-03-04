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

### Step 1: Copy the Spreadsheet

1. Open the [Template Google Sheet](https://www.google.com/FIXME)
2. Click **File > Make a copy** to save it to your personal Google Drive.

### Step 2: Add the Code

1. In your new spreadsheet, click **Extensions > Apps Script**.
2. Delete any default code in the editor.
3. Create the following files and paste the code from this repository into them:
* `Main.gs`
* `Workflow_Fetch.gs`
* `Workflow_Process.gs`
* `Workflow_Predict.gs`
* `Library.gs`


4. **Important:** Click the **Save** icon (disk) at the top.

### Step 3: Enable the YouTube API

1. Still in the Apps Script editor, look at the left sidebar and click the **+** next to **Services**.
2. Scroll down and select **YouTube Data API v3**.
3. Click **Add**.

---

## 📖 How to Use

### 1. Configure Your Playlists

Open the **Settings** tab in your spreadsheet. In Column A (starting at Row 3), type the exact names of the YouTube playlists you want to use (e.g., "Watch Later", "Podcasts", "To Sort"). *The script will automatically find their hidden IDs the first time it runs.*

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

**Next Steps:**
Would you like me to walk you through how to properly set up that public "Template Google Sheet" so users can just click "Make a copy", or do you want to explore using the `clasp` command-line tool next?
