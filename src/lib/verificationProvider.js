/**
 * Verification Provider
 * Handles integration with VerifyMe or other age/identity verification services
 */

import { base44 } from '@/api/base44Client';

/**
 * Initiate verification for a user
 * Redirects to VerifyMe flow
 */
export async function initiateVerification(userId, userEmail) {
  try {
    // Redirect to VerifyMe (external service)
    // This would be configured via backend URL
    const verificationUrl = `${window.location.origin}/verify?user_id=${userId}&email=${userEmail}`;
    window.location.href = verificationUrl;
  } catch (error) {
    console.error('Failed to initiate verification:', error);
    throw error;
  }
}

/**
 * Complete verification (called after VerifyMe redirects back)
 */
export async function completeVerification(verificationId, metadata = {}) {
  try {
    const user = await base44.auth.me();
    
    // Update UserProfile with verification data
    const profiles = await base44.entities.UserProfile.filter({ user_id: user.email });
    const profile = profiles[0];
    
    if (!profile) {
      throw new Error('User profile not found');
    }
    
    await base44.entities.UserProfile.update(profile.id, {
      verification_status: 'approved',
      age_verified: true,
      verification_provider: 'verifyme',
      verification_id: verificationId,
      verification_completed_at: new Date().toISOString(),
    });
    
    return {
      verified: true,
      age_verified: true,
      verification_id: verificationId,
      provider: 'verifyme',
    };
  } catch (error) {
    console.error('Failed to complete verification:', error);
    throw error;
  }
}

/**
 * Check if user is verified
 */
export async function checkVerificationStatus(userEmail) {
  try {
    const profiles = await base44.entities.UserProfile.filter({ user_id: userEmail });
    const profile = profiles[0];
    
    if (!profile) {
      return {
        verified: false,
        age_verified: false,
      };
    }
    
    return {
      verified: profile.verification_status === 'approved',
      age_verified: profile.age_verified === true,
      verification_id: profile.verification_id,
      provider: profile.verification_provider,
      completed_at: profile.verification_completed_at,
    };
  } catch (error) {
    console.error('Failed to check verification status:', error);
    return {
      verified: false,
      age_verified: false,
    };
  }
}