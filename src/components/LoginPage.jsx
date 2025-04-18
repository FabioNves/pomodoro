import React from "react";
import GoogleAuth from "./GoogleAuth";

const LoginPage = ({ onLoginSuccess }) => {
  return (
    <div className="login-page flex flex-col items-center justify-center size-full bg-gray-800 p-2">
      <p className="mb-4">Please log in / Register to use the Todo List </p>
      <GoogleAuth onLogin={onLoginSuccess} />
    </div>
  );
};

export default LoginPage;
