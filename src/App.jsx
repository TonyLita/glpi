import { Routes, Route, Navigate } from 'react-router-dom';
import BackofficePage from './features/backoffice/pages/BackofficePage';
import FrontofficePage from './features/frontoffice/pages/FrontofficePage';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/frontoffice" replace />} />
      <Route path="/frontoffice/*" element={<FrontofficePage />} />
      <Route path="/backoffice/*" element={<BackofficePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
