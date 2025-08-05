import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import App from './App'
import './index.css'


const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isExtension ? (
      <MemoryRouter initialEntries={['/']} initialIndex={0}>
        <div className="extension-mode">
          <App />
        </div>
      </MemoryRouter>
    ) : (
      <BrowserRouter>
        <div className="web-mode">
          <App />
        </div>
      </BrowserRouter>
    )}
  </React.StrictMode>,
)