import axios from "axios";

const VIDEO_HISTORY_KEY = "videoHistory";

export const videoHistoryService = {
  async fetchHistory() {
    try {
      const response = await axios.get(
        "http://localhost:3001/api/video-history"
      );
      const history = response.data;
      localStorage.setItem(VIDEO_HISTORY_KEY, JSON.stringify(history));
      return history;
    } catch (error) {
      console.error("Error fetching video history:", error);
      return {};
    }
  },

  async updateHistory(videoPath, isWatched) {
    try {
      const history = JSON.parse(localStorage.getItem(VIDEO_HISTORY_KEY)) || {};
      history[videoPath] = isWatched;
      localStorage.setItem(VIDEO_HISTORY_KEY, JSON.stringify(history));

      await axios.post("http://localhost:3001/api/video-history", {
        videoPath,
        isWatched,
      });

      return history;
    } catch (error) {
      console.error("Error updating video history:", error);
      return null;
    }
  },

  getLocalHistory() {
    return JSON.parse(localStorage.getItem(VIDEO_HISTORY_KEY)) || {};
  },

  isVideoWatched(videoPath) {
    const history = this.getLocalHistory();
    return !!history[videoPath];
  },
};
