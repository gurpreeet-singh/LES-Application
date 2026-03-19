import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Auth pages
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';

// Teacher pages
import { TeacherDashboardPage } from './pages/teacher/DashboardPage';
import { CoursesPage } from './pages/teacher/CoursesPage';
import { CourseDetailPage } from './pages/teacher/CourseDetailPage';
import { UploadSyllabusPage } from './pages/teacher/UploadSyllabusPage';
import { ReviewContentPage } from './pages/teacher/ReviewContentPage';
import { ClassAnalyticsPage } from './pages/teacher/ClassAnalyticsPage';
import { PlatformGuidePage } from './pages/teacher/PlatformGuidePage';
import { LessonDetailPage } from './pages/teacher/LessonDetailPage';

// Student pages
import { StudentDashboardPage } from './pages/student/DashboardPage';

// Shared pages
import { LandingPage } from './pages/shared/LandingPage';
import { NotFoundPage } from './pages/shared/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Teacher routes */}
            <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
              <Route path="/teacher" element={<TeacherDashboardPage />} />
              <Route path="/teacher/courses" element={<CoursesPage />} />
              <Route path="/teacher/courses/:courseId/detail" element={<CourseDetailPage />} />
              <Route path="/teacher/courses/:courseId/upload" element={<UploadSyllabusPage />} />
              <Route path="/teacher/courses/:courseId/review" element={<ReviewContentPage />} />
              <Route path="/teacher/courses/:courseId/analytics" element={<ClassAnalyticsPage />} />
              <Route path="/teacher/courses/:courseId/lessons/:lessonId" element={<LessonDetailPage />} />
              <Route path="/teacher/guide" element={<PlatformGuidePage />} />
            </Route>

            {/* Student routes */}
            <Route element={<ProtectedRoute allowedRoles={['student']} />}>
              <Route path="/student" element={<StudentDashboardPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
