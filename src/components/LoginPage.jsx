import React from "react";
import GoogleAuth from "./GoogleAuth";

const LoginPage = ({ onLoginSuccess }) => {
  return (
    <div className="login-page flex flex-col items-center justify-center h-screen bg-gray-800">
      <h1 className="text-4xl font-bold mb-6">Welcome to POMODRIVE</h1>
      <p className="mb-4">Please log in to continue</p>
      <GoogleAuth onLogin={onLoginSuccess} />
    </div>
  );
};

export default LoginPage;
