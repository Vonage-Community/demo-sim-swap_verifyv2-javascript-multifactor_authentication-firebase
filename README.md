# Multifactor Security Authentication Using Vonage APIs and Firebase Services

## Overview

This project is a web application demonstrating how to strengthen multifactor security authentication using the Vonage SIM Swap API and Verify v2 API, integrated with Firebase Hosting, Functions, and Firestore. The application includes a simple bank dashboard and a login form. If the SIM Swap API detects that a phone number was swapped recently, the verification code will not be sent, and additional security measures will be applied. A verification code will be sent via the Verify v2 API to authenticate the user if no recent swap is detected.

## Features

- A login form to enter and verify a phone number
- Secure multifactor authentication using Vonage Verify v2
- SIM Swap detection to prevent compromised logins
- Simple bank dashboard after successful login
- Firebase Hosting for serving the application
- Firebase Functions for server-side logic
- Firestore for storing user data and verification status

## Prerequisites

- A [Vonage Developer Account](https://developer.vonage.com).
- A Firebase project set up in the [Firebase Console](https://console.firebase.google.com).
- Node.js and npm installed.

## Getting Started

1. Clone the repository and change directories
   ```bash
   git clone https://github.com/Vonage-Community/demo-sim-swap_verifyv2-javascript-multifactor_authentication-firebase.git
   cd https://github.com/Vonage-Community/demo-sim-swap_verifyv2-javascript-multifactor_authentication-firebase.git
   ```
2. Install the required packages:
   ```bash
   npm install
   ```

3. Move the `.env.example` file to `.env` file in the project root and include the following environment variables:
   ```bash
   mv .env.example .env
   ```
   ```bash
    VONAGE_APPLICATION_ID=your_application_id
    VONAGE_APPLICATION_PRIVATE_KEY_PATH=/path/to/your/private.key
    JWT=your_jwt_token
   ```

4. You have the choice to set these variables:
   ```bash
    MAX_AGE=your_max_age
    RECIPIENT_NUMBER=your_recipient_number
   ```

5. Set up Firebase:
   - Install Firebase CLI:
     ```bash
     npm install -g firebase-tools
     ```
   - Log in to Firebase:
     ```bash
     firebase login
     ```
   - Initialize Firebase in your project:
     ```bash
     firebase init
     ```
     Select `Hosting`, `Functions`, and `Firestore` when prompted.

6. Deploy Firebase Functions and Hosting:
   ```bash
   firebase deploy
   ```

7. Run the application locally:
   ```bash
   firebase emulators:start
   ```

8. Launch your web browser and enter the URL:
   ```bash
   http://localhost:5000/
   ```

## How It Works

### SIM Swap API

The application uses the Vonage SIM Swap API to check whether a given phone number has been swapped in the last few days. This protects users from attacks that exploit SIM swaps.

### Verify v2 API

The Verify v2 API sends a one-time code to the user's phone number for authentication. This verification code will be sent if the SIM Swap API determines that the number has not been recently swapped.

### Firebase Integration

- **Firebase Hosting:** Serves the web application.
- **Firebase Functions:** Handles the server-side logic for verifying the SIM swap and sending verification codes.
- **Firestore:** Stores user data and verification status, ensuring that passwords and other sensitive information are securely managed.

### Application Flow

1. The user enters their phone number on the login page.
2. The SIM Swap API checks whether the number was swapped recently.
3. A verification code is sent via the Verify v2 API if no swap is detected.
4. After successful verification, the user can access the bank dashboard.

This setup provides a robust and scalable architecture, combining Vonage's security APIs with Firebase's comprehensive backend services.