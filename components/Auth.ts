// src/components/Auth.ts (in your Expo app)
import {
  createUserWithEmailAndPassword, // For signing up new users
  signInWithEmailAndPassword, // For signing in existing users
  signOut, // Sign out remains the same
  User, // Import User type
} from 'firebase/auth';
import { auth } from '../lib/firebase';

/**
 * Signs up a new user with email and password.
 * @param email The user's email address.
 * @param password The user's password.
 * @returns Promise resolving to the signed-up user.
 */
export async function signUpWithEmail(email: string, password: string): Promise<User> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('User signed up:', userCredential.user.email);
    return userCredential.user;
  } catch (error: any) {
    console.error('Email Sign-Up Error:', error.message, error.code);
    // Firebase provides specific error codes you can handle, e.g.,
    // auth/email-already-in-use, auth/weak-password
    throw error; // Re-throw to propagate the error
  }
}

/**
 * Signs in an existing user with email and password.
 * @param email The user's email address.
 * @param password The user's password.
 * @returns Promise resolving to the signed-in user.
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('User signed in:', userCredential.user.email);
    return userCredential.user;
  } catch (error: any) {
    console.error('Email Sign-In Error:', error.message, error.code);
    // Firebase provides specific error codes you can handle, e.g.,
    // auth/invalid-email, auth/user-disabled, auth/user-not-found, auth/wrong-password
    throw error; // Re-throw to propagate the error
  }
}

/**
 * Signs out the currently authenticated user.
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
    console.log('User signed out.');
  } catch (error) {
    console.error('Sign-Out Error:', error);
    throw error;
  }
}
