/**
 * Provider Eligibility Verifier
 * 
 * Enforces unified business rules for whether a service provider
 * can receive, browse, or accept bookings.
 * 
 * Eligibility conditions:
 * 1. Role must be 'provider'
 * 2. Account status must be 'active' (not suspended)
 * 3. Provider must be verified (isVerified: true or verificationStatus: 'approved')
 * 4. Provider must be available (isAvailable !== false)
 */

export const checkProviderBookingEligibility = (provider) => {
  if (!provider || provider.role !== 'provider') {
    return {
      eligible: false,
      statusCode: 404,
      error: 'Selected service technician not found or is not a provider account.'
    };
  }

  // Account status check
  if (provider.status !== 'active') {
    return {
      eligible: false,
      statusCode: 400,
      error: `Technician "${provider.name}" account is currently inactive or suspended.`
    };
  }

  // Verification check: unverified or rejected providers cannot receive or accept bookings
  const isVerified = Boolean(
    provider.providerDetails?.isVerified ||
    provider.providerDetails?.verificationStatus === 'approved' ||
    provider.verificationStatus === 'approved'
  );

  if (!isVerified) {
    return {
      eligible: false,
      statusCode: 400,
      error: `Technician "${provider.name}" has not completed verification approval by administration and cannot receive service bookings.`
    };
  }

  // Active availability check
  if (provider.providerDetails?.isAvailable === false) {
    return {
      eligible: false,
      statusCode: 400,
      error: `Technician "${provider.name}" is currently offline and not accepting new booking requests. Please check back later or choose another provider.`
    };
  }

  return { eligible: true };
};

export default {
  checkProviderBookingEligibility
};
