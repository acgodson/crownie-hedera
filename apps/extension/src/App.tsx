import React from 'react'
import { Routes, Route } from 'react-router-dom'
import PopupView from './components/PopupView'
const App: React.FC = () => {

  return (
    <div className={`app  extension-popup`}>
      <Routes>
        <Route path="/" element={<PopupView />} />
      </Routes>
    </div>
  )
}

export default App