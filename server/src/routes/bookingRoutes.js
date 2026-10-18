import express from 'express';
import {
  createBooking,
  getCustomerBookings,
  getProviderBookings,
  getBookingById,
  cancelBooking,
  acceptBooking,
  rejectBooking,
  startBooking,
  completeBooking,
  updateBookingLocation,
  getBookingLocation,
  getArrivalOtp,
  verifyArrival
} from '../controllers/bookingController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { arrivalOtpLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * All booking endpoints require authentication
 */
router.use(authenticate);

// 1. Create a booking request (Customer only)
router.post('/', authorizeRole('customer'), createBooking);

// 2. List bookings for authenticated customer
router.get('/my', authorizeRole('customer'), getCustomerBookings);

// 3. List bookings for authenticated provider
router.get('/provider', authorizeRole('provider'), getProviderBookings);

// 4. Get single booking details (Customer, assigned Provider, or Admin)
router.get('/:id', getBookingById);

// 5. Cancel a booking (Customer or assigned Provider before completion)
router.patch('/:id/cancel', cancelBooking);

// 6. Accept a pending booking (Assigned Provider only)
router.patch('/:id/accept', authorizeRole('provider'), acceptBooking);

// 7. Reject a pending booking (Assigned Provider only)
router.patch('/:id/reject', authorizeRole('provider'), rejectBooking);

// 8. Start an accepted booking (Assigned Provider only)
router.patch('/:id/start', authorizeRole('provider'), startBooking);

// 9. Complete an in-progress or accepted booking (Assigned Provider only)
router.patch('/:id/complete', authorizeRole('provider'), completeBooking);

// 9. Update coordinates for an authorized booking (Customer or assigned Provider)
router.patch('/:id/location', updateBookingLocation);

// 10. Get authorized service and provider location for booking (Assigned Customer or Provider)
router.get('/:id/location', getBookingLocation);

// 11. Get arrival OTP for confirmed booking (Customer only)
router.get('/:id/arrival-otp', authorizeRole('customer'), getArrivalOtp);

// 11. Verify arrival on-site via customer OTP (Assigned Provider only)
router.post('/:id/verify-arrival', authorizeRole('provider'), arrivalOtpLimiter, verifyArrival);
router.patch('/:id/verify-arrival', authorizeRole('provider'), arrivalOtpLimiter, verifyArrival);

export default router;
