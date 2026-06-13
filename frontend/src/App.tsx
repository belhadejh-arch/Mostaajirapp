import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { AdminProvider } from '@/contexts/AdminContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { routes } from './routes';

function DirectionSetter() {
  const { isRTL, language } = useLanguage();
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [isRTL, language]);
  return null;
}

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <DataProvider>
          <AdminProvider>
            <NotificationsProvider>
              <Router>
                <DirectionSetter />
                <IntersectObserver />
                <Routes>
                  {routes.map((route, index) => (
                    <Route key={index} path={route.path} element={route.element} />
                  ))}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <Toaster position="top-center" richColors />
              </Router>
            </NotificationsProvider>
          </AdminProvider>
        </DataProvider>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
