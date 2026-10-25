import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { getSavedUser, getToken } from './lib/api';
import { ToastProvider } from './lib/toast.jsx';
import Landing from './pages/Landing.jsx';
import Auth from './pages/Auth.jsx';
import Shell from './layout/Shell.jsx';
import Home from './pages/Home.jsx';
import Tests from './pages/Tests.jsx';
import Path from './pages/Path.jsx';
import Analytics from './pages/Analytics.jsx';
import Profile from './pages/Profile.jsx';
import ExamIntro from './pages/ExamIntro.jsx';
import ExamLive from './pages/ExamLive.jsx';
import ExamResult from './pages/ExamResult.jsx';
import AdminHome from './pages/admin/AdminHome.jsx';
import AdminExams from './pages/admin/AdminExams.jsx';
import AdminExamEdit from './pages/admin/AdminExamEdit.jsx';
import AdminImport from './pages/admin/AdminImport.jsx';
import AdminLive from './pages/admin/AdminLive.jsx';
import AdminStudents from './pages/admin/AdminStudents.jsx';
import AdminStyles from './pages/admin/AdminStyles.jsx';

function Guard({ children, admin }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  const sessionUser = user || getSavedUser();
  if (!ready && !sessionUser) {
    return (
      <div className="main" style={{ padding: 48 }}>
        <div className="brand"><div className="brand-mark">A</div> Aaroh</div>
        <p style={{ color: 'var(--muted)', marginTop: 16 }}>Restoring your seat…</p>
      </div>
    );
  }
  if (!sessionUser) {
    if (getToken()) {
      return (
        <div className="main" style={{ padding: 48 }}>
          <div className="brand"><div className="brand-mark">A</div> Aaroh</div>
          <p style={{ color: 'var(--muted)', marginTop: 16 }}>Opening your hall…</p>
        </div>
      );
    }
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  if (admin && sessionUser.role !== 'admin') return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <div className="app-root">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route path="/exam/:examId/live" element={<Guard><ExamLive /></Guard>} />
          <Route path="/app" element={<Guard><Shell /></Guard>}>
            <Route index element={<Home />} />
            <Route path="tests" element={<Tests />} />
            <Route path="path" element={<Path />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="you" element={<Profile />} />
            <Route path="exam/:id" element={<ExamIntro />} />
            <Route path="result/:attemptId" element={<ExamResult />} />
            <Route path="admin" element={<Guard admin><AdminHome /></Guard>} />
            <Route path="admin/exams" element={<Guard admin><AdminExams /></Guard>} />
            <Route path="admin/exams/:id" element={<Guard admin><AdminExamEdit /></Guard>} />
            <Route path="admin/import" element={<Guard admin><AdminImport /></Guard>} />
            <Route path="admin/live" element={<Guard admin><AdminLive /></Guard>} />
            <Route path="admin/students" element={<Guard admin><AdminStudents /></Guard>} />
            <Route path="admin/styles" element={<Guard admin><AdminStyles /></Guard>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </ToastProvider>
  );
}
