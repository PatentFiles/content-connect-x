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
 * CRITICAL: ONLY mark as verified if age_verified === true
 * If face match passes but age < 18 → BLOCK USER permanently
 */
export async function completeVerification(verificationResponse = {}, metadata = {}) {
   try {
     const user = await base44.auth.me();

     // CRITICAL: VerifyMe must return age_verified === true
     if (verificationResponse.age_verified !== true) {
       // Age not verified or user < 18 — BLOCK USER
       throw new Error('Age verification failed. You must be 18+ to use this platform.');
     }

     // Update UserProfile with verification data
     const profiles = await base44.entities.UserProfile.filter({ user_id: user.email });
     const profile = profiles[0];

     if (!profile) {
       throw new Error('User profile not found');
     }

     await base44.entities.UserProfile.update(profile.id, {
       age_verified: true,
       verification_provider: 'verifyme',
       verification_id: verificationResponse.verification_id,
       verification_completed_at: new Date().toISOString(),
     });

     return {
       verified: true,
       age_verified: true,
       verification_id: verificationResponse.verification_id,
       provider: 'verifyme',
     };
   } catch (error) {
     console.error('Failed to complete verification:', error);
     throw error;
   }
 }

/**
 * Check if user is verified
 * SINGLE SOURCE OF TRUTH: age_verified
 */
export async function checkVerificationStatus(userEmail) {
   try {
     const profiles = await base44.entities.UserProfile.filter({ user_id: userEmail });
     const profile = profiles[0];

     if (!profile) {
       return {
         age_verified: false,
       };
     }

     // age_verified is the single source of truth
     return {
       age_verified: profile.age_verified === true,
       verification_id: profile.verification_id,
       provider: profile.verification_provider,
       completed_at: profile.verification_completed_at,
     };
   } catch (error) {
     console.error('Failed to check verification status:', error);
     return {
       age_verified: false,
     };
   }
 }