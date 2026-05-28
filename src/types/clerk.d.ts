export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: "admin" | "instructor" | "student";
    };
  }
}
