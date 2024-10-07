import React, { useState, useEffect } from "react";
import {
  Folder,
  ChevronRight,
  ChevronDown,
  FileVideo,
  FileText,
  File,
} from "lucide-react";
import axios from "axios";
import { videoHistoryService } from "./videoHistoryService";

const App = () => {
  const [structure, setStructure] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [folderPath] = useState("");
  const [videoProgress, setVideoProgress] = useState({});
  const [currentSection, setCurrentSection] = useState("");
  const [videoHistory, setVideoHistory] = useState({});

  useEffect(() => {
    fetchFolderStructure();
    fetchVideoProgress();
    fetchVideoHistory();
  }, []);

  const fetchVideoHistory = async () => {
    const history = await videoHistoryService.fetchHistory();
    setVideoHistory(history);
  };

  const fetchVideoProgress = async () => {
    try {
      const response = await axios.get("http://localhost:3001/api/progress");
      setVideoProgress(response.data);
    } catch (error) {
      console.error("Error fetching video progress:", error);
    }
  };

  const fetchFolderStructure = async () => {
    try {
      const response = await axios.post(
        "http://localhost:3001/api/folder-structure",
        { folderPath }
      );
      setStructure(response.data);
    } catch (error) {
      console.error("Error fetching folder structure:", error);
    }
  };

  const toggleFolder = (path) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const selectContent = (type, path) => {
    setSelectedContent({
      type,
      path: `http://localhost:3001/api/file/${path}`,
    });
  };

  const handleVideoTimeUpdate = async (e) => {
    const video = e.target;
    const newProgress = {
      currentTime: video.currentTime,
      duration: video.duration,
    };
    updateVideoProgress(selectedContent.path, newProgress);

    if (video.currentTime === video.duration) {
      handleWatchedChange(selectedContent.path, true);
    }
  };

  const updateVideoProgress = async (path, newProgress) => {
    setVideoProgress((prev) => ({
      ...prev,
      [path]: newProgress,
    }));
    try {
      await axios.post("http://localhost:3001/api/progress", {
        path,
        progress: newProgress,
      });
    } catch (error) {
      console.error("Error updating progress:", error);
    }
  };

  const handleWatchedChange = async (path, isWatched) => {
    const updatedHistory = await videoHistoryService.updateHistory(
      path,
      isWatched
    );
    if (updatedHistory) {
      setVideoHistory(updatedHistory);
    }
  };

  const customSort = (a, b) => {
    const aIsNumber = /^\d+/.test(a);
    const bIsNumber = /^\d+/.test(b);

    if (aIsNumber && bIsNumber) {
      return parseInt(a) - parseInt(b);
    } else if (aIsNumber) {
      return -1;
    } else if (bIsNumber) {
      return 1;
    } else {
      return a.localeCompare(b);
    }
  };

  const renderTree = (node, path = "") => {
    return Object.entries(node)
      .sort(([a], [b]) => customSort(a, b))
      .map(([key, value]) => {
        const currentPath = path ? `${path}/${key}` : key;
        const isFolder = typeof value === "object" && !value.type;

        if (isFolder) {
          const isExpanded = expandedFolders[currentPath];
          return (
            <div key={currentPath}>
              <div
                className="flex items-center cursor-pointer p-2 hover:bg-gray-100"
                onClick={() => toggleFolder(currentPath)}
              >
                <div className="flex-shrink-0 w-6">
                  {isExpanded ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </div>
                <Folder
                  size={16}
                  className="flex-shrink-0 mr-2 text-blue-500"
                />
                <span className="" title={key}>
                  {key}
                </span>
              </div>
              {isExpanded && (
                <div className="ml-4">{renderTree(value, currentPath)}</div>
              )}
            </div>
          );
        } else {
          let FileIcon =
            value.type === "video"
              ? FileVideo
              : value.type === "html"
              ? FileText
              : File;
          let iconColor =
            value.type === "video"
              ? "text-red-500"
              : value.type === "html"
              ? "text-green-500"
              : "text-gray-500";

          const filePath = `http://localhost:3001/api/file/${value.path}`;
          const progress = videoProgress[filePath];
          const progressPercentage = progress
            ? (progress.currentTime / progress.duration) * 100
            : 0;

          return (
            <div key={currentPath} className="flex flex-col">
              <div
                className="flex items-center cursor-pointer p-2 hover:bg-gray-100"
                onClick={() => {
                  selectContent(value.type, value.path);
                  setCurrentSection(key);
                }}
              >
                <FileIcon size={16} className={`mr-2 ${iconColor}`} />
                <span>{key}</span>
                {value.type === "video" && (
                  <input
                    type="checkbox"
                    checked={videoHistory[filePath] || false}
                    onChange={(e) =>
                      handleWatchedChange(filePath, e.target.checked)
                    }
                    className="ml-2"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
              {value.type === "video" && (
                <div className="ml-6 mr-2 bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              )}
            </div>
          );
        }
      });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex flex-grow overflow-hidden">
        <div className="w-1/4 bg-white border-r shadow-md overflow-y-auto">
          <h2 className="text-xl font-bold m-4 text-gray-800">Videos Cursos</h2>
          {structure && renderTree(structure)}
        </div>
        <div className="w-3/4 p-4 overflow-y-auto">
          {selectedContent && (
            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-700">
                {currentSection}
              </h3>
              <p className="text-sm text-gray-500 mb-2">
                Ruta:{" "}
                {decodeURIComponent(
                  selectedContent.path.split("/api/file/")[1]
                )}
              </p>
            </div>
          )}
          {selectedContent ? (
            selectedContent.type === "video" ? (
              <video
                src={selectedContent.path}
                controls
                className="w-full rounded-lg shadow-lg"
                onTimeUpdate={handleVideoTimeUpdate}
                key={selectedContent.path}
                onLoadedMetadata={(e) => {
                  const video = e.target;
                  const savedProgress = videoProgress[selectedContent.path];
                  if (
                    savedProgress &&
                    savedProgress.currentTime &&
                    isFinite(savedProgress.currentTime)
                  ) {
                    video.currentTime = savedProgress.currentTime;
                  }
                }}
              />
            ) : selectedContent.type === "html" ? (
              <iframe
                title="Contenido HTML"
                src={selectedContent.path}
                className="w-full h-5/6 border-none rounded-lg shadow-lg"
              />
            ) : (
              <p className="text-gray-600">
                Este tipo de archivo no se puede previsualizar.
              </p>
            )
          ) : (
            <p className="text-gray-600">
              Selecciona un archivo para ver su contenido
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
