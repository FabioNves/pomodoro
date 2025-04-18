export const generateSessionId = () => {
  let sessionId = localStorage.getItem("sessionId");
  if (!sessionId) {
    sessionId = crypto.randomUUID(); // Generate a unique sessionId
    localStorage.setItem("sessionId", sessionId); // Store it in localStorage
  }
  return sessionId;
};
