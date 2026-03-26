import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

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
import { StudentsPage } from './pages/teacher/StudentsPage';
import { GradeAnswerSheetsPage } from './pages/teacher/GradeAnswerSheetsPage';
import { ScoreEntryPage } from './pages/teacher/ScoreEntryPage';
import { ProgramViewPage } from './pages/teacher/ProgramViewPage';

// Student pages
import { StudentDashboardPage } from './pages/student/DashboardPage';
import { StudentQuizPage } from './pages/student/QuizPage';

// Admin pages
import { AdminDashboardPage } from './pages/admin/DashboardPage';
import { TeachersPage } from './pages/admin/TeachersPage';
import { TeacherProfilePage } from './pages/admin/TeacherProfilePage';
import { AdminCourseAnalyticsPage } from './pages/admin/CourseAnalyticsPage';
import { TimetablePage } from './pages/admin/TimetablePage';

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
    <ErrorBoundary>
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
              <Route path="/teacher/courses/:courseId/lessons/:lessonId/grade" element={<GradeAnswerSheetsPage />} />
              <Route path="/teacher/courses/:courseId/lessons/:lessonId/scores" element={<ScoreEntryPage />} />
              <Route path="/teacher/courses/:courseId/students" element={<StudentsPage />} />
              <Route path="/teacher/guide" element={<PlatformGuidePage />} />
              <Route path="/teacher/programs/:programId" element={<ProgramViewPage />} />
            </Route>

            {/* Admin routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/teachers" element={<TeachersPage />} />
              <Route path="/admin/teachers/:teacherId" element={<TeacherProfilePage />} />
              <Route path="/admin/teachers/:teacherId/courses/:courseId" element={<AdminCourseAnalyticsPage />} />
              <Route path="/admin/timetable" element={<TimetablePage />} />
            </Route>

            {/* Student routes */}
            <Route element={<ProtectedRoute allowedRoles={['student']} />}>
              <Route path="/student" element={<StudentDashboardPage />} />
              <Route path="/student/courses/:courseId/quiz/:gateId" element={<StudentQuizPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
