import React from 'react';
import { DashboardPage } from './pages/DashboardPage';
import { AuthProvider } from './context/AuthContext';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <DashboardPage />
    </AuthProvider>
  );
};

export default App;
