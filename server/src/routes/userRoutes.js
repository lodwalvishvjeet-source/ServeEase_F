import express from 'express';
import { 
  getMyProfile, 
  updateMyProfile,
  getProfileById,
  updateProfileById
} from '../controllers/userController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRole } from '../middleware/authorizeRole.js';

const router = express.Router();

// All user routes require valid authentication
router.use(authenticate);

/**
 * Profile endpoints (current authenticated user)
 */
router.get('/me', getMyProfile);
router.patch('/me', updateMyProfile);
router.put('/me', updateMyProfile);

router.get('/profile', getMyProfile);
router.patch('/profile', updateMyProfile);
router.put('/profile', updateMyProfile);

/**
 * Role-Restricted Endpoints (Verifiable for testing / viva)
 */
router.get('/customer-zone', authorizeRole('customer'), (req, res) => {
  res.status(200).json({
    success: true,
    message: `Hello Customer ${req.user.name}. You have verified access to customer-only endpoints.`,
    user: req.user.toSafeObject()
  });
});

router.get('/provider-zone', authorizeRole('provider'), (req, res) => {
  res.status(200).json({
    success: true,
    message: `Hello Service Provider ${req.user.name}. You have verified access to provider-only endpoints.`,
    user: req.user.toSafeObject()
  });
});

router.get('/admin-zone', authorizeRole('admin'), (req, res) => {
  res.status(200).json({
    success: true,
    message: `Hello Administrator ${req.user.name}. You have verified access to admin-only management endpoints.`,
    user: req.user.toSafeObject()
  });
});

/**
 * Specific User ID Endpoints
 */
router.get('/:id', getProfileById);
router.patch('/:id', updateProfileById);
router.put('/:id', updateProfileById);

export default router;
