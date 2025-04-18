import { useState, useEffect } from "react";
import axios from "axios";

const useUser = () => {
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [brands, setBrands] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const userId = localStorage.getItem("userId");
      const name = localStorage.getItem("userName");

      console.log("Retrieved from localStorage:", { userId, name }); // Debug log

      if (userId && name) {
        setUser({
          userId,
          name,
        });

        try {
          // Fetch sessions
          const sessionsResponse = await axios.get("/api/sessions", {
            headers: { "user-id": userId },
          });
          setSessions(sessionsResponse.data);

          // Fetch brands
          const brandsResponse = await axios.get("/api/brands", {
            headers: { "user-id": userId },
          });
          setBrands(brandsResponse.data);

          // Fetch milestones
          const milestonesResponse = await axios.get("/api/milestones", {
            headers: { "user-id": userId },
          });
          setMilestones(milestonesResponse.data);
        } catch (err) {
          console.error("Error fetching user data:", err);
          setError("Failed to fetch user data. Please try again later.");
        }
      } else {
        setUser(null);
      }
    };

    fetchUserData();
  }, []);

  return {
    user,
    sessions,
    brands,
    setBrands,
    milestones,
    setMilestones,
    error,
  };
};

export default useUser;
