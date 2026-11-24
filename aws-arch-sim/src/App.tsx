import { HashRouter, Route, Routes } from 'react-router';
import { ChallengePage } from './pages/ChallengePage';
import { ChallengesPage } from './pages/ChallengesPage';
import { GuidePage } from './pages/GuidePage';
import { HomePage } from './pages/HomePage';
import { LearnPage } from './pages/LearnPage';
import { LessonPage } from './pages/LessonPage';
import { SandboxPage } from './pages/SandboxPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path='/' element={<HomePage />} />
        <Route path='/sandbox' element={<SandboxPage />} />
        <Route path='/learn' element={<LearnPage />} />
        <Route path='/learn/:lessonId' element={<LessonPage />} />
        <Route path='/challenges' element={<ChallengesPage />} />
        <Route path='/challenges/:challengeId' element={<ChallengePage />} />
        <Route path='/guide' element={<GuidePage />} />
        <Route path='/guide/:topic' element={<GuidePage />} />
      </Routes>
    </HashRouter>
  );
}
