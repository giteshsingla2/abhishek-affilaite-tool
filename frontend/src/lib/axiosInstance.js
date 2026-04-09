import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: '',
  withCredentials: true,
});

// Request interceptor to add the access token to the headers
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 errors and attempt token refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh the token using the refreshToken cookie
        const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const { token } = res.data;

        // Save the new access token
        localStorage.setItem('token', token);

        // Update the original request with the new token and retry it
        originalRequest.headers['x-auth-token'] = token;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // If refresh fails, clear auth data and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
