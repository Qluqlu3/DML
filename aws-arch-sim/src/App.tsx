import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';

/** 画面ごとに分けて読み込む（キャンバスを使わない画面を軽くする） */
const SandboxPage = lazy(() =>
  import('./pages/SandboxPage').then((m) => ({ default: m.SandboxPage })),
);
const LearnPage = lazy(() => import('./pages/LearnPage').then((m) => ({ default: m.LearnPage })));
const LessonPage = lazy(() =>
  import('./pages/LessonPage').then((m) => ({ default: m.LessonPage })),
);
const ChallengesPage = lazy(() =>
  import('./pages/ChallengesPage').then((m) => ({ default: m.ChallengesPage })),
);
const ChallengePage = lazy(() =>
  import('./pages/ChallengePage').then((m) => ({ default: m.ChallengePage })),
);
const IncidentsPage = lazy(() =>
  import('./pages/IncidentsPage').then((m) => ({ default: m.IncidentsPage })),
);
const IncidentPage = lazy(() =>
  import('./pages/IncidentPage').then((m) => ({ default: m.IncidentPage })),
);
const GuidePage = lazy(() => import('./pages/GuidePage').then((m) => ({ default: m.GuidePage })));

export function App() {
  return (
    <HashRouter>
      <Suspense fallback={<p className='page-loading'>読み込み中…</p>}>
        <Routes>
          <Route path='/' element={<HomePage />} />
          <Route path='/sandbox' element={<SandboxPage />} />
          <Route path='/learn' element={<LearnPage />} />
          <Route path='/learn/:lessonId' element={<LessonPage />} />
          <Route path='/challenges' element={<ChallengesPage />} />
          <Route path='/challenges/:challengeId' element={<ChallengePage />} />
          <Route path='/incidents' element={<IncidentsPage />} />
          <Route path='/incidents/:incidentId' element={<IncidentPage />} />
          <Route path='/guide' element={<GuidePage />} />
          <Route path='/guide/:topic' element={<GuidePage />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
