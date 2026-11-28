
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Race3DTest from './Race3DTest.jsx';
import './style.css';

const isRace3DTest =
  new URLSearchParams(window.location.search).get('race3d') === '1';

createRoot(document.getElementById('root')).render(
  isRace3DTest ? <Race3DTest /> : <App />
);
