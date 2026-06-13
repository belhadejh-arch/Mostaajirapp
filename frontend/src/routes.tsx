import type { ReactNode } from 'react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ExplorePage from './pages/ExplorePage';
import ProductDetailPage from './pages/ProductDetailPage';
import AddProductPage from './pages/AddProductPage';
import RentalsPage from './pages/RentalsPage';
import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';
import VerificationPage from './pages/VerificationPage';
import AdminPage from './pages/AdminPage';
import DisputePage from './pages/DisputePage';
import NotificationsPage from './pages/NotificationsPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: 'Home', path: '/', element: <HomePage />, public: true },
  { name: 'Login', path: '/login', element: <LoginPage />, public: true },
  { name: 'Register', path: '/register', element: <RegisterPage />, public: true },
  { name: 'Explore', path: '/explore', element: <ExplorePage />, public: true },
  { name: 'Product', path: '/product/:id', element: <ProductDetailPage />, public: true },
  { name: 'Add Product', path: '/add', element: <AddProductPage /> },
  { name: 'Rentals', path: '/rentals', element: <RentalsPage /> },
  { name: 'Wallet', path: '/wallet', element: <WalletPage /> },
  { name: 'Profile', path: '/profile', element: <ProfilePage /> },
  { name: 'Verification', path: '/verification', element: <VerificationPage /> },
  { name: 'Admin', path: '/admin', element: <AdminPage /> },
  { name: 'Admin Users', path: '/admin/users', element: <AdminPage /> },
  { name: 'Admin KYC', path: '/admin/kyc', element: <AdminPage /> },
  { name: 'Admin Withdrawals', path: '/admin/withdrawals', element: <AdminPage /> },
  { name: 'Admin Settings', path: '/admin/settings', element: <AdminPage /> },
  { name: 'Dispute', path: '/dispute/:rentalId', element: <DisputePage /> },
  { name: 'Notifications', path: '/notifications', element: <NotificationsPage /> },
];
