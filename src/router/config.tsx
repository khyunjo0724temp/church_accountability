import { lazy } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';

const Home = lazy(() => import('../pages/home/page'));
const Login = lazy(() => import('../pages/login/page'));
const SuperLogin = lazy(() => import('../pages/super-login/page'));
const PastorLogin = lazy(() => import('../pages/pastor-login/page'));
const PastorDashboard = lazy(() => import('../pages/pastor-dashboard/page'));
const Attendance = lazy(() => import('../pages/attendance/page'));
const AttendanceList = lazy(() => import('../pages/attendance-list/page'));
const Reports = lazy(() => import('../pages/reports/page'));
const Admin = lazy(() => import('../pages/admin/page'));
const NotFound = lazy(() => import('../pages/NotFound'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Login />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/super-login',
    element: <SuperLogin />,
  },
  {
    path: '/pastor-login',
    element: <PastorLogin />,
  },
  {
    path: '/pastor-dashboard',
    element: <PastorDashboard />,
  },
  {
    path: '/dashboard',
    element: <Navigate to="/attendance" replace />,
  },
  {
    path: '/attendance',
    element: <Attendance />,
  },
  {
    path: '/attendance-list',
    element: <AttendanceList />,
  },
  {
    path: '/reports',
    element: <Reports />,
  },
  {
    path: '/admin',
    element: <Admin />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

export default routes;