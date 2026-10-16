import express from 'express';
import { 
  getProviders, 
  getProviderById, 
  getCitiesCatalog,
  getCategoriesCatalog,
  getMyServices,
  addMyService,
  updateMyService,
  deleteMyService
} from '../controllers/providerController.js';
import { getMyProfile, updateMyProfile } from '../controllers/userController.js';
import { 
  uploadDocument, 
  getMyDocuments, 
  getDocumentById, 
  deleteDocument 
} from '../controllers/documentController.js';
import handleUploadMiddleware from '../middleware/upload.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRole } from '../middleware/authorizeRole.js';

const router = express.Router();

/**
 * Public Provider Discovery Endpoints
 */
router.get('/cities', getCitiesCatalog);
router.get('/categories', getCategoriesCatalog);

/**
 * Authenticated Provider Profile Endpoints (Role restricted: provider only)
 */
router.get('/profile', authenticate, authorizeRole('provider'), getMyProfile);
router.patch('/profile', authenticate, authorizeRole('provider'), updateMyProfile);
router.put('/profile', authenticate, authorizeRole('provider'), updateMyProfile);

router.get('/me', authenticate, authorizeRole('provider'), getMyProfile);
router.patch('/me', authenticate, authorizeRole('provider'), updateMyProfile);
router.put('/me', authenticate, authorizeRole('provider'), updateMyProfile);

/**
 * Authenticated Provider My-Services Management (Role restricted: provider only)
 */
router.get('/my-services', authenticate, authorizeRole('provider'), getMyServices);
router.post('/my-services', authenticate, authorizeRole('provider'), addMyService);
router.put('/my-services', authenticate, authorizeRole('provider'), updateMyService);
router.patch('/my-services', authenticate, authorizeRole('provider'), updateMyService);
router.put('/my-services/:serviceName', authenticate, authorizeRole('provider'), updateMyService);
router.delete('/my-services', authenticate, authorizeRole('provider'), deleteMyService);
router.delete('/my-services/:serviceName', authenticate, authorizeRole('provider'), deleteMyService);

/**
 * Authenticated Provider Verification Documents (Role restricted: provider only)
 */
router.post('/documents', authenticate, authorizeRole('provider'), handleUploadMiddleware, uploadDocument);
router.get('/documents', authenticate, authorizeRole('provider'), getMyDocuments);
router.get('/documents/:id', authenticate, getDocumentById);
router.delete('/documents/:id', authenticate, authorizeRole('provider'), deleteDocument);

/**
 * Public Provider Discovery Queries
 */
router.get('/', getProviders);
router.get('/:id', getProviderById);

export default router;
