-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inviteeID" TEXT NOT NULL,
    "inviterID" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interactionID" TEXT NOT NULL,
    "valid" BOOLEAN NOT NULL DEFAULT false,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    CONSTRAINT "Invite_inviteeID_fkey" FOREIGN KEY ("inviteeID") REFERENCES "UserMetadata" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invite_inviterID_fkey" FOREIGN KEY ("inviterID") REFERENCES "UserMetadata" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invite" ("createdAt", "description", "id", "interactionID", "inviteeID", "inviterID", "valid") SELECT "createdAt", "description", "id", "interactionID", "inviteeID", "inviterID", "valid" FROM "Invite";
DROP TABLE "Invite";
ALTER TABLE "new_Invite" RENAME TO "Invite";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
