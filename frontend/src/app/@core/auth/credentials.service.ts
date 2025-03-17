import { Injectable } from '@angular/core';

export interface Credentials {
  // Customize received credentials here
  username: string;
  token: string;
}

const credentialsKey = 'token';

/**
 * Provides storage for authentication credentials.
 * The Credentials interface should be replaced with proper implementation.
 */
@Injectable({
  providedIn: 'root'
})
export class CredentialsService {
  // private token: string | null = null;

  constructor() {
    // const savedCredentials = sessionStorage.getItem(credentialsKey);
    // if (savedCredentials) {
    //   this.token = savedCredentials;
    // }
  }

  /**
   * Checks is the user is authenticated.
   * @return True if the user is authenticated.
   */
  isAuthenticated(): boolean {
    return !!this.credentials;
  }

  clearCredentials() {
    sessionStorage.clear();
  }

  /**
   * Gets the user credentials.
   * @return The user credentials or null if the user is not authenticated.
   */
  get credentials(): string | null {
    return sessionStorage.getItem(credentialsKey);
  }

  /**
   * Sets the user credentials.
   * The credentials may be persisted across sessions by setting the `remember` parameter to true.
   * Otherwise, the credentials are only persisted for the current session.
   * @param credentials The user credentials.
   * @param remember True to remember credentials across sessions.
   */
  setCredentials(credentials?: string) {
    // this.token = credentials || null;
    console.log('credentials', credentials);
    
    if (credentials) {
      sessionStorage.setItem(credentialsKey, credentials);
    } else {
      sessionStorage.clear();
    }
  }

}
