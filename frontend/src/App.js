import { useState, useEffect, useRef, useCallback } from "react";
import {
  Folder,
  ChevronRight,
  ChevronDown,
  FileVideo,
  FileText,
  File,
  FileTextIcon as FilePdf,
  Home as HomeIcon,
} from "lucide-react";
import axios from "axios";
import { videoHistoryService } from "./components/videoHistoryService";
import Home from "./components/Home";
import * as SiIcons from "react-icons/si";
import PDFViewer from "./components/PDFViewer";

const PROGRESS_UPDATE_INTERVAL = 10000; // 10 seconds

const App = () => {
  const [structure, setStructure] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [folderPath, setFolderPath] = useState("");
  const [videoProgress, setVideoProgress] = useState({});
  const [videoHistory, setVideoHistory] = useState({});
  const [selectedCourse, setSelectedCourse] = useState(null);
  const progressUpdateTimerRef = useRef(null);
  const lastProgressUpdateRef = useRef({});
  const [isVideoPaused, setIsVideoPaused] = useState(true);
  const [courseInfo, setCourseInfo] = useState(null);

  useEffect(() => {
    if (selectedCourse) {
      fetchFolderStructure();
      fetchVideoProgress();
      fetchVideoHistory();
      fetchCourseInfo();
    }
    return () => {
      if (progressUpdateTimerRef.current) {
        clearInterval(progressUpdateTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse]);

  const fetchVideoHistory = async () => {
    if (selectedCourse) {
      const history = await videoHistoryService.fetchHistory(selectedCourse);
      setVideoHistory(history);
    }
  };

  const fetchCourseInfo = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3001/api/courses/${selectedCourse}`
      );
      setCourseInfo(response.data);
    } catch (error) {
      console.error("Error fetching course info:", error);
    }
  };

  const fetchVideoProgress = async () => {
    if (selectedCourse) {
      try {
        const response = await axios.get(
          `http://localhost:3001/api/progress/${selectedCourse}`
        );
        setVideoProgress(response.data);
      } catch (error) {
        console.error("Error fetching video progress:", error);
      }
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

  const updateVideoProgressToBackend = useCallback(
    async (videoPath, progress) => {
      if (selectedCourse) {
        console.log(
          "Attempting to update progress to backend:",
          videoPath,
          progress
        );
        try {
          await axios.post(
            `http://localhost:3001/api/progress/${selectedCourse}`,
            {
              path: videoPath,
              progress,
            }
          );
          console.log("Progress successfully updated to backend");
        } catch (error) {
          console.error("Error updating progress to backend:", error);
        }
      }
    },
    [selectedCourse]
  );

  const selectContent = useCallback(
    (type, filePath) => {
      const completePath = `${selectedCourse}/${filePath}`;
      setSelectedContent({
        type,
        path: `http://localhost:3001/api/file/${encodeURIComponent(
          completePath
        )}`,
      });

      if (progressUpdateTimerRef.current) {
        clearInterval(progressUpdateTimerRef.current);
      }

      if (type === "video") {
        console.log("Setting up progress update timer for:", completePath);
        progressUpdateTimerRef.current = setInterval(() => {
          const lastProgress = lastProgressUpdateRef.current[completePath];
          console.log("Timer fired. Last progress:", lastProgress);
          if (lastProgress) {
            updateVideoProgressToBackend(completePath, lastProgress);
          }
        }, PROGRESS_UPDATE_INTERVAL);
      }
    },
    [selectedCourse, updateVideoProgressToBackend]
  );

  const handleWatchedChange = useCallback(
    async (path, isWatched) => {
      if (selectedCourse) {
        const updatedHistory = await videoHistoryService.updateHistory(
          selectedCourse,
          path,
          isWatched
        );
        if (updatedHistory) {
          setVideoHistory(updatedHistory);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCourse, videoHistoryService]
  );

  const updateVideoProgressLocally = useCallback((path, newProgress) => {
    console.log("Updating video progress locally:", path, newProgress);
    setVideoProgress((prev) => ({
      ...prev,
      [path]: newProgress,
    }));
    localStorage.setItem(`videoProgress_${path}`, JSON.stringify(newProgress));
    lastProgressUpdateRef.current[path] = newProgress;
  }, []);

  const handleVideoTimeUpdate = useCallback(
    (e) => {
      const video = e.target;
      const newProgress = {
        currentTime: video.currentTime,
        duration: video.duration,
      };
      updateVideoProgressLocally(selectedContent.path, newProgress);

      if (video.currentTime === video.duration) {
        handleWatchedChange(selectedContent.path, true);
      }
    },
    [selectedContent, handleWatchedChange, updateVideoProgressLocally]
  );

  const handleVideoPause = useCallback(() => {
    setIsVideoPaused(true);
    const lastProgress = lastProgressUpdateRef.current[selectedContent.path];
    if (lastProgress) {
      updateVideoProgressToBackend(selectedContent.path, lastProgress);
    }
  }, [selectedContent, updateVideoProgressToBackend]);

  const handleVideoPlay = useCallback(() => {
    setIsVideoPaused(false);
  }, []);

  useEffect(() => {
    let syncInterval;

    if (selectedContent && selectedContent.type === "video" && !isVideoPaused) {
      syncInterval = setInterval(() => {
        const lastProgress =
          lastProgressUpdateRef.current[selectedContent.path];
        if (lastProgress) {
          updateVideoProgressToBackend(selectedContent.path, lastProgress);
        }
      }, PROGRESS_UPDATE_INTERVAL);
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [selectedContent, updateVideoProgressToBackend, isVideoPaused]);

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

  const handleCourseSelect = (courseId) => {
    setSelectedCourse(courseId);
    // Establece el folderPath con el nombre del curso
    setFolderPath(`/${courseId}`);
    setStructure(null);
    setSelectedContent(null);
  };

  const goToHome = () => {
    setSelectedCourse(null);
    setStructure(null);
    setSelectedContent(null);
    setFolderPath("");
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
              : value.type === "pdf"
              ? FilePdf
              : File;
          let iconColor =
            value.type === "video"
              ? "text-red-500"
              : value.type === "html"
              ? "text-green-500"
              : value.type === "pdf"
              ? "text-blue-500"
              : "text-gray-500";
          const completePath = `${selectedCourse}/${value.path}`;
          const filePath = `http://localhost:3001/api/file/${encodeURIComponent(
            completePath
          )}`;
          const progress = videoProgress[filePath];
          const isWatched = videoHistory[filePath] || false;
          const progressPercentage = isWatched
            ? 100
            : progress
            ? (progress.currentTime / progress.duration) * 100
            : 0;

          return (
            <div key={currentPath} className="flex flex-col">
              <div className="hover:bg-gray-100">
                <div
                  className="cursor-pointer p-2 "
                  onClick={() => {
                    selectContent(value.type, value.path);
                  }}
                >
                  <div className="flex items-center mb-2">
                    <FileIcon size={16} className={`mr-2 ${iconColor}`} />
                    {value.type === "video" && (
                      <input
                        type="checkbox"
                        checked={isWatched}
                        onChange={(e) =>
                          handleWatchedChange(filePath, e.target.checked)
                        }
                        className="ml-2 mr-2"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <span>{key}</span>
                  </div>
                  {value.type === "video" && (
                    <div className="ml-6 mr-4 bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className={`h-2 rounded-full ${
                          isWatched ? "bg-green-500" : "bg-blue-600"
                        }`}
                        style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }
      });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {!selectedCourse ? (
        <Home onCourseSelect={handleCourseSelect} />
      ) : (
        <div className="flex flex-grow overflow-hidden">
          <div className="w-1/4 bg-white border-r shadow-md flex flex-col">
            <div className="sticky top-0 z-10 bg-white border-b">
              <div className="flex items-center justify-between p-4">
                <h2 className="text-xl font-bold text-gray-800">CursoVisor</h2>
                <button
                  onClick={goToHome}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <HomeIcon size={24} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-grow">
              {structure ? (
                renderTree(structure)
              ) : (
                <p>Cargando estructura de carpetas...</p>
              )}
            </div>
          </div>

          <div className="w-full p-4">
            <div className="w-full h-screen mb-2">
              {courseInfo && (
                <div className="mb-4 flex items-center">
                  {courseInfo.icon && SiIcons[courseInfo.icon] ? (
                    SiIcons[courseInfo.icon]({
                      size: 24,
                      className: "text-gray-500 mr-4",
                    })
                  ) : (
                    <Folder size={24} className="text-gray-500 mr-4" />
                  )}
                  <div>
                    <h3 className="text-lg font-medium text-gray-500">
                      {courseInfo.name}
                    </h3>
                  </div>
                </div>
              )}
              {selectedContent ? (
                selectedContent.type === "video" ? (
                  <video
                    src={selectedContent.path}
                    controls
                    className="w-full rounded-lg shadow-2xl"
                    onTimeUpdate={handleVideoTimeUpdate}
                    onPause={handleVideoPause}
                    onPlay={handleVideoPlay}
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
                  <div className="flex justify-center items-center">
                    <iframe
                      title="Contenido HTML"
                      src={selectedContent.path}
                      className="w-full max-w-[75ch] h-[90vh] border-spacing-10 rounded-lg shadow-2xl p-2"
                    />
                  </div>
                ) : selectedContent.type === "pdf" ? (
                  <div className="flex justify-center w-full h-[90vh] items-center mb-2">
                    <PDFViewer
                      pdfUrl={`${selectedContent.path}`}
                      onProgressChange={(currentPage, totalPages) => {
                        updateVideoProgressLocally(selectedContent.path, {
                          currentTime: currentPage,
                          duration: totalPages,
                        });
                      }}
                    />
                  </div>
                ) : (
                  <p className="text-gray-600">
                    Este tipo de archivo no se puede previsualizar.
                  </p>
                )
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    {courseInfo && (
                      <div className="mb-8 flex flex-col items-center">
                        {courseInfo.icon && SiIcons[courseInfo.icon] ? (
                          SiIcons[courseInfo.icon]({
                            size: 256,
                            className: "text-blue-500 mb-4",
                          })
                        ) : (
                          <Folder size={256} className="text-blue-500 mb-4" />
                        )}
                        <h3 className="text-2xl font-bold mb-2">
                          {courseInfo.name}
                        </h3>
                        <p className="text-lg text-gray-600 mb-4">
                          Selecciona un archivo para visualizarlo.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
