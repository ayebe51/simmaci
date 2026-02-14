
import axios from 'axios';

// Ensure this matches the PROD environment 
const CONVEX_URL = "https://successful-bison-83.convex.cloud";

async function run() {
  console.log("Testing User Registration with School ID...");
  
  // Use a unique email
  const email = `test.guru.${Date.now()}@kroya.nu`;
  const unit = "MTsS MA'ARIF NU 01 KROYA"; // Known valid school

  try {
      const res = await axios.post(`${CONVEX_URL}/api/mutation`, {
          path: "auth:register", 
          args: {
              email,
              name: "Test Guru Kroya",
              password: "Password123!", // Strong password to pass validation
              role: "teacher",
              unit
          }
      });
      const json = res.data;
      if (json.status !== "success") {
          throw new Error(`Failed: ${json.errorMessage}`);
      }
      console.log("Registration Success! User:", json.value);
      
      // Now verify if schoolId is set by fetching the user
      // We can't query users directly without auth usually, but let's try a debug query if available
      // or rely on my recent fix to `login` returning it? 
      // Let's use `login` to check the returned user object.
      
      console.log("Verifying via Login...");
      const loginRes = await axios.post(`${CONVEX_URL}/api/mutation`, {
          path: "auth:login",
          args: {
              email,
              password: "Password123!"
          }
      });
       const loginJson = loginRes.data;
      if (loginJson.status !== "success") {
           throw new Error(`Login Failed: ${loginJson.errorMessage}`);
      }
      
      const userData = loginJson.value.user;
      console.log("Logged in User Data:", userData);
      
      if (userData.schoolId) {
          console.log("PASSED: schoolId is present:", userData.schoolId);
      } else {
          console.error("FAILED: schoolId is MISSING!");
      }

  } catch (e) {
      console.error("Error Details:", e.response ? e.response.data : e.message);
  }
}

run();
