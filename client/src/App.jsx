import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import StudentDashboard from './pages/StudentDashboard';
import StudentAcademicsPage from './pages/StudentAcademicsPage';
import StudentSupportPage from './pages/StudentSupportPage';
import StudentProfilePage from './pages/StudentProfilePage';
import StaffDashboard from './pages/StaffDashboard';
import LecturerCoursesPage from './pages/LecturerCoursesPage';
import LecturerProfilePage from './pages/LecturerProfilePage';
import StudentsPage from './pages/StudentsPage';
import StudentDetailPage from './pages/StudentDetailPage';
import InterventionsPage from './pages/InterventionsPage';
import ReportsPage from './pages/ReportsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminLecturersPage from './pages/AdminLecturersPage';
import AdminCoursesPage from './pages/AdminCoursesPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import { AuthProvider, useAuth, getHomePathForRole } from './contexts/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getHomePathForRole(user.role)} replace />;
  }
  return children;
};

const RootRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getHomePathForRole(user.role)} replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-[#030712] text-slate-100 font-sans selection:bg-indigo-500/30">
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Student Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/academics"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <StudentAcademicsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/support"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <StudentSupportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/profile"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <StudentProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Lecturer Routes */}
            <Route
              path="/lecturer/dashboard"
              element={
                <ProtectedRoute allowedRoles={['LECTURER']}>
                  <StaffDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lecturer/courses"
              element={
                <ProtectedRoute allowedRoles={['LECTURER']}>
                  <LecturerCoursesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lecturer/students"
              element={
                <ProtectedRoute allowedRoles={['LECTURER']}>
                  <StudentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lecturer/students/:id"
              element={
                <ProtectedRoute allowedRoles={['LECTURER']}>
                  <StudentDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lecturer/interventions"
              element={
                <ProtectedRoute allowedRoles={['LECTURER']}>
                  <InterventionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lecturer/reports"
              element={
                <ProtectedRoute allowedRoles={['LECTURER']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lecturer/profile"
              element={
                <ProtectedRoute allowedRoles={['LECTURER']}>
                  <LecturerProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <StaffDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/students"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <StudentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/students/:id"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <StudentDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/lecturers"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminLecturersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminCoursesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/interventions"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <InterventionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminSettingsPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
