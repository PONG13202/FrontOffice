'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import React from 'react';

const ClientProviders = ({ children }: { children: React.ReactNode }) => {
  
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_CLIENT_ID!}>
      {children}
    </GoogleOAuthProvider>
  );
};

export default ClientProviders;
