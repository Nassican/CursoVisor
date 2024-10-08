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

async function readProgressFile() {
  try {
    const data = await fs.readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

// Función para escribir en el archivo de progreso
async function writeProgressFile(data) {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

app.post("/api/folder-structure", async (req, res) => {
  try {
    const { folderPath } = req.body;
    const dir = folderPath
      ? path.join(DEFAULT_FOLDER, folderPath)
      : DEFAULT_FOLDER;
    console.log("Requesting folder structure for:", dir); // Confirma esta ruta
    const structure = await getDirectoryStructure(dir);
    res.json(structure);
  } catch (error) {
    console.error("Error in /api/folder-structure:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/file/:encodedPath(*)", (req, res) => {
  // Decodifica la ruta del archivo correctamente
  const filePath = decodeURIComponent(req.params.encodedPath);
  // Crea el fullPath sin duplicar 'DEFAULT_FOLDER'
  const fullPath = path.join(DEFAULT_FOLDER, filePath);

  // Verifica que el archivo existe antes de intentar enviarlo
  fs.access(fullPath)
    .then(() => {
      res.sendFile(fullPath);
    })
    .catch((error) => {
      console.error("Error: File not found", fullPath, error);
      res.status(404).send("File not found");
    });
});

app.get("/api/progress", async (req, res) => {
  try {
    const progress = await readProgressFile();
    res.json(progress);
  } catch (error) {
    console.error("Error reading progress file:", error);
    res.status(500).json({ error: "Error reading progress" });
  }
});
app.post("/api/progress", async (req, res) => {
  try {
    const { path, progress } = req.body;
    console.log("Received progress update:", path, progress); // Log para depuración

    if (
      !path ||
      !progress ||
      typeof progress.currentTime === "undefined" ||
      typeof progress.duration === "undefined"
    ) {
      return res.status(400).json({ error: "Invalid progress data" });
    }

    let allProgress = await readProgressFile();
    allProgress[path] = progress;
    await writeProgressFile(allProgress);

    console.log("Progress updated successfully"); // Log para depuración
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

app.get("/api/courses", async (req, res) => {
  try {
    const coursesDir = path.join(__dirname, "cursos_videos");
    const courses = await fs.readdir(coursesDir, { withFileTypes: true });
    const courseList = courses
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => ({
        id: dirent.name,
        name: dirent.name.replace(/_/g, " "),
        description: `Descripción del curso ${dirent.name}`,
      }));
    res.json(courseList);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Error fetching courses" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
