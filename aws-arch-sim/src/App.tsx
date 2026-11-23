import { HashRouter, Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';
import { SandboxPage } from './pages/SandboxPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path='/' element={<HomePage />} />
        <Route path='/sandbox' element={<SandboxPage />} />
      </Routes>
    </HashRouter>
  );
}
