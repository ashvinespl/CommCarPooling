import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { Landing } from './pages/Landing';
import { Login, Onboarding, SignUp } from './pages/Auth';
import { Search } from './pages/Search';
import { TripDetail } from './pages/TripDetail';
import { DriverDeclaration, Publish } from './pages/Publish';
import { MyTrips } from './pages/MyTrips';
import { BookingDetail, Bookings } from './pages/Bookings';
import { Survey } from './pages/Survey';
import { Profile } from './pages/Profile';
import { RideRequestPage } from './pages/RideRequest';
import { Admin } from './pages/Admin';
import { InfoPage } from './pages/Info';
import { EmptyState } from './components/ui';

export function App() {
  const { pathname } = useLocation();
  // Braces matter: whatever an effect returns, React later calls as cleanup.
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<SignUp />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="search" element={<Search />} />
        <Route path="trips/:id" element={<TripDetail />} />
        <Route path="offer" element={<RequireAuth><Publish /></RequireAuth>} />
        <Route path="driver-declaration" element={<RequireAuth><DriverDeclaration /></RequireAuth>} />
        <Route path="my-trips" element={<RequireAuth><MyTrips /></RequireAuth>} />
        <Route path="bookings" element={<RequireAuth><Bookings /></RequireAuth>} />
        <Route path="bookings/:id" element={<RequireAuth><BookingDetail /></RequireAuth>} />
        <Route path="bookings/:id/feedback" element={<RequireAuth><Survey /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="ride-request" element={<RequireAuth><RideRequestPage /></RequireAuth>} />
        <Route path="admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
        <Route path="info/:page" element={<InfoPage />} />
        <Route path="*" element={<EmptyState title="Page not found" />} />
      </Route>
    </Routes>
  );
}
