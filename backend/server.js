const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const DEFAULT_FOLDER = path.join(__dirname, "cursos_videos");
const PROGRESS_FILE = path.join(__dirname, "video_progress.json");
const HISTORY_FILE = path.join(__dirname, "video_history.json");

function encodePathComponent(component) {
  return encodeURIComponent(component).replace(/%2F/g, "/");
}

async function getDirectoryStructure(dir, baseDir = "") {
  const structure = {};
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      const relativePath = path.join(baseDir, file.name);
      const encodedPath = encodePathComponent(relativePath);

      if (file.isDirectory()) {
        structure[file.name] = await getDirectoryStructure(
          fullPath,
          relativePath
        );
      } else {
        const ext = path.extname(file.name).toLowerCase();
        if (ext === ".mp4" || ext === ".html") {
          structure[file.name] = {
            type: ext === ".mp4" ? "video" : "html",
            path: encodedPath,
            watched: false, // Añadir propiedad watched
          };
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  return structure;
}

app.post("/api/folder-structure", async (req, res) => {
  try {
    const { folderPath } = req.body;
    const dir = folderPath || DEFAULT_FOLDER;
    const structure = await getDirectoryStructure(dir);
    res.json(structure);
  } catch (error) {
    console.error("Error in /api/folder-structure:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/file/:encodedPath(*)", (req, res) => {
  const filePath = decodeURIComponent(req.params.encodedPath);
  const fullPath = path.join(DEFAULT_FOLDER, filePath);
  res.sendFile(fullPath);
});

app.get("/api/progress", async (req, res) => {
  try {
    const progress = await fs.readFile(PROGRESS_FILE, "utf-8");
    res.json(JSON.parse(progress));
  } catch (error) {
    if (error.code === "ENOENT") {
      res.json({});
    } else {
      console.error("Error reading progress file:", error);
      res.status(500).json({ error: "Error reading progress" });
    }
  }
});

app.post("/api/progress", async (req, res) => {
  try {
    const { path, progress } = req.body;
    let allProgress = {};
    try {
      const existingProgress = await fs.readFile(PROGRESS_FILE, "utf-8");
      allProgress = JSON.parse(existingProgress);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    allProgress[path] = progress;
    await fs.writeFile(PROGRESS_FILE, JSON.stringify(allProgress));
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating progress:", error);
    res.status(500).json({ error: "Error updating progress" });
  }
});

app.get("/api/video-history", async (req, res) => {
  try {
    const history = await fs.readFile(HISTORY_FILE, "utf-8");
    res.json(JSON.parse(history));
  } catch (error) {
    if (error.code === "ENOENT") {
      res.json({});
    } else {
      console.error("Error reading history file:", error);
      res.status(500).json({ error: "Error reading history" });
    }
  }
});

app.post("/api/video-history", async (req, res) => {
  try {
    const { videoPath, isWatched } = req.body;
    let allHistory = {};
    try {
      const existingHistory = await fs.readFile(HISTORY_FILE, "utf-8");
      allHistory = JSON.parse(existingHistory);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    allHistory[videoPath] = isWatched;
    await fs.writeFile(HISTORY_FILE, JSON.stringify(allHistory));
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating history:", error);
    res.status(500).json({ error: "Error updating history" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
