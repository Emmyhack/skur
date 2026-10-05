import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

/**
 * The signing key, held in the device's secure element behind biometrics.
 *
 * Be clear about what this is. A key on a phone is a **hot key**: it is appropriate for an
 * approver or an executor, who need to act often and whose authority is bounded by the vault's
 * policy. It is **not** appropriate for a guardian, whose entire value is being an independent
 * control plane an attacker has to breach separately — a guardian key belongs on hardware or on a
 * machine that is not also reading email. The app says so where it matters, because a guardian
 * key on the same phone as an approver key collapses the two planes the contract works to keep
 * apart.
 *
 * What the device gives us: the secret is written to the iOS keychain or Android keystore, not to
 * app storage, and `requireAuthentication` means the OS will not release it without a successful
 * biometric or passcode check. What it does not give us: protection from a rooted or jailbroken
 * device, and no recovery if the device is lost — which is what the vault's guardian recovery is
 * for.
 */
const KEY = 'skur.signer.v1';

const OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  authenticationPrompt: 'Unlock your Skur signing key',
};

export type BiometricSupport = {
  available: boolean;
  enrolled: boolean;
  /** What the device calls it, so the UI does not promise Face ID on a fingerprint phone. */
  label: string;
};

export async function biometricSupport(): Promise<BiometricSupport> {
  const [available, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const label = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ? 'Face ID'
    : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      ? 'fingerprint'
      : 'device passcode';
  return { available, enrolled, label };
}

export async function hasSigner(): Promise<boolean> {
  // Checked without `requireAuthentication`, so merely asking whether a key exists does not
  // prompt for a face.
  const stored = await SecureStore.getItemAsync(KEY, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }).catch(() => null);
  return Boolean(stored);
}

/** Generate a key and store it. Refuses to overwrite one that already exists. */
export async function createSigner(): Promise<string> {
  if (await hasSigner()) throw new Error('a signing key already exists on this device');
  const keypair = Ed25519Keypair.generate();
  await SecureStore.setItemAsync(KEY, keypair.getSecretKey(), OPTIONS);
  return keypair.toSuiAddress();
}

/** Import an existing key, so a signer already on a vault can use their phone. */
export async function importSigner(secret: string): Promise<string> {
  const trimmed = secret.trim();
  // Validate before storing: a key that cannot be decoded is worse in the keychain than rejected.
  const { secretKey } = decodeSuiPrivateKey(trimmed);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  await SecureStore.setItemAsync(KEY, trimmed, OPTIONS);
  return keypair.toSuiAddress();
}

/**
 * Unlock the key. Prompts for biometrics, and returns the keypair only for the duration of one
 * action — nothing here caches it, because a cached signer is a signer that acts without a face.
 */
export async function unlockSigner(reason = 'Approve with your Skur key'): Promise<Ed25519Keypair> {
  const auth = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  if (!auth.success) throw new Error('cancelled');
  const stored = await SecureStore.getItemAsync(KEY, OPTIONS);
  if (!stored) throw new Error('no signing key on this device');
  const { secretKey } = decodeSuiPrivateKey(stored);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

/** The address, read without unlocking — it is public, and screens need it constantly. */
export async function signerAddress(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(KEY, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }).catch(() => null);
  if (!stored) return null;
  try {
    return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(stored).secretKey).toSuiAddress();
  } catch {
    return null;
  }
}

/**
 * Forget the key. The vault does not care — the address stays a member until governance removes
 * it, which is the point of recovery existing.
 */
export async function forgetSigner(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }).catch(() => undefined);
}
