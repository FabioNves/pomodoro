// Client-side token validator to catch invalid tokens early
export const validateStoredToken = () => {
  if (typeof window === 'undefined') return;
  
  const token = localStorage.getItem('accessToken');
  
  if (!token) {
    console.log('[tokenValidator] No token found in localStorage');
    return;
  }
  
  console.log('[tokenValidator] Validating stored token:', token.substring(0, 50) + '...');
  
  // Check if it's a valid JWT structure
  const parts = token.split('.');
  
  if (parts.length !== 3) {
    console.error('[tokenValidator] ❌ Invalid token structure! Token has', parts.length, 'parts instead of 3');
    console.error('[tokenValidator] Clearing invalid token from localStorage');
    localStorage.removeItem('accessToken');
    return;
  }
  
  try {
    // Try to decode the payload
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload);
    console.log('[tokenValidator] ✅ Token structure is valid');
    console.log('[tokenValidator] Token payload:', payload);
    
    // Check expiration
    if (payload.exp) {
      const expirationDate = new Date(payload.exp * 1000);
      const now = new Date();
      
      if (expirationDate < now) {
        console.warn('[tokenValidator] ⚠️ Token is expired:', expirationDate);
        console.log('[tokenValidator] Clearing expired token');
        localStorage.removeItem('accessToken');
      } else {
        console.log('[tokenValidator] Token expires at:', expirationDate);
      }
    }
  } catch (error) {
    console.error('[tokenValidator] ❌ Failed to decode token:', error.message);
    console.error('[tokenValidator] This token cannot be decoded - clearing it');
    localStorage.removeItem('accessToken');
  }
};

// Run validation on module load (client-side only)
if (typeof window !== 'undefined') {
  validateStoredToken();
}
