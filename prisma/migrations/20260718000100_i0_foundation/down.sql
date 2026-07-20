-- DropForeignKey
ALTER TABLE "public"."users" DROP CONSTRAINT "users_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_profiles" DROP CONSTRAINT "user_profiles_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_profiles" DROP CONSTRAINT "user_profiles_profileId_fkey";

-- DropForeignKey
ALTER TABLE "public"."profile_permissions" DROP CONSTRAINT "profile_permissions_profileId_fkey";

-- DropForeignKey
ALTER TABLE "public"."profile_permissions" DROP CONSTRAINT "profile_permissions_permissionId_fkey";

-- DropTable
DROP TABLE "public"."departments";

-- DropTable
DROP TABLE "public"."users";

-- DropTable
DROP TABLE "public"."profiles";

-- DropTable
DROP TABLE "public"."permissions";

-- DropTable
DROP TABLE "public"."user_profiles";

-- DropTable
DROP TABLE "public"."profile_permissions";

-- DropTable
DROP TABLE "public"."audit_events";

-- DropEnum
DROP TYPE "public"."UserStatus";

-- DropEnum
DROP TYPE "public"."AuditActorType";

-- DropEnum
DROP TYPE "public"."AuditOutcome";
