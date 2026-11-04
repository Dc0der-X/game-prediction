import { createRemoteJWKSet, jwtVerify } from 'jose';

// Google's public keys for Firebase Auth ID tokens.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

/** Verifies a Firebase Auth ID token and returns the user's uid and email. */
export async function verifyFirebaseIdToken(token: string, projectId: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
  });
  if (!payload.sub) throw new Error('Token has no subject');
  return { uid: payload.sub, email: (payload['email'] as string) || '' };
}
