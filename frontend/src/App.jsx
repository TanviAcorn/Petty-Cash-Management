import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import UserManagementPage from "./pages/UserManagement";
function App() {
  return (
    <div className="App">
      <UserManagementPage />
    </div>
  );
}

export default App;
