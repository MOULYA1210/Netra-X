import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar    from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Discovery from './pages/Discovery';
import Monitor   from './pages/Monitor';
import Analytics from './pages/Analytics';   
import Automation from './pages/Automation';     // ← ADD
import Alerts from './pages/Alerts';
const App = () => (
  <BrowserRouter>
    <div style={{ background: '#0f172a', minHeight: '100vh', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <Navbar />
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/discovery" element={<Discovery />} />
        <Route path="/monitor"   element={<Monitor />} />
        <Route path="/analytics" element={<Analytics />} />  {/* ← ADD */}
        <Route path="/automation" element={<Automation />} />
        <Route path="/alerts" element={<Alerts />} />
      </Routes>
    </div>
  </BrowserRouter>
);

export default App;