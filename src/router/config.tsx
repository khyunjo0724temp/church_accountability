import { lazy } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';

const Home = lazy(() => import('../pages/home/page'));
const Login = lazy(() => import('../pages/login/page'));
const SuperLogin = lazy(() => import('../pages/super-login/page'));
const Attendance = lazy(() => import('../pages/attendance/page'));
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
    path: '/dashboard',
    element: <Navigate to="/attendance" replace />,
  },
  {
    path: '/attendance',
    element: <Attendance />,
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