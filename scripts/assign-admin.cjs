const { clerkClient } = require("@clerk/nextjs/server");

async function assignAdmin() {
  const email = "devendrashahi304@gmail.com";
  console.log(`Starting admin assignment for ${email}...`);

  if (!process.env.CLERK_SECRET_KEY) {
    console.error("Missing CLERK_SECRET_KEY in environment");
    process.exit(1);
  }

  try {
    // 1. Fetch user by email address
    // In Node.js environment, we use native fetch against Clerk Backend API
    // because clerkClient may require Next.js context depending on the version.
    
    const usersResponse = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    });

    if (!usersResponse.ok) {
      console.error("Failed to fetch users:", await usersResponse.text());
      process.exit(1);
    }

    const users = await usersResponse.json();
    
    if (users.length === 0) {
      console.error(`User with email ${email} not found in Clerk.`);
      process.exit(1);
    }

    const user = users[0];
    console.log(`Found user ${user.id}. Current publicMetadata:`, user.public_metadata);

    // 2. Patch public metadata
    const patchResponse = await fetch(`https://api.clerk.com/v1/users/${user.id}/metadata`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        public_metadata: {
          ...user.public_metadata,
          role: "admin",
        },
      }),
    });

    if (!patchResponse.ok) {
      console.error("Failed to update user metadata:", await patchResponse.text());
      process.exit(1);
    }

    const updatedUser = await patchResponse.json();
    console.log("Successfully assigned admin role! Updated publicMetadata:", updatedUser.public_metadata);
    
  } catch (error) {
    console.error("An error occurred:", error);
    process.exit(1);
  }
}

assignAdmin();
