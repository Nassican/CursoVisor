import React, { useState, useEffect } from "react";
import axios from "axios";
import { Folder } from "lucide-react";

const Home = ({ onCourseSelect }) => {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await axios.get("http://localhost:3001/api/courses");
      setCourses(response.data);
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  return (
    <div className="p-8 bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">Cursos disponibles</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div
            key={course.id}
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer flex flex-col"
            onClick={() => onCourseSelect(course.id)}
          >
            <div className="flex-grow">
              <Folder size={48} className="text-blue-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">{course.name}</h2>
              <p className="text-gray-600 mb-4">{course.description}</p>
            </div>
            <div className="mt-auto">
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-2">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{
                    width: `${
                      (course.videosWatched / course.totalVideos) * 100
                    }%`,
                  }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">
                {course.videosWatched} / {course.totalVideos} videos vistos
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
