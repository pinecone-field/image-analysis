import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import StorePage from './pages/StorePage';
import SearchPage from './pages/SearchPage';
import HomePage from './pages/HomePage';

function App() {
  return (
    <Router>
      <nav>
        <Link to="/store">Store</Link> | <Link to="/search">Search</Link>
      </nav>
      <Routes>
        <Route path="/store" element={<StorePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/" element={<HomePage />} />
      </Routes>
    </Router>
  );
}

export default App;
