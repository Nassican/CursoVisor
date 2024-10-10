const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const DEFAULT_FOLDER = path.join(__dirname, "cursos_videos");
const COURSES_DATA_FILE = path.join(__dirname, "courses_data.json");

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
            watched: false,
          };
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  return structure;
}

async function readCoursesDataFile() {
  try {
    const data = await fs.readFile(COURSES_DATA_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeCoursesDataFile(data) {
  await fs.writeFile(COURSES_DATA_FILE, JSON.stringify(data, null, 2));
}

app.post("/api/folder-structure", async (req, res) => {
  try {
    const { folderPath } = req.body;
    const dir = folderPath
      ? path.join(DEFAULT_FOLDER, folderPath)
      : DEFAULT_FOLDER;
    console.log("Requesting folder structure for:", dir);
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

  fs.access(fullPath)
    .then(() => {
      res.sendFile(fullPath);
    })
    .catch((error) => {
      console.error("Error: File not found", fullPath, error);
      res.status(404).send("File not found");
    });
});

app.get("/api/progress/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    const coursesData = await readCoursesDataFile();
    const courseData = coursesData[courseId] || { videos: {}, progress: {} };
    res.json(courseData.progress);
  } catch (error) {
    console.error("Error reading progress:", error);
    res.status(500).json({ error: "Error reading progress" });
  }
});

app.post("/api/progress/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    const { path: videoPath, progress } = req.body;
    console.log("Received progress update:", courseId, videoPath, progress);

    if (
      !videoPath ||
      !progress ||
      typeof progress.currentTime === "undefined" ||
      typeof progress.duration === "undefined"
    ) {
      return res.status(400).json({ error: "Invalid progress data" });
    }

    let coursesData = await readCoursesDataFile();
    if (!coursesData[courseId]) {
      coursesData[courseId] = { videos: {}, progress: {} };
    }
    coursesData[courseId].progress[videoPath] = progress;

    // Update total videos and videos watched
    const courseFolder = path.join(DEFAULT_FOLDER, courseId);
    const structure = await getDirectoryStructure(courseFolder);
    const totalVideos = countVideos(structure);
    const videosWatched = Object.values(coursesData[courseId].progress).filter(p => p.currentTime === p.duration).length;

    coursesData[courseId].totalVideos = totalVideos;
    coursesData[courseId].videosWatched = videosWatched;

    await writeCoursesDataFile(coursesData);

    console.log("Progress updated successfully");
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating progress:", error);
    res.status(500).json({ error: "Error updating progress" });
  }
});

app.get("/api/video-history/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    const coursesData = await readCoursesDataFile();
    const courseData = coursesData[courseId] || { videos: {}, progress: {} };
    res.json(courseData.videos);
  } catch (error) {
    console.error("Error reading history:", error);
    res.status(500).json({ error: "Error reading history" });
  }
});

app.post("/api/video-history/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    const { videoPath, isWatched } = req.body;
    let coursesData = await readCoursesDataFile();
    if (!coursesData[courseId]) {
      coursesData[courseId] = { videos: {}, progress: {} };
    }
    coursesData[courseId].videos[videoPath] = isWatched;

    // Update videos watched count
    const videosWatched = Object.values(coursesData[courseId].videos).filter(watched => watched).length;
    coursesData[courseId].videosWatched = videosWatched;

    await writeCoursesDataFile(coursesData);
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
    const coursesData = await readCoursesDataFile();

    const courseList = await Promise.all(courses
      .filter((dirent) => dirent.isDirectory())
      .map(async (dirent) => {
        const courseId = dirent.name;
        const courseData = coursesData[courseId] || {};
        const structure = await getDirectoryStructure(path.join(coursesDir, courseId));
        const totalVideos = countVideos(structure);

        return {
          id: courseId,
          name: courseId.replace(/_/g, " "),
          description: `Descripción del curso ${courseId}`,
          totalVideos,
          videosWatched: courseData.videosWatched || 0
        };
      }));

    res.json(courseList);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Error fetching courses" });
  }
});

function countVideos(structure) {
  let count = 0;
  for (const key in structure) {
    if (typeof structure[key] === 'object' && structure[key].type === 'video') {
      count++;
    } else if (typeof structure[key] === 'object' && !structure[key].type) {
      count += countVideos(structure[key]);
    }
  }
  return count;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});