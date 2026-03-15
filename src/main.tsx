
// Import polyfills first
import './utils/polyfills';

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initDeepLinks } from './utils/deepLinks';

// Initialize native deep link handling (no-op on web)
initDeepLinks();

createRoot(document.getElementById("root")!).render(<App />);
