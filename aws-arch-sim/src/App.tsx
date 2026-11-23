import { HashRouter, Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path='/' element={<HomePage />} />
      </Routes>
    </HashRouter>
  );
}
