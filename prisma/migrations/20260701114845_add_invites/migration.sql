-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inviteeID" TEXT NOT NULL,
    "inviterID" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interactionID" TEXT NOT NULL,
    "valid" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    CONSTRAINT "Invite_inviteeID_fkey" FOREIGN KEY ("inviteeID") REFERENCES "UserMetadata" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invite_inviterID_fkey" FOREIGN KEY ("inviterID") REFERENCES "UserMetadata" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarURL" TEXT NOT NULL
);
