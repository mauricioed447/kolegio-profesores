// RUTA: src/App.tsx

import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import BuilderPage from "./pages/BuilderPage";
import PasswordProtected from "./components/PasswordProtected";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PasswordProtected>
              <BuilderPage />
            </PasswordProtected>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
